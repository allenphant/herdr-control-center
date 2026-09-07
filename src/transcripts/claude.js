import {
  TranscriptError,
  finalizeMessages,
  normalizeText,
  normalizeTimestamp,
  parseJsonlChunk,
} from "./shared.js";

export function createClaudeState(conversationId) {
  return {
    conversationId,
    nodes: new Map(),
    latestUuid: null,
    sequence: 0,
  };
}

export function appendClaudeRecords(state, records) {
  for (const record of records) {
    if (record?.sessionId && record.sessionId !== state.conversationId) {
      throw new TranscriptError(422, "Claude transcript sessionId 與 Herdr fingerprint 不符");
    }
    if (!record?.uuid || record.isSidechain === true) continue;
    if (state.nodes.has(record.uuid)) {
      throw new TranscriptError(422, "Claude transcript 出現重複 uuid");
    }
    state.nodes.set(record.uuid, { record, sequence: state.sequence });
    state.sequence += 1;
    state.latestUuid = record.uuid;
  }
  return state;
}

function visibleParts(record) {
  if (record.type === "user" && record.isMeta !== true && record.message?.role === "user") {
    if (typeof record.message.content === "string") {
      return [{ index: 0, text: normalizeText(record.message.content) }];
    }
    if (Array.isArray(record.message.content)) {
      return record.message.content
        .map((part, index) => ({
          index,
          text: part?.type === "text" ? normalizeText(part.text) : "",
        }))
        .filter((part) => part.text);
    }
  }
  if (record.type === "assistant" && record.message?.role === "assistant") {
    if (!Array.isArray(record.message.content)) return [];
    return record.message.content
      .map((part, index) => ({
        index,
        text: part?.type === "text" ? normalizeText(part.text) : "",
      }))
      .filter((part) => part.text);
  }
  return [];
}

export function materializeClaudeMessages(state) {
  const active = new Set();
  let uuid = state.latestUuid;
  while (uuid && !active.has(uuid)) {
    active.add(uuid);
    uuid = state.nodes.get(uuid)?.record?.parentUuid || null;
  }
  const messages = [];
  for (const [recordUuid, node] of state.nodes) {
    if (!active.has(recordUuid)) continue;
    const role = node.record.type === "user" ? "user" : "assistant";
    for (const part of visibleParts(node.record)) {
      messages.push({
        provider: "claude",
        conversationId: state.conversationId,
        anchor: `claude:${recordUuid}:${part.index}`,
        role,
        timestamp: normalizeTimestamp(node.record.timestamp),
        text: part.text,
        sortOrder: node.sequence + part.index / 1000,
      });
    }
  }
  return finalizeMessages(messages);
}

export function parseClaudeTranscript(text, conversationId) {
  const state = createClaudeState(conversationId);
  const { records } = parseJsonlChunk(text, { final: true });
  appendClaudeRecords(state, records);
  return materializeClaudeMessages(state);
}

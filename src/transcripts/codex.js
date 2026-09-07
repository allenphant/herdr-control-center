import {
  TranscriptError,
  finalizeMessages,
  normalizeText,
  normalizeTimestamp,
  parseJsonlChunk,
} from "./shared.js";

export function createCodexState(conversationId) {
  return {
    conversationId,
    messages: new Map(),
    sourceMeta: new Map(),
    sequence: 0,
  };
}

export function appendCodexRecords(state, records, sourceId = "rollout") {
  let metaId = state.sourceMeta.get(sourceId) || null;
  for (const record of records) {
    if (record?.type === "session_meta") {
      metaId = record.payload?.id || null;
      if (metaId !== state.conversationId) {
        throw new TranscriptError(422, "Codex rollout thread ID 與 Herdr fingerprint 不符");
      }
      state.sourceMeta.set(sourceId, metaId);
      continue;
    }
    const payload = record?.payload;
    if (record?.type !== "response_item" || payload?.type !== "message") continue;
    if (!metaId) throw new TranscriptError(422, "Codex rollout 缺少 session_meta");
    if (!['user', 'assistant'].includes(payload.role) || !Array.isArray(payload.content)) continue;
    if (typeof payload.id !== "string" || !payload.id) {
      throw new TranscriptError(422, "Codex 可見訊息缺少穩定 item id");
    }
    const expectedType = payload.role === "user" ? "input_text" : "output_text";
    payload.content.forEach((part, index) => {
      if (part?.type !== expectedType) return;
      const text = normalizeText(part.text);
      if (!text) return;
      const key = `${payload.id}:${index}`;
      const message = {
        provider: "codex",
        conversationId: state.conversationId,
        anchor: `codex:${key}`,
        role: payload.role,
        timestamp: normalizeTimestamp(record.timestamp),
        text,
        sortOrder: state.sequence,
      };
      state.sequence += 1;
      const existing = state.messages.get(key);
      if (existing) {
        if (existing.role !== message.role || existing.text !== message.text) {
          throw new TranscriptError(422, "Codex rollout 重複 item id 的內容不一致");
        }
        return;
      }
      state.messages.set(key, message);
    });
  }
  return state;
}

export function materializeCodexMessages(state) {
  const messages = [...state.messages.values()];
  messages.sort((left, right) => {
    const timeCompare = (left.timestamp || "").localeCompare(right.timestamp || "");
    return timeCompare || left.sortOrder - right.sortOrder || left.anchor.localeCompare(right.anchor);
  });
  return finalizeMessages(messages.map((message, index) => ({ ...message, sortOrder: index })));
}

export function parseCodexRollouts(sources, conversationId) {
  const state = createCodexState(conversationId);
  for (const [index, source] of sources.entries()) {
    const { records } = parseJsonlChunk(source.text, { final: true });
    appendCodexRecords(state, records, source.id || `rollout-${index}`);
  }
  return materializeCodexMessages(state);
}

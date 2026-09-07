import {
  finalizeMessages,
  normalizeText,
  normalizeTimestamp,
  parseJsonlChunk,
} from "./shared.js";

export function createAgyState(conversationId) {
  return {
    conversationId,
    messages: [],
    occurrences: new Map(),
    sequence: 0,
  };
}

export function appendAgyRecords(state, records) {
  for (const record of records) {
    if (record?.status !== "DONE") continue;
    const isUser = record.source === "USER_EXPLICIT" && record.type === "USER_INPUT";
    const isAssistant = record.source === "MODEL" && record.type === "PLANNER_RESPONSE";
    if (!isUser && !isAssistant) continue;
    const text = normalizeText(record.content);
    if (!text) continue;
    const step = Number.isInteger(record.step_index) ? record.step_index : "unknown";
    const occurrenceKey = `${step}:${record.type}`;
    const occurrence = state.occurrences.get(occurrenceKey) || 0;
    state.occurrences.set(occurrenceKey, occurrence + 1);
    state.messages.push({
      provider: "agy",
      conversationId: state.conversationId,
      anchor: `agy:${occurrenceKey}:${occurrence}`,
      role: isUser ? "user" : "assistant",
      timestamp: normalizeTimestamp(record.created_at),
      text,
      sortOrder: state.sequence,
    });
    state.sequence += 1;
  }
  return state;
}

export function materializeAgyMessages(state) {
  return finalizeMessages([...state.messages]);
}

export function parseAgyTranscript(text, conversationId) {
  const state = createAgyState(conversationId);
  const { records } = parseJsonlChunk(text, { final: true });
  appendAgyRecords(state, records);
  return materializeAgyMessages(state);
}

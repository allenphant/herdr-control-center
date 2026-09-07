export const CONVERSATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TranscriptError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "TranscriptError";
    this.statusCode = statusCode;
  }
}

export function assertConversationId(value) {
  if (!CONVERSATION_ID_PATTERN.test(value || "")) {
    throw new TranscriptError(422, "Conversation ID 格式不受支援");
  }
  return value;
}

export function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").trim();
}

export function normalizeTimestamp(value) {
  if (typeof value !== "string" || !value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function parseJsonlChunk(chunk, { remainder = "", final = false } = {}) {
  const combined = `${remainder}${chunk}`;
  const lines = combined.split("\n");
  let nextRemainder = "";
  if (!final && !combined.endsWith("\n")) nextRemainder = lines.pop() || "";
  const records = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      throw new TranscriptError(422, `Transcript JSONL 第 ${index + 1} 行格式不正確`);
    }
  }
  if (final && nextRemainder.trim()) {
    try {
      records.push(JSON.parse(nextRemainder));
      nextRemainder = "";
    } catch {
      throw new TranscriptError(422, "Transcript 最後一行格式不完整");
    }
  }
  return { records, remainder: nextRemainder };
}

export function finalizeMessages(messages) {
  return messages
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(({ sortOrder: _sortOrder, ...message }, ordinal) => ({ ...message, ordinal }));
}

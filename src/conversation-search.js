import { createHash } from "node:crypto";
import { lstat, open, readdir, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  appendAgyRecords,
  createAgyState,
  materializeAgyMessages,
} from "./transcripts/agy.js";
import {
  appendClaudeRecords,
  createClaudeState,
  materializeClaudeMessages,
} from "./transcripts/claude.js";
import {
  appendCodexRecords,
  createCodexState,
  materializeCodexMessages,
} from "./transcripts/codex.js";
import {
  TranscriptError,
  assertConversationId,
  parseJsonlChunk,
} from "./transcripts/shared.js";

const PROVIDERS = {
  "herdr:antigravity_cli": { agent: "agy", provider: "agy" },
  "herdr:claude": { agent: "claude", provider: "claude" },
  "herdr:codex": { agent: "codex", provider: "codex" },
};

function providerForFingerprint(fingerprint) {
  const mapping = PROVIDERS[fingerprint?.source];
  if (!mapping || mapping.agent !== fingerprint?.agent) {
    throw new TranscriptError(422, "這個 agent transcript 尚未支援搜尋");
  }
  return mapping.provider;
}

async function regularFileWithin(filePath, root) {
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) return false;
  const [resolvedFile, resolvedRoot] = await Promise.all([realpath(filePath), realpath(root)]);
  return resolvedFile.startsWith(`${resolvedRoot}${path.sep}`);
}

async function walkFiles(root, accept, output = []) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) await walkFiles(entryPath, accept, output);
    else if (entry.isFile() && accept(entry.name)) output.push(entryPath);
  }
  return output;
}

async function readFrom(filePath, offset) {
  const handle = await open(filePath, "r");
  try {
    const info = await handle.stat();
    const length = Math.max(0, info.size - offset);
    const buffer = Buffer.alloc(length);
    if (length) await handle.read(buffer, 0, length, offset);
    return buffer;
  } finally {
    await handle.close();
  }
}

function createProviderState(provider, conversationId) {
  if (provider === "claude") return createClaudeState(conversationId);
  if (provider === "codex") return createCodexState(conversationId);
  return createAgyState(conversationId);
}

function appendProviderRecords(provider, state, records, sourceId) {
  if (provider === "claude") return appendClaudeRecords(state, records);
  if (provider === "codex") return appendCodexRecords(state, records, sourceId);
  return appendAgyRecords(state, records);
}

function materializeProvider(provider, state) {
  if (provider === "claude") return materializeClaudeMessages(state);
  if (provider === "codex") return materializeCodexMessages(state);
  return materializeAgyMessages(state);
}

function revisionFor(provider, conversationId, sources) {
  const hash = createHash("sha256");
  hash.update(`conversation-search-v1\0${provider}\0${conversationId}\0`);
  for (const source of [...sources.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(`${source.id}\0${source.raw.length}\0`);
    hash.update(source.raw);
  }
  return hash.digest("hex");
}

export class TranscriptRepository {
  constructor({ homeDirectory = os.homedir(), maxEntries = 12, discoveryTtlMs = 2_000 } = {}) {
    this.homeDirectory = homeDirectory;
    this.maxEntries = Math.max(1, maxEntries);
    this.discoveryTtlMs = Math.max(0, discoveryTtlMs);
    this.cache = new Map();
    this.locations = new Map();
  }

  async locate(provider, conversationId, force = false) {
    const key = `${provider}:${conversationId}`;
    const known = this.locations.get(key);
    if (!force && known && Date.now() - known.discoveredAt < this.discoveryTtlMs) {
      return known.paths;
    }

    let paths = [];
    if (provider === "claude") {
      const root = path.join(this.homeDirectory, ".claude", "projects");
      const projects = await readdir(root, { withFileTypes: true }).catch(() => []);
      for (const project of projects) {
        if (!project.isDirectory()) continue;
        const candidate = path.join(root, project.name, `${conversationId}.jsonl`);
        if (await regularFileWithin(candidate, root).catch(() => false)) paths.push(candidate);
      }
    } else if (provider === "codex") {
      const root = path.join(this.homeDirectory, ".codex", "sessions");
      paths = await walkFiles(root, (name) => name.endsWith(`-${conversationId}.jsonl`));
    } else {
      const root = path.join(this.homeDirectory, ".gemini", "antigravity-cli", "brain");
      const candidate = path.join(
        root,
        conversationId,
        ".system_generated",
        "logs",
        "transcript.jsonl",
      );
      if (await regularFileWithin(candidate, root).catch(() => false)) paths = [candidate];
    }
    paths.sort();
    this.locations.set(key, { discoveredAt: Date.now(), paths });
    return paths;
  }

  touch(key, entry) {
    this.cache.delete(key);
    this.cache.set(key, entry);
    while (this.cache.size > this.maxEntries) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  async rebuild(provider, conversationId, paths) {
    const state = createProviderState(provider, conversationId);
    const sources = new Map();
    for (const [index, filePath] of paths.entries()) {
      const raw = await readFrom(filePath, 0);
      const info = await stat(filePath);
      const id = `${index}:${path.basename(filePath)}`;
      const parsed = parseJsonlChunk(raw.toString("utf8"), { final: false });
      appendProviderRecords(provider, state, parsed.records, id);
      sources.set(filePath, {
        id,
        raw,
        remainder: parsed.remainder,
        size: info.size,
        mtimeMs: info.mtimeMs,
      });
    }
    return {
      provider,
      conversationId,
      state,
      sources,
      messages: materializeProvider(provider, state),
      revision: revisionFor(provider, conversationId, sources),
    };
  }

  async load(fingerprint) {
    const provider = providerForFingerprint(fingerprint);
    const conversationId = assertConversationId(fingerprint.value);
    const key = `${provider}:${conversationId}`;
    let entry = this.cache.get(key);
    let paths = await this.locate(provider, conversationId, !entry);
    if (!paths.length) throw new TranscriptError(404, "找不到這個 conversation 的 transcript");

    const samePaths = entry
      && paths.length === entry.sources.size
      && paths.every((filePath) => entry.sources.has(filePath));
    if (!samePaths) {
      entry = await this.rebuild(provider, conversationId, paths);
      this.touch(key, entry);
      return entry;
    }

    const infos = await Promise.all(paths.map((filePath) => stat(filePath)));
    const mustRebuild = paths.some((filePath, index) => {
      const previous = entry.sources.get(filePath);
      return infos[index].size < previous.size
        || (infos[index].size === previous.size && infos[index].mtimeMs !== previous.mtimeMs);
    });
    if (mustRebuild) {
      entry = await this.rebuild(provider, conversationId, paths);
      this.touch(key, entry);
      return entry;
    }

    let changed = false;
    try {
      for (const [index, filePath] of paths.entries()) {
        const previous = entry.sources.get(filePath);
        const info = infos[index];
        if (info.size === previous.size) continue;
        const appended = await readFrom(filePath, previous.size);
        const parsed = parseJsonlChunk(appended.toString("utf8"), {
          remainder: previous.remainder,
          final: false,
        });
        appendProviderRecords(provider, entry.state, parsed.records, previous.id);
        previous.raw = Buffer.concat([previous.raw, appended]);
        previous.remainder = parsed.remainder;
        previous.size = info.size;
        previous.mtimeMs = info.mtimeMs;
        changed = true;
      }
    } catch (error) {
      this.cache.delete(key);
      throw error;
    }
    if (changed) {
      entry.messages = materializeProvider(provider, entry.state);
      entry.revision = revisionFor(provider, conversationId, entry.sources);
    }
    this.touch(key, entry);
    return entry;
  }
}

function queryHash(query, roles) {
  return createHash("sha256").update(`${query}\0${roles.join(",")}`).digest("hex").slice(0, 24);
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (value?.v !== 1 || !Number.isInteger(value.offset) || value.offset < 0) throw new Error();
    return value;
  } catch {
    throw new TranscriptError(400, "搜尋 cursor 格式不正確");
  }
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function matchRanges(text, query) {
  const source = text.toLowerCase();
  const needle = query.toLowerCase();
  const ranges = [];
  let offset = 0;
  while (offset <= source.length - needle.length) {
    const start = source.indexOf(needle, offset);
    if (start < 0) break;
    ranges.push({ start, end: start + needle.length });
    offset = start + Math.max(needle.length, 1);
  }
  return ranges;
}

function snippetFor(text, ranges) {
  if (text.length <= 320) return { snippet: text, matchRanges: ranges };
  const start = Math.max(0, ranges[0].start - 100);
  const end = Math.min(text.length, start + 320);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return {
    snippet: `${prefix}${text.slice(start, end)}${suffix}`,
    matchRanges: ranges
      .filter((range) => range.start >= start && range.end <= end)
      .map((range) => ({
        start: range.start - start + prefix.length,
        end: range.end - start + prefix.length,
      })),
  };
}

function normalizeRoles(value) {
  const roles = Array.isArray(value) ? [...new Set(value)] : ["user", "assistant"];
  if (!roles.length || roles.some((role) => !["user", "assistant"].includes(role))) {
    throw new TranscriptError(400, "搜尋 roles 格式不正確");
  }
  return roles.sort();
}

export class ConversationSearchService {
  constructor({ repository = new TranscriptRepository() } = {}) {
    this.repository = repository;
  }

  async search(fingerprint, input = {}) {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query || query.length > 200) {
      throw new TranscriptError(400, "搜尋文字必須為 1 到 200 個字元");
    }
    const roles = normalizeRoles(input.roles);
    const limit = input.limit === undefined ? 20 : Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new TranscriptError(400, "搜尋 limit 必須介於 1 到 100");
    }
    const conversation = await this.repository.load(fingerprint);
    const cursor = decodeCursor(input.cursor);
    const hash = queryHash(query, roles);
    if (cursor && (cursor.revision !== conversation.revision || cursor.queryHash !== hash)) {
      throw new TranscriptError(409, "Transcript 已更新或搜尋條件已改變，請重新搜尋");
    }
    const matched = conversation.messages.flatMap((message) => {
      if (!roles.includes(message.role)) return [];
      const ranges = matchRanges(message.text, query);
      if (!ranges.length) return [];
      return [{
        anchor: message.anchor,
        ordinal: message.ordinal,
        role: message.role,
        timestamp: message.timestamp,
        ...snippetFor(message.text, ranges),
      }];
    });
    const offset = cursor?.offset || 0;
    const hits = matched.slice(offset, offset + limit);
    const nextOffset = offset + hits.length;
    const nextCursor = nextOffset < matched.length
      ? encodeCursor({ v: 1, revision: conversation.revision, queryHash: hash, offset: nextOffset })
      : null;
    return {
      provider: conversation.provider,
      conversationId: conversation.conversationId,
      revision: conversation.revision,
      query,
      hits,
      nextCursor,
    };
  }

  async context(fingerprint, input = {}) {
    const anchor = typeof input.anchor === "string" ? input.anchor : "";
    if (!anchor || anchor.length > 240) throw new TranscriptError(400, "訊息 anchor 格式不正確");
    const before = input.before === undefined ? 3 : Number(input.before);
    const after = input.after === undefined ? 3 : Number(input.after);
    if (![before, after].every((value) => Number.isInteger(value) && value >= 0 && value <= 20)) {
      throw new TranscriptError(400, "Context 範圍必須介於 0 到 20");
    }
    const conversation = await this.repository.load(fingerprint);
    if (input.revision && input.revision !== conversation.revision) {
      throw new TranscriptError(409, "Transcript 已更新，請重新搜尋");
    }
    const index = conversation.messages.findIndex((message) => message.anchor === anchor);
    if (index < 0) throw new TranscriptError(409, "搜尋結果已失效，請重新搜尋");
    return {
      provider: conversation.provider,
      conversationId: conversation.conversationId,
      revision: conversation.revision,
      anchor,
      messages: conversation.messages.slice(
        Math.max(0, index - before),
        Math.min(conversation.messages.length, index + after + 1),
      ),
    };
  }
}

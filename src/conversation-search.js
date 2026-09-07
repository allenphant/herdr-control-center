import { createHash } from "node:crypto";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, stat, writeFile } from "node:fs/promises";
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

function fingerprintForProvider(provider, conversationId) {
  const entry = Object.entries(PROVIDERS).find(([, value]) => value.provider === provider);
  if (!entry) throw new TranscriptError(422, "這個 agent transcript 尚未支援搜尋");
  return {
    agent: entry[1].agent,
    kind: "id",
    source: entry[0],
    value: conversationId,
  };
}

function globalLocationLabel(provider, filePath, root) {
  const relative = path.relative(root, filePath).split(path.sep).filter(Boolean);
  if (provider === "claude") return relative[0] || "Claude history";
  if (provider === "codex") return relative.slice(0, -1).join("/") || "Codex history";
  return "AGY history";
}

function sourceSignaturesEqual(left = [], right = []) {
  if (left.length !== right.length) return false;
  return left.every((source, index) =>
    source.relativePath === right[index].relativePath
      && source.size === right[index].size
      && source.mtimeMs === right[index].mtimeMs,
  );
}

function candidateSignature(candidate) {
  return `${candidate.provider}:${candidate.conversationId}:${JSON.stringify(candidate.signatures)}`;
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
  constructor({
    homeDirectory = os.homedir(),
    maxEntries = 12,
    discoveryTtlMs = 2_000,
    indexPath = path.join(homeDirectory, ".cache", "herdr-control-center", "conversation-index.json"),
  } = {}) {
    this.homeDirectory = homeDirectory;
    this.maxEntries = Math.max(1, maxEntries);
    this.discoveryTtlMs = Math.max(0, discoveryTtlMs);
    this.cache = new Map();
    this.locations = new Map();
    this.allLocations = null;
    this.indexPath = indexPath;
    this.globalIndexPromise = null;
    this.globalIndex = null;
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

  async listConversations(force = false) {
    if (
      !force &&
      this.allLocations &&
      Date.now() - this.allLocations.discoveredAt < this.discoveryTtlMs
    ) {
      return this.allLocations.items;
    }

    const conversations = new Map();
    const add = async (provider, conversationId, filePath, root) => {
      try {
        assertConversationId(conversationId);
        const info = await lstat(filePath);
        if (!info.isFile() || info.isSymbolicLink()) return;
        const key = `${provider}:${conversationId}`;
        const existing = conversations.get(key) || {
          provider,
          conversationId,
          fingerprint: fingerprintForProvider(provider, conversationId),
          updatedAtMs: 0,
          size: 0,
          locations: new Set(),
          signatures: [],
        };
        existing.updatedAtMs = Math.max(existing.updatedAtMs, info.mtimeMs);
        existing.size += info.size;
        existing.locations.add(globalLocationLabel(provider, filePath, root));
        existing.signatures.push({
          relativePath: path.relative(root, filePath),
          size: info.size,
          mtimeMs: info.mtimeMs,
        });
        conversations.set(key, existing);
      } catch {
        // One malformed or disappearing history file must not hide other conversations.
      }
    };

    const claudeRoot = path.join(this.homeDirectory, ".claude", "projects");
    const claudeProjects = await readdir(claudeRoot, { withFileTypes: true }).catch(() => []);
    for (const project of claudeProjects) {
      if (!project.isDirectory()) continue;
      const projectRoot = path.join(claudeRoot, project.name);
      const files = await readdir(projectRoot, { withFileTypes: true }).catch(() => []);
      for (const file of files) {
        if (!file.isFile() || !file.name.endsWith(".jsonl")) continue;
        await add("claude", file.name.slice(0, -6), path.join(projectRoot, file.name), claudeRoot);
      }
    }

    const codexRoot = path.join(this.homeDirectory, ".codex", "sessions");
    const codexFiles = await walkFiles(codexRoot, (name) => name.endsWith(".jsonl"));
    for (const filePath of codexFiles) {
      const match = path.basename(filePath).match(
        /-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i,
      );
      if (match) await add("codex", match[1], filePath, codexRoot);
    }

    const agyRoot = path.join(this.homeDirectory, ".gemini", "antigravity-cli", "brain");
    const agyConversations = await readdir(agyRoot, { withFileTypes: true }).catch(() => []);
    for (const conversation of agyConversations) {
      if (!conversation.isDirectory()) continue;
      const conversationId = conversation.name;
      const filePath = path.join(
        agyRoot,
        conversationId,
        ".system_generated",
        "logs",
        "transcript.jsonl",
      );
      await add("agy", conversationId, filePath, agyRoot);
    }

    const items = [...conversations.values()]
      .map((item) => ({
        ...item,
        locations: [...item.locations].sort(),
        signatures: item.signatures.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
        updatedAt: item.updatedAtMs ? new Date(item.updatedAtMs).toISOString() : null,
      }))
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs || left.conversationId.localeCompare(right.conversationId));
    this.allLocations = { discoveredAt: Date.now(), items };
    return items;
  }

  async readGlobalIndex() {
    try {
      const parsed = JSON.parse(await readFile(this.indexPath, "utf8"));
      if (parsed?.version !== 1 || !Array.isArray(parsed.conversations)) return new Map();
      return new Map(parsed.conversations
        .filter((item) => item?.key)
        .map((item) => [item.key, item]));
    } catch {
      return new Map();
    }
  }

  async writeGlobalIndex(items, skippedItems = []) {
    const directory = path.dirname(this.indexPath);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.indexPath}.${process.pid}.${Date.now()}.tmp`;
    const payload = {
      version: 1,
      generatedAt: new Date().toISOString(),
      conversations: [
        ...items.map((item) => ({
          key: `${item.provider}:${item.conversationId}`,
          sourceSignatures: item.signatures,
          conversation: item.conversation,
        })),
        ...skippedItems,
      ],
    };
    try {
      await writeFile(temporaryPath, `${JSON.stringify(payload)}\n`, { mode: 0o600, flag: "wx" });
      await rename(temporaryPath, this.indexPath);
    } catch (error) {
      await rename(temporaryPath, `${temporaryPath}.failed`).catch(() => {});
      throw error;
    }
  }

  async buildGlobalIndex() {
    if (this.globalIndexPromise) return this.globalIndexPromise;
    this.globalIndexPromise = (async () => {
      const candidates = await this.listConversations(true);
      const currentSignatures = candidates.map(candidateSignature).sort();
      if (
        this.globalIndex &&
        this.globalIndex.signatures.length === currentSignatures.length &&
        this.globalIndex.signatures.every((signature, index) => signature === currentSignatures[index])
      ) {
        return this.globalIndex;
      }
      const stored = await this.readGlobalIndex();
      const indexed = [];
      const skippedItems = [];
      let skipped = 0;
      let changed = stored.size !== candidates.length;

      for (const candidate of candidates) {
        const key = `${candidate.provider}:${candidate.conversationId}`;
        const cached = stored.get(key);
        if (cached && sourceSignaturesEqual(cached.sourceSignatures, candidate.signatures)) {
          if (cached.status === "skipped") {
            skipped += 1;
            skippedItems.push(cached);
            continue;
          }
          if (!cached.conversation) {
            changed = true;
            continue;
          }
          indexed.push({
            ...candidate,
            conversation: cached.conversation,
          });
          continue;
        }
        try {
          const conversation = await this.load(candidate.fingerprint);
          indexed.push({ ...candidate, conversation });
          changed = true;
        } catch {
          skipped += 1;
          skippedItems.push({
            key,
            status: "skipped",
            sourceSignatures: candidate.signatures,
          });
          changed = true;
        }
      }

      if (changed || !stored.size) {
        await this.writeGlobalIndex(indexed, skippedItems).catch(() => {});
      }
      this.globalIndex = { items: indexed, skipped, signatures: currentSignatures };
      return this.globalIndex;
    })();
    try {
      return await this.globalIndexPromise;
    } finally {
      this.globalIndexPromise = null;
    }
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

function normalizeLimit(value) {
  const limit = value === undefined ? 20 : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new TranscriptError(400, "搜尋 limit 必須介於 1 到 100");
  }
  return limit;
}

function matchedMessages(conversation, query, roles) {
  return conversation.messages.flatMap((message) => {
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
    const limit = normalizeLimit(input.limit);
    const conversation = await this.repository.load(fingerprint);
    const cursor = decodeCursor(input.cursor);
    const hash = queryHash(query, roles);
    if (cursor && (cursor.revision !== conversation.revision || cursor.queryHash !== hash)) {
      throw new TranscriptError(409, "Transcript 已更新或搜尋條件已改變，請重新搜尋");
    }
    const matched = matchedMessages(conversation, query, roles);
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

  async searchAll(input = {}) {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query || query.length > 200) {
      throw new TranscriptError(400, "搜尋文字必須為 1 到 200 個字元");
    }
    const roles = normalizeRoles(input.roles);
    const limit = normalizeLimit(input.limit);
    const provider = input.provider === undefined || input.provider === "all"
      ? null
      : input.provider;
    if (provider && !["agy", "claude", "codex"].includes(provider)) {
      throw new TranscriptError(400, "搜尋 agent 格式不正確");
    }

    const indexed = this.repository.buildGlobalIndex
      ? await this.repository.buildGlobalIndex()
      : { items: await this.repository.listConversations(), skipped: 0 };
    const candidates = indexed.items.filter((item) => !provider || item.provider === provider);
    const globalHash = queryHash(`${provider || "all"}\0${query}`, roles);
    const globalRevisionHash = createHash("sha256");
    for (const candidate of candidates) {
      globalRevisionHash.update(
        `${candidate.provider}\0${candidate.conversationId}\0${candidate.updatedAtMs}\0${candidate.size}\0`,
      );
    }
    const revision = globalRevisionHash.digest("hex");
    const cursor = decodeCursor(input.cursor);
    if (cursor && (cursor.revision !== revision || cursor.queryHash !== globalHash)) {
      throw new TranscriptError(409, "歷史 transcript 已更新或搜尋條件已改變，請重新搜尋");
    }

    const matches = [];
    let skipped = indexed.skipped || 0;
    let nextCandidate = 0;
    const workerCount = Math.min(8, candidates.length);
    const searchWorker = async () => {
      while (nextCandidate < candidates.length) {
        const candidate = candidates[nextCandidate];
        nextCandidate += 1;
        try {
        const conversation = candidate.conversation || await this.repository.load(candidate.fingerprint);
          for (const hit of matchedMessages(conversation, query, roles)) {
            matches.push({
              ...hit,
              agent: candidate.fingerprint.agent,
              conversationId: candidate.conversationId,
              fingerprint: candidate.fingerprint,
              locations: candidate.locations,
              conversationUpdatedAt: candidate.updatedAt,
              conversationRevision: conversation.revision,
            });
          }
        } catch {
          skipped += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: workerCount }, () => searchWorker()));
    matches.sort((left, right) => {
      const leftTime = Date.parse(left.timestamp || left.conversationUpdatedAt || "") || 0;
      const rightTime = Date.parse(right.timestamp || right.conversationUpdatedAt || "") || 0;
      return rightTime - leftTime || left.conversationId.localeCompare(right.conversationId);
    });

    const offset = cursor?.offset || 0;
    const hits = matches.slice(offset, offset + limit);
    const nextOffset = offset + hits.length;
    return {
      provider: provider || "all",
      query,
      revision,
      hits,
      nextCursor: nextOffset < matches.length
        ? encodeCursor({ v: 1, revision, queryHash: globalHash, offset: nextOffset })
        : null,
      conversationsScanned: candidates.length,
      skipped,
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

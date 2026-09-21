import { execFile } from "node:child_process";
import { open, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function clampPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

function epochToIso(value) {
  const milliseconds = Number(value) * 1_000;
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : null;
}

function dateToIso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function windowFromUsed(usedPercent, resetsAt) {
  const used = clampPercent(usedPercent);
  const reset = typeof resetsAt === "number" ? epochToIso(resetsAt) : dateToIso(resetsAt);
  if (used === null || !reset) return null;
  return { usedPercent: used, remainingPercent: 100 - used, resetsAt: reset };
}

function windowFromRemaining(remainingFraction, resetsAt) {
  const remaining = clampPercent(Number(remainingFraction) * 100);
  const reset = dateToIso(resetsAt);
  if (remaining === null || !reset) return null;
  return { usedPercent: 100 - remaining, remainingPercent: remaining, resetsAt: reset };
}

async function listJsonlFiles(root, limit = 2_000) {
  const files = [];
  const pending = [root];
  while (pending.length && files.length < limit) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const itemPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(itemPath);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(itemPath);
    }
  }
  return files;
}

async function readTail(filePath, maxBytes = 384 * 1024) {
  const info = await stat(filePath);
  const size = Math.min(info.size, maxBytes);
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(size);
    await handle.read(buffer, 0, size, Math.max(0, info.size - size));
    return { text: buffer.toString("utf8"), mtime: info.mtime };
  } finally {
    await handle.close();
  }
}

export function parseCodexRateLimits(text, fallbackObservedAt) {
  const lines = String(text).split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].includes('"rate_limits"')) continue;
    try {
      const record = JSON.parse(lines[index]);
      const rate = record?.payload?.rate_limits;
      if (!rate) continue;
      const fiveHour = windowFromUsed(rate.primary?.used_percent, rate.primary?.resets_at);
      const weekly = windowFromUsed(rate.secondary?.used_percent, rate.secondary?.resets_at);
      if (!fiveHour && !weekly) continue;
      return {
        status: "ready",
        plan: rate.plan_type || null,
        observedAt: dateToIso(record.timestamp) || fallbackObservedAt.toISOString(),
        source: "Codex session 事件",
        windows: { fiveHour, weekly },
      };
    } catch {
      // Ignore partial or unrelated JSONL records and continue toward older data.
    }
  }
  return null;
}

export function parseClaudeStatusline(payload, observedAt = new Date()) {
  const fiveHour = windowFromUsed(
    payload?.rate_limits?.five_hour?.used_percentage,
    payload?.rate_limits?.five_hour?.resets_at,
  );
  const weekly = windowFromUsed(
    payload?.rate_limits?.seven_day?.used_percentage,
    payload?.rate_limits?.seven_day?.resets_at,
  );
  if (!fiveHour && !weekly) return null;
  return {
    status: "ready",
    plan: null,
    observedAt: observedAt.toISOString(),
    source: "Claude statusline",
    windows: { fiveHour, weekly },
  };
}

export function parseClaudeUsageCache(payload, observedAt = new Date()) {
  const fiveHour = windowFromUsed(
    payload?.five_hour?.utilization,
    payload?.five_hour?.resets_at,
  );
  const weekly = windowFromUsed(
    payload?.seven_day?.utilization,
    payload?.seven_day?.resets_at,
  );
  if (!fiveHour && !weekly) return null;
  return {
    status: "ready",
    plan: null,
    observedAt: observedAt.toISOString(),
    source: "Claude usage API 快取",
    windows: { fiveHour, weekly },
  };
}

function keepFutureWindows(provider, now = Date.now()) {
  if (!provider?.windows) return provider;
  const future = (window) => window && new Date(window.resetsAt).getTime() > now ? window : null;
  const windows = {
    fiveHour: future(provider.windows.fiveHour),
    weekly: future(provider.windows.weekly),
  };
  return windows.fiveHour || windows.weekly ? { ...provider, windows } : null;
}

function keepFutureGroups(provider, now = Date.now()) {
  if (!provider?.groups) return provider;
  const groups = provider.groups.map((group) => keepFutureWindows(group, now)).filter(Boolean);
  return groups.length ? { ...provider, groups } : null;
}

// AGY's status-line hook receives an official `quota` map keyed by bucket
// (`gemini-5h`, `gemini-weekly`, `3p-5h`, `3p-weekly`). It needs no CSRF token,
// so the relayed snapshot is preferred over probing the language server.
export function parseAgyStatusline(payload, observedAt = new Date()) {
  const quota = payload?.quota;
  if (!quota || typeof quota !== "object") return null;
  const bucketWindow = (bucket) => {
    if (!bucket || typeof bucket !== "object") return null;
    const seconds = Number(bucket.reset_in_seconds);
    const resetsAt = bucket.reset_time
      || (Number.isFinite(seconds) && seconds > 0
        ? new Date(observedAt.getTime() + seconds * 1_000).toISOString()
        : null);
    return windowFromRemaining(bucket.remaining_fraction, resetsAt);
  };
  const groups = [
    {
      id: "gemini",
      label: "Gemini",
      windows: { fiveHour: bucketWindow(quota["gemini-5h"]), weekly: bucketWindow(quota["gemini-weekly"]) },
    },
    {
      id: "thirdParty",
      label: "Claude / GPT",
      windows: { fiveHour: bucketWindow(quota["3p-5h"]), weekly: bucketWindow(quota["3p-weekly"]) },
    },
  ].filter((group) => group.windows.fiveHour || group.windows.weekly);
  if (!groups.length) return null;
  return {
    status: "ready",
    plan: typeof payload.plan_tier === "string" && payload.plan_tier ? payload.plan_tier : null,
    observedAt: observedAt.toISOString(),
    source: "AGY statusline",
    groups,
  };
}

export function parseAgyQuotaSummary(payload) {
  const groups = (payload?.response?.groups || []).map((group) => {
    const id = /claude|gpt/i.test(group.displayName || "") ? "thirdParty" : "gemini";
    const windows = {};
    for (const bucket of group.buckets || []) {
      const quotaWindow = windowFromRemaining(bucket.remainingFraction, bucket.resetTime);
      if (bucket.window === "5h") windows.fiveHour = quotaWindow;
      if (bucket.window === "weekly") windows.weekly = quotaWindow;
    }
    return {
      id,
      label: id === "gemini" ? "Gemini" : "Claude / GPT",
      windows,
    };
  }).filter((group) => group.windows.fiveHour || group.windows.weekly);
  if (!groups.length) return null;
  return {
    status: "ready",
    plan: null,
    observedAt: new Date().toISOString(),
    source: "AGY 本機額度服務",
    groups,
  };
}

export class QuotaProvider {
  constructor({
    codexSessionsRoot = path.join(os.homedir(), ".codex", "sessions"),
    claudeSnapshotPath,
    claudeUsagePath = path.join(os.tmpdir(), "claude", "statusline-usage-cache.json"),
    agySnapshotPath,
    runner = execFileAsync,
    fetcher = fetch,
    cacheMs = 30_000,
  } = {}) {
    this.codexSessionsRoot = codexSessionsRoot;
    this.claudeSnapshotPath = claudeSnapshotPath;
    this.claudeUsagePath = claudeUsagePath;
    this.agySnapshotPath = agySnapshotPath;
    this.runner = runner;
    this.fetcher = fetcher;
    this.cacheMs = cacheMs;
    this.cached = null;
    this.inflight = null;
  }

  async readCodex() {
    const files = await listJsonlFiles(this.codexSessionsRoot);
    const recent = (await Promise.all(
      files.map(async (filePath) => ({ filePath, info: await stat(filePath).catch(() => null) })),
    )).filter((item) => item.info).sort((a, b) => b.info.mtimeMs - a.info.mtimeMs).slice(0, 16);
    for (const item of recent) {
      const tail = await readTail(item.filePath).catch(() => null);
      const parsed = tail && parseCodexRateLimits(tail.text, tail.mtime);
      if (parsed) return parsed;
    }
    return { status: "unavailable", reason: "尚未讀到 Codex 額度事件" };
  }

  async readClaude() {
    const readProvider = async (filePath, parser) => {
      if (!filePath) return null;
      try {
        const [text, info] = await Promise.all([readFile(filePath, "utf8"), stat(filePath)]);
        return keepFutureWindows(parser(JSON.parse(text), info.mtime));
      } catch {
        return null;
      }
    };
    const [usage, relay] = await Promise.all([
      readProvider(this.claudeUsagePath, parseClaudeUsageCache),
      readProvider(this.claudeSnapshotPath, parseClaudeStatusline),
    ]);
    if (usage || relay) {
      const preferred = usage || relay;
      return {
        ...preferred,
        windows: {
          fiveHour: usage?.windows?.fiveHour || relay?.windows?.fiveHour || null,
          weekly: usage?.windows?.weekly || relay?.windows?.weekly || null,
        },
      };
    }
    if (!this.claudeSnapshotPath && !this.claudeUsagePath) {
      return { status: "setup-required", reason: "尚未設定 Claude 額度來源" };
    }
    return { status: "waiting", reason: "等待 Claude statusline 或 usage 快取的第一筆資料" };
  }

  async discoverAgyPorts() {
    const { stdout } = await this.runner("ss", ["-ltnp"], {
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const portsByPid = new Map();
    for (const line of String(stdout).split(/\r?\n/)) {
      const processMatch = line.match(/\("agy",pid=(\d+)/);
      const portMatch = line.match(/127\.0\.0\.1:(\d+)/);
      if (!processMatch || !portMatch) continue;
      const pid = processMatch[1];
      if (!portsByPid.has(pid)) portsByPid.set(pid, []);
      portsByPid.get(pid).push(Number(portMatch[1]));
    }
    return portsByPid.values().next().value || [];
  }

  async readAgySnapshot() {
    if (!this.agySnapshotPath) return null;
    try {
      const [text, info] = await Promise.all([
        readFile(this.agySnapshotPath, "utf8"),
        stat(this.agySnapshotPath),
      ]);
      return keepFutureGroups(parseAgyStatusline(JSON.parse(text), info.mtime));
    } catch {
      return null;
    }
  }

  async readAgy() {
    const snapshot = await this.readAgySnapshot();
    if (snapshot) return snapshot;
    const ports = await this.discoverAgyPorts();
    if (!ports.length) return { status: "unavailable", reason: "目前沒有執行中的 AGY" };
    const endpoint = "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";
    let csrfRequired = false;
    for (const port of ports) {
      try {
        const response = await this.fetcher(`http://127.0.0.1:${port}${endpoint}`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "connect-protocol-version": "1",
          },
          body: JSON.stringify({ forceRefresh: true }),
          signal: AbortSignal.timeout(2_500),
        });
        // Observed on AGY 1.2.7: the language server requires a per-process CSRF
        // token that is never exposed outside the process, so 401 means "use the relay".
        if (response.status === 401) {
          csrfRequired = true;
          continue;
        }
        if (!response.ok) continue;
        const parsed = parseAgyQuotaSummary(await response.json());
        if (parsed) return parsed;
      } catch {
        // Each AGY process exposes one HTTPS and one HTTP loopback port.
      }
    }
    if (csrfRequired) {
      // With a relay path configured, a 401 only means no fresh snapshot has
      // arrived yet (no AGY session has emitted a statusline since install/reset).
      if (this.agySnapshotPath) {
        return { status: "waiting", reason: "等待 AGY session 送出第一筆 statusline（若尚未安裝 relay，請執行 node scripts/install-agy-quota-relay.mjs）" };
      }
      return {
        status: "setup-required",
        reason: "AGY 本機額度服務需要 CSRF token；請執行 node scripts/install-agy-quota-relay.mjs 啟用 statusline relay",
      };
    }
    return { status: "unavailable", reason: "AGY 本機額度服務暫時無法讀取" };
  }

  async getSnapshot({ force = false } = {}) {
    if (!force && this.cached && Date.now() - this.cached.cachedAt < this.cacheMs) {
      return this.cached.payload;
    }
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      const entries = await Promise.allSettled([
        this.readCodex(),
        this.readClaude(),
        this.readAgy(),
      ]);
      const fallback = (name) => ({ status: "unavailable", reason: `${name} 額度暫時無法讀取` });
      const payload = {
        providers: {
          codex: entries[0].status === "fulfilled" ? entries[0].value : fallback("Codex"),
          claude: entries[1].status === "fulfilled" ? entries[1].value : fallback("Claude"),
          agy: entries[2].status === "fulfilled" ? entries[2].value : fallback("AGY"),
        },
        readAt: new Date().toISOString(),
      };
      this.cached = { cachedAt: Date.now(), payload };
      return payload;
    })();
    try {
      return await this.inflight;
    } finally {
      this.inflight = null;
    }
  }
}

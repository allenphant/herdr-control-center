import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  HerdrClient,
  fingerprintFromAgent,
  fingerprintsEqual,
} from "./herdr-client.js";
import { ConversationSearchService } from "./conversation-search.js";
import { Scheduler } from "./scheduler.js";
import { QuotaProvider } from "./quota-provider.js";
import { resolvePaneSession, sameRepairCandidate } from "./session-repair.js";
import { JsonStore } from "./store.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const publicRoot = path.join(projectRoot, "public");
const statePath = process.env.STATE_PATH || path.join(projectRoot, "data", "state.json");
const defaultAttachmentRoot = process.env.ATTACHMENT_ROOT || path.join(projectRoot, "data", "attachments");
const defaultClaudeQuotaPath = process.env.CLAUDE_QUOTA_PATH || path.join(projectRoot, "data", "claude-quota.json");
const defaultClaudeUsagePath = process.env.CLAUDE_USAGE_PATH || path.join(os.tmpdir(), "claude", "statusline-usage-cache.json");
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4317);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

function securityHeaders() {
  return {
    "cache-control": "no-store",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(`${JSON.stringify(payload)}\n`);
}

function sendError(response, status, message, details) {
  sendJson(response, status, { error: message, details });
}

async function readJsonBody(request, maxBytes = 128 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, "請求內容過大");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const IMAGE_TYPES = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  const header = buffer.subarray(0, 6).toString("ascii");
  if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function previewLines(value) {
  return String(value || "")
    .replace(/\x1b(?:\[[0-?]*[ -\/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u202a-\u202e\u2066-\u2069]/g, "")
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() && !/^[─━═│┃┄┅┈┉┊┋╴╵╶╷┌┐└┘├┤┬┴┼\-_=\s]+$/u.test(line))
    .slice(0, 8)
    .map((line) => line.slice(0, 320));
}

function validatePaneTarget(url) {
  const sessionName = cleanText(url.searchParams.get("session"), 64);
  const paneId = cleanText(url.searchParams.get("pane"), 64);
  if (!/^[a-z0-9._-]+$/i.test(sessionName)) {
    throw new HttpError(400, "Herdr session 格式不正確");
  }
  if (!/^w[^\s/:?#&]+:p[^\s/?#&]+$/i.test(paneId)) {
    throw new HttpError(400, "Pane ID 格式不正確");
  }
  return { sessionName, paneId };
}

function validatePaneValues(sessionValue, paneValue) {
  const sessionName = cleanText(sessionValue, 64);
  const paneId = cleanText(paneValue, 64);
  if (!/^[a-z0-9._-]+$/i.test(sessionName)) {
    throw new HttpError(400, "Herdr session 格式不正確");
  }
  if (!/^w[^\s/:?#&]+:p[^\s/?#&]+$/i.test(paneId)) {
    throw new HttpError(400, "Pane ID 格式不正確");
  }
  return { sessionName, paneId };
}

function rejectConversationOverrides(input) {
  const forbidden = ["path", "transcriptPath", "provider"];
  if (forbidden.some((key) => Object.hasOwn(input || {}, key))) {
    throw new HttpError(400, "不得指定 transcript path 或 provider");
  }
}

function normalizeRect(rect) {
  const normalized = {
    x: Number(rect?.x),
    y: Number(rect?.y),
    width: Number(rect?.width),
    height: Number(rect?.height),
  };
  if (
    !Object.values(normalized).every(Number.isFinite) ||
    normalized.width <= 0 ||
    normalized.height <= 0
  ) {
    throw new HttpError(502, "Herdr pane layout 格式不正確");
  }
  return normalized;
}

function normalizePaneLayout(layout) {
  const area = normalizeRect(layout?.area);
  const panes = Array.isArray(layout?.panes)
    ? layout.panes.slice(0, 64).map((pane) => ({
        paneId: cleanText(pane?.pane_id, 64),
        focused: Boolean(pane?.focused),
        rect: normalizeRect(pane?.rect),
      }))
    : [];
  if (!panes.length || panes.some((pane) => !/^w[^\s/:?#&]+:p[^\s/?#&]+$/i.test(pane.paneId))) {
    throw new HttpError(502, "Herdr pane layout 缺少有效 pane");
  }
  return {
    area,
    panes,
    focusedPaneId: cleanText(layout?.focused_pane_id, 64) || null,
    tabId: cleanText(layout?.tab_id, 64) || null,
    workspaceId: cleanText(layout?.workspace_id, 64) || null,
    zoomed: Boolean(layout?.zoomed),
  };
}

function validateJobInput(input) {
  const sessionName = cleanText(input.sessionName, 64);
  const paneId = cleanText(input.paneId, 64);
  const message = cleanText(input.message, 8_000);
  const label = cleanText(input.label, 120);
  const recurrence = ["once", "daily", "weekly"].includes(input.recurrence)
    ? input.recurrence
    : "once";
  const dispatchMode = ["settled", "exact"].includes(input.dispatchMode)
    ? input.dispatchMode
    : "settled";
  const graceMinutes = Math.max(1, Math.min(1_440, Number(input.graceMinutes) || 360));
  const scheduledFor = new Date(input.scheduledFor);
  const expectedFingerprint = input.expectedFingerprint;

  if (!sessionName) throw new HttpError(400, "缺少 Herdr session");
  if (!/^w[^:]*:p.+$/i.test(paneId)) throw new HttpError(400, "Pane ID 格式不正確");
  if (!message) throw new HttpError(400, "請輸入要傳送的訊息");
  if (Number.isNaN(scheduledFor.getTime())) throw new HttpError(400, "排程時間格式不正確");
  if (scheduledFor.getTime() < Date.now() - 5_000) throw new HttpError(400, "排程時間已經過去");
  if (
    !expectedFingerprint ||
    typeof expectedFingerprint.source !== "string" ||
    typeof expectedFingerprint.value !== "string" ||
    !expectedFingerprint.source ||
    !expectedFingerprint.value
  ) {
    throw new HttpError(400, "缺少選取 pane 時的對話指紋");
  }

  return {
    sessionName,
    paneId,
    message,
    label,
    recurrence,
    dispatchMode,
    graceMinutes,
    scheduledFor: scheduledFor.toISOString(),
    expectedFingerprint: {
      agent: expectedFingerprint.agent || null,
      kind: expectedFingerprint.kind || null,
      source: expectedFingerprint.source,
      value: expectedFingerprint.value,
    },
  };
}

function validateAliasInput(input) {
  const { sessionName, paneId } = validatePaneValues(input?.sessionName, input?.paneId);
  const label = cleanText(input?.label, 120);
  const expectedFingerprint = input?.expectedFingerprint;
  if (
    !expectedFingerprint ||
    typeof expectedFingerprint.source !== "string" ||
    typeof expectedFingerprint.value !== "string" ||
    !expectedFingerprint.source ||
    !expectedFingerprint.value
  ) {
    throw new HttpError(400, "缺少選取 pane 時的對話指紋");
  }
  return {
    sessionName,
    paneId,
    label,
    expectedFingerprint: {
      agent: expectedFingerprint.agent || null,
      kind: expectedFingerprint.kind || null,
      source: expectedFingerprint.source,
      value: expectedFingerprint.value,
    },
  };
}

export async function createApplication({
  client = new HerdrClient(),
  store = new JsonStore(statePath),
  scheduler,
  quotaProvider = new QuotaProvider({
    claudeSnapshotPath: defaultClaudeQuotaPath,
    claudeUsagePath: defaultClaudeUsagePath,
  }),
  attachmentRoot = defaultAttachmentRoot,
  sessionResolver = resolvePaneSession,
  conversationSearch = new ConversationSearchService(),
} = {}) {
  await store.init();
  const activeScheduler = scheduler || new Scheduler({ client, store });
  const previewCache = new Map();
  const previewInflight = new Map();
  const layoutCache = new Map();
  const layoutInflight = new Map();
  let focusCache = null;
  let focusInflight = null;
  const herdrReadWaiters = [];
  let activeHerdrReads = 0;

  async function withHerdrReadSlot(operation) {
    if (activeHerdrReads >= 3) {
      if (herdrReadWaiters.length >= 32) {
        throw new HttpError(429, "Herdr 讀取請求過多，請稍後再試");
      }
      await new Promise((resolve) => herdrReadWaiters.push(resolve));
    }
    activeHerdrReads += 1;
    try {
      return await operation();
    } finally {
      activeHerdrReads -= 1;
      herdrReadWaiters.shift()?.();
    }
  }

  async function readPanePreview(url) {
    const target = validatePaneTarget(url);
    const key = `${target.sessionName}:${target.paneId}`;
    const cached = previewCache.get(key);
    if (cached && Date.now() - cached.cachedAt < 15_000) return cached.payload;
    if (previewInflight.has(key)) return previewInflight.get(key);

    const request = withHerdrReadSlot(async () => {
      try {
        const output = await client.readPane(target.sessionName, target.paneId, 18);
        const payload = {
          ...target,
          lines: previewLines(output),
          readAt: new Date().toISOString(),
        };
        previewCache.set(key, { cachedAt: Date.now(), payload });
        return payload;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(502, "Pane 內容暫時無法讀取");
      }
    });
    previewInflight.set(key, request);
    try {
      return await request;
    } finally {
      previewInflight.delete(key);
    }
  }

  async function readPaneLayout(url) {
    const target = validatePaneTarget(url);
    const key = `${target.sessionName}:${target.paneId}`;
    const cached = layoutCache.get(key);
    if (cached && Date.now() - cached.cachedAt < 5_000) return cached.payload;
    if (layoutInflight.has(key)) return layoutInflight.get(key);

    const request = withHerdrReadSlot(async () => {
      try {
        const layout = await client.getPaneLayout(target.sessionName, target.paneId);
        const payload = { ...target, layout: normalizePaneLayout(layout) };
        layoutCache.set(key, { cachedAt: Date.now(), payload });
        return payload;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(502, "Pane 空間配置暫時無法讀取");
      }
    });
    layoutInflight.set(key, request);
    try {
      return await request;
    } finally {
      layoutInflight.delete(key);
    }
  }

  async function readFocusState() {
    if (focusCache && Date.now() - focusCache.cachedAt < 350) {
      return focusCache.payload;
    }
    if (focusInflight) return focusInflight;

    focusInflight = withHerdrReadSlot(async () => {
      try {
        const current = await client.listFocusState();
        const payload = {
          sessions: (current?.sessions || []).slice(0, 32).map((session) => ({
            name: cleanText(session?.name, 64),
            focusedPaneId: cleanText(session?.focusedPaneId, 64) || null,
          })).filter((session) => session.name),
          readAt: current?.readAt || new Date().toISOString(),
        };
        focusCache = { cachedAt: Date.now(), payload };
        return payload;
      } catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(502, "Herdr focus 暫時無法讀取");
      }
    });
    try {
      return await focusInflight;
    } finally {
      focusInflight = null;
    }
  }

  async function repairPaneSession(sessionNameValue, paneIdValue) {
    const target = validatePaneValues(sessionNameValue, paneIdValue);
    const initialAgent = await client.getAgent(target.sessionName, target.paneId);
    const existingFingerprint = fingerprintFromAgent(initialAgent);
    if (existingFingerprint) {
      return { status: "already-verified", ...target, fingerprint: existingFingerprint };
    }

    const initialProcessInfo = await client.getPaneProcessInfo(
      target.sessionName,
      target.paneId,
    );
    const candidate = await sessionResolver(initialAgent, initialProcessInfo);
    if (candidate.status !== "repairable") {
      throw new HttpError(409, candidate.reason || "無法安全辨識這個 agent session");
    }

    const currentAgent = await client.getAgent(target.sessionName, target.paneId);
    const currentFingerprint = fingerprintFromAgent(currentAgent);
    if (currentFingerprint) {
      return { status: "already-verified", ...target, fingerprint: currentFingerprint };
    }
    if (currentAgent.agent !== initialAgent.agent) {
      throw new HttpError(409, "修復期間 pane occupant 已變更，請重新整理後再試");
    }

    const currentProcessInfo = await client.getPaneProcessInfo(
      target.sessionName,
      target.paneId,
    );
    const confirmedCandidate = await sessionResolver(currentAgent, currentProcessInfo);
    if (!sameRepairCandidate(candidate, confirmedCandidate)) {
      throw new HttpError(409, "修復期間 agent 程序已變更，未補登 session");
    }

    await client.reportAgentSession(target.sessionName, target.paneId, candidate);
    const verifiedAgent = await client.getAgent(target.sessionName, target.paneId);
    const fingerprint = fingerprintFromAgent(verifiedAgent);
    if (
      !fingerprint ||
      fingerprint.agent !== candidate.agent ||
      fingerprint.source !== candidate.source ||
      fingerprint.value !== candidate.sessionId
    ) {
      throw new HttpError(409, "Herdr 未能確認補登結果，請重新整理後再試");
    }
    return {
      status: "repaired",
      ...target,
      fingerprint,
      evidence: candidate.evidence,
    };
  }

  async function verifiedConversationFingerprint(input) {
    const target = validatePaneValues(input?.sessionName, input?.paneId);
    const expectedFingerprint = input?.expectedFingerprint;
    if (
      !expectedFingerprint
      || typeof expectedFingerprint.agent !== "string"
      || typeof expectedFingerprint.source !== "string"
      || typeof expectedFingerprint.value !== "string"
    ) {
      throw new HttpError(400, "缺少可驗證的 conversation fingerprint");
    }
    const agent = await client.getAgent(target.sessionName, target.paneId);
    const liveFingerprint = fingerprintFromAgent(agent);
    if (!liveFingerprint) {
      throw new HttpError(409, "這個 pane 沒有可驗證的 agent session，無法搜尋對話");
    }
    if (!fingerprintsEqual(expectedFingerprint, liveFingerprint)) {
      throw new HttpError(409, "選取後 agent session 已變更，請重新選擇 pane 再搜尋");
    }
    return liveFingerprint;
  }

  async function createAttachment(input) {
    const originalName = cleanText(input?.name, 160) || "image";
    const encoded = typeof input?.data === "string" ? input.data : "";
    if (!encoded || encoded.length > 11_200_000 || !/^[a-z0-9+/]+={0,2}$/i.test(encoded)) {
      throw new HttpError(400, "圖片資料格式不正確");
    }
    const buffer = Buffer.from(encoded, "base64");
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) {
      throw new HttpError(400, "圖片大小必須在 8 MB 以內");
    }
    const type = detectImageType(buffer);
    if (!type) throw new HttpError(400, "只支援 PNG、JPEG、WebP 或 GIF 圖片");

    const id = randomUUID();
    const filePath = path.join(attachmentRoot, `${id}${IMAGE_TYPES[type]}`);
    await mkdir(attachmentRoot, { recursive: true, mode: 0o700 });
    await writeFile(filePath, buffer, { flag: "wx", mode: 0o600 });
    return { id, name: originalName, type, size: buffer.length, path: filePath };
  }

  async function verifyAttachments(value) {
    const descriptors = Array.isArray(value) ? value.slice(0, 5) : [];
    if (Array.isArray(value) && value.length > 5) {
      throw new HttpError(400, "每個排程最多附加 5 張圖片");
    }
    const verified = [];
    for (const item of descriptors) {
      const id = cleanText(item?.id, 64);
      const type = cleanText(item?.type, 64);
      const extension = IMAGE_TYPES[type];
      if (!/^[0-9a-f-]{36}$/i.test(id) || !extension) {
        throw new HttpError(400, "圖片附件識別資料不正確");
      }
      const filePath = path.join(attachmentRoot, `${id}${extension}`);
      const info = await stat(filePath).catch(() => null);
      if (!info?.isFile() || info.size > 8 * 1024 * 1024) {
        throw new HttpError(409, "圖片附件已不存在，請重新選擇");
      }
      verified.push({
        id,
        name: cleanText(item?.name, 160) || `image${extension}`,
        type,
        size: info.size,
        path: filePath,
      });
    }
    return verified;
  }

  async function createJob(input) {
    const data = validateJobInput(input);
    const attachments = await verifyAttachments(input.attachments);
    const agent = await client.getAgent(data.sessionName, data.paneId);
    const expectedFingerprint = fingerprintFromAgent(agent);
    if (!expectedFingerprint) {
      throw new HttpError(409, "這個 pane 沒有可驗證的 agent session，無法安全排程");
    }
    if (!fingerprintsEqual(data.expectedFingerprint, expectedFingerprint)) {
      throw new HttpError(
        409,
        "選取後 agent session 已變更，請重新選擇 pane 再建立排程",
      );
    }

    const now = new Date().toISOString();
    const job = {
      id: randomUUID(),
      ...data,
      attachments,
      label: data.label || agent.terminal_title_stripped || data.paneId,
      expectedFingerprint: data.expectedFingerprint,
      targetSnapshot: {
        agent: agent.agent,
        cwd: agent.cwd || null,
        tabId: agent.tab_id || null,
        terminalTitle: agent.terminal_title_stripped || null,
        workspaceId: agent.workspace_id || null,
      },
      status: "scheduled",
      nextRunAt: data.scheduledFor,
      retryUntil: new Date(
        new Date(data.scheduledFor).getTime() + data.graceMinutes * 60_000,
      ).toISOString(),
      occurrenceCount: 0,
      lastAttemptAt: null,
      lastOutcome: "等待排程時間",
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await store.createJob(job);
    await activeScheduler.record(job, "scheduled", "排程已建立", {
      scheduledFor: job.scheduledFor,
      paneId: job.paneId,
    });
    return job;
  }

  async function setPaneAlias(input) {
    const data = validateAliasInput(input);
    const agent = await client.getAgent(data.sessionName, data.paneId);
    const liveFingerprint = fingerprintFromAgent(agent);
    if (!liveFingerprint) {
      throw new HttpError(409, "這個 pane 沒有可驗證的 agent session，無法儲存名稱");
    }
    if (!fingerprintsEqual(data.expectedFingerprint, liveFingerprint)) {
      throw new HttpError(409, "選取後 agent session 已變更，請重新選擇 pane 再命名");
    }
    const alias = await store.upsertAlias({
      label: data.label,
      fingerprint: data.expectedFingerprint,
      updatedAt: new Date().toISOString(),
    });
    return { alias };
  }

  async function actOnJob(id, action, input = {}) {
    return activeScheduler.withJobLock(id, async () => {
      const job = store.snapshot().jobs.find((item) => item.id === id);
      if (!job) return null;

      if (action === "edit-message" && ["scheduled", "deferred", "paused"].includes(job.status)) {
        const message = cleanText(input.message, 8_000);
        if (!message) throw new HttpError(400, "訊息內容不能空白");
        const updated = await store.updateJob(id, {
          message,
          lastOutcome: "訊息內容已更新",
        });
        await activeScheduler.record(updated, "edited", "訊息內容已更新");
        return updated;
      }

      if (action === "edit-job" && ["scheduled", "deferred", "paused"].includes(job.status)) {
        const message = cleanText(input.message, 8_000);
        const scheduledFor = new Date(input.scheduledFor);
        const currentScheduledFor = new Date(job.scheduledFor);
        if (!message) throw new HttpError(400, "訊息內容不能空白");
        if (Number.isNaN(scheduledFor.getTime())) {
          throw new HttpError(400, "排程時間格式不正確");
        }
        const timeChanged = Math.floor(scheduledFor.getTime() / 60_000) !==
          Math.floor(currentScheduledFor.getTime() / 60_000);
        if (timeChanged && scheduledFor.getTime() < Date.now() - 5_000) {
          throw new HttpError(400, "排程時間已經過去");
        }
        const timingUpdate = timeChanged ? {
          scheduledFor: scheduledFor.toISOString(),
          nextRunAt: scheduledFor.toISOString(),
          retryUntil: new Date(
            scheduledFor.getTime() + job.graceMinutes * 60_000,
          ).toISOString(),
          status: job.status === "deferred" ? "scheduled" : job.status,
        } : {};
        const updated = await store.updateJob(id, {
          message,
          ...timingUpdate,
          lastOutcome: "訊息與傳送時間已更新",
        });
        await activeScheduler.record(updated, "edited", "訊息與傳送時間已更新");
        return updated;
      }

      if (action === "cancel" && ["scheduled", "deferred", "paused"].includes(job.status)) {
        const updated = await store.updateJob(id, {
          status: "canceled",
          nextRunAt: null,
          lastOutcome: "排程已取消",
        });
        await activeScheduler.record(updated, "canceled", "排程已取消");
        return updated;
      }

      if (action === "pause" && ["scheduled", "deferred"].includes(job.status)) {
        const updated = await store.updateJob(id, {
          status: "paused",
          lastOutcome: "排程已暫停",
        });
        await activeScheduler.record(updated, "paused", "排程已暫停");
        return updated;
      }

      if (action === "resume" && job.status === "paused") {
        const nextRunAt = new Date(job.scheduledFor) > new Date()
          ? job.scheduledFor
          : new Date().toISOString();
        const updated = await store.updateJob(id, {
          status: "scheduled",
          nextRunAt,
          retryUntil: new Date(
            new Date(nextRunAt).getTime() + job.graceMinutes * 60_000,
          ).toISOString(),
          lastOutcome: "排程已恢復",
        });
        await activeScheduler.record(updated, "resumed", "排程已恢復");
        return updated;
      }

      if (action === "send-now" && ["scheduled", "deferred", "paused"].includes(job.status)) {
        const now = new Date().toISOString();
        const updated = await store.updateJob(id, {
          status: "scheduled",
          nextRunAt: now,
          retryUntil: new Date(Date.now() + job.graceMinutes * 60_000).toISOString(),
          lastOutcome: "等待立即傳送",
        });
        queueMicrotask(() => void activeScheduler.tick());
        return updated;
      }

      throw new HttpError(409, "這個排程目前不能執行該操作");
    });
  }

  async function apiHandler(request, response, url) {
    if (request.method === "GET" && url.pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        service: "Pane Relay",
        time: new Date().toISOString(),
      });
    }

    if (request.method === "GET" && url.pathname === "/api/topology") {
      const topology = await client.listTopology();
      return sendJson(response, 200, topology);
    }

    if (request.method === "GET" && url.pathname === "/api/focus") {
      return sendJson(response, 200, await readFocusState());
    }

    if (request.method === "GET" && url.pathname === "/api/quota") {
      const force = url.searchParams.get("refresh") === "1";
      return sendJson(response, 200, await quotaProvider.getSnapshot({ force }));
    }

    if (request.method === "GET" && url.pathname === "/api/pane-preview") {
      const preview = await readPanePreview(url);
      return sendJson(response, 200, preview);
    }

    if (request.method === "GET" && url.pathname === "/api/pane-layout") {
      const layout = await readPaneLayout(url);
      return sendJson(response, 200, layout);
    }

    if (request.method === "POST" && url.pathname === "/api/conversation/search") {
      const body = await readJsonBody(request);
      rejectConversationOverrides(body);
      const fingerprint = await verifiedConversationFingerprint(body);
      const input = {
        query: body.query,
        roles: body.roles,
        limit: body.limit,
        cursor: body.cursor,
      };
      return sendJson(response, 200, await conversationSearch.search(fingerprint, input));
    }

    if (request.method === "POST" && url.pathname === "/api/conversation/context") {
      const body = await readJsonBody(request);
      rejectConversationOverrides(body);
      const fingerprint = await verifiedConversationFingerprint(body);
      const input = {
        anchor: body.anchor,
        revision: body.revision,
        before: body.before,
        after: body.after,
      };
      return sendJson(response, 200, await conversationSearch.context(fingerprint, input));
    }

    if (request.method === "POST" && url.pathname === "/api/attachments") {
      const body = await readJsonBody(request, 12 * 1024 * 1024);
      const attachment = await createAttachment(body);
      return sendJson(response, 201, { attachment });
    }

    if (request.method === "GET" && url.pathname === "/api/state") {
      return sendJson(response, 200, store.snapshot());
    }

    if (request.method === "POST" && url.pathname === "/api/jobs") {
      const body = await readJsonBody(request);
      const job = await createJob(body);
      return sendJson(response, 201, { job });
    }

    if (request.method === "POST" && url.pathname === "/api/aliases") {
      const body = await readJsonBody(request);
      const result = await setPaneAlias(body);
      return sendJson(response, 200, result);
    }

    const repairMatch = url.pathname.match(/^\/api\/panes\/([^/]+)\/repair-session$/);
    if (request.method === "POST" && repairMatch) {
      const body = await readJsonBody(request);
      const repaired = await repairPaneSession(
        body.sessionName,
        decodeURIComponent(repairMatch[1]),
      );
      return sendJson(response, 200, repaired);
    }

    const actionMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/action$/);
    if (request.method === "POST" && actionMatch) {
      const body = await readJsonBody(request);
      const job = await actOnJob(decodeURIComponent(actionMatch[1]), body.action, body);
      if (!job) return sendError(response, 404, "找不到排程");
      return sendJson(response, 200, { job });
    }

    return sendError(response, 404, "找不到 API 路徑");
  }

  async function staticHandler(request, response, url) {
    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
    const filePath = path.resolve(publicRoot, requested);
    if (!filePath.startsWith(`${publicRoot}${path.sep}`)) {
      return sendError(response, 403, "禁止存取");
    }

    try {
      const content = await readFile(filePath);
      response.writeHead(200, {
        ...securityHeaders(),
        "cache-control": requested === "index.html" ? "no-store" : "public, max-age=300",
        "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch (error) {
      if (error.code === "ENOENT") return sendError(response, 404, "找不到頁面");
      throw error;
    }
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    try {
      if (url.pathname.startsWith("/api/")) {
        await apiHandler(request, response, url);
      } else if (["GET", "HEAD"].includes(request.method)) {
        await staticHandler(request, response, url);
      } else {
        sendError(response, 405, "不支援的 HTTP 方法");
      }
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : error.statusCode || 500;
      sendError(response, status, error?.message || "伺服器發生錯誤");
    }
  });

  return {
    server,
    scheduler: activeScheduler,
    store,
    client,
    quotaProvider,
    conversationSearch,
    listen(listenPort = port, listenHost = host) {
      activeScheduler.start();
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(listenPort, listenHost, () => resolve(server.address()));
      });
    },
    async close() {
      activeScheduler.stop();
      if (!server.listening) return;
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const app = await createApplication();
  const address = await app.listen();
  const shownHost = address.address === "127.0.0.1" ? "localhost" : address.address;
  console.log(`Pane Relay 已啟動：http://${shownHost}:${address.port}`);

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

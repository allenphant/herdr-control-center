import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import test from "node:test";
import { createApplication } from "../src/server.js";
import { JsonStore } from "../src/store.js";

const agent = {
  agent: "codex",
  agent_status: "idle",
  cwd: "/tmp/project",
  pane_id: "w1:p3",
  tab_id: "w1:t1",
  workspace_id: "w1",
  terminal_title_stripped: "Project",
  agent_session: {
    agent: "codex",
    kind: "id",
    source: "herdr:codex",
    value: "conversation-123",
  },
};

test("POST /api/panes/:pane/repair-session safely repairs a Codex resume session", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-repair-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const sessionId = "01a031b4-5500-7221-9006-1c3857b5e416";
  let reported = false;
  let reportInput;
  const unverifiedAgent = { ...agent, agent_session: undefined };
  const processInfo = {
    foreground_processes: [{ pid: 42, argv: ["codex", "resume", sessionId] }],
  };
  const client = {
    async getAgent() {
      return reported
        ? {
            ...unverifiedAgent,
            agent_session: {
              agent: "codex",
              kind: "id",
              source: "herdr:codex",
              value: sessionId,
            },
          }
        : unverifiedAgent;
    },
    async getPaneProcessInfo() {
      return processInfo;
    },
    async reportAgentSession(sessionName, paneId, input) {
      reportInput = { sessionName, paneId, input };
      reported = true;
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(
      `${baseUrl}/api/panes/${encodeURIComponent("w1:p3")}/repair-session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionName: "default" }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.status, "repaired");
    assert.equal(payload.fingerprint.value, sessionId);
    assert.deepEqual(reportInput, {
      sessionName: "default",
      paneId: "w1:p3",
      input: {
        agent: "codex",
        sessionId,
        source: "herdr:codex",
        processKey: `42:codex\u0000resume\u0000${sessionId}`,
        evidence: "codex-resume-argument",
        status: "repairable",
      },
    });
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("session repair refuses Codex when no unique resume UUID is available", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-repair-refuse-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  let reportCount = 0;
  const client = {
    async getAgent() {
      return { ...agent, agent_session: undefined };
    },
    async getPaneProcessInfo() {
      return { foreground_processes: [{ pid: 42, argv: ["codex"] }] };
    },
    async reportAgentSession() {
      reportCount += 1;
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(
      `${baseUrl}/api/panes/${encodeURIComponent("w1:p3")}/repair-session`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionName: "default" }),
      },
    );
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.match(payload.error, /resume UUID/);
    assert.equal(reportCount, 0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("POST /api/jobs captures the live pane conversation fingerprint", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-server-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const client = {
    async getAgent() {
      return agent;
    },
    async listTopology() {
      return { sessions: [], discoveredAt: new Date().toISOString() };
    },
    async sendPrompt() {},
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        label: "Project",
        message: "繼續工作",
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        recurrence: "once",
        dispatchMode: "settled",
        graceMinutes: 360,
        expectedFingerprint: agent.agent_session,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.job.paneId, "w1:p3");
    assert.equal(payload.job.expectedFingerprint.value, "conversation-123");
    assert.equal(app.store.snapshot().events[0].type, "scheduled");

    const renameResponse = await fetch(`${baseUrl}/api/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        expectedFingerprint: agent.agent_session,
        label: "Renamed Project",
      }),
    });
    assert.equal(renameResponse.status, 200);
    assert.equal(app.store.snapshot().jobs[0].label, "Renamed Project");

    const clearRenameResponse = await fetch(`${baseUrl}/api/aliases`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        expectedFingerprint: agent.agent_session,
        label: "",
      }),
    });
    assert.equal(clearRenameResponse.status, 200);
    assert.equal(app.store.snapshot().jobs[0].label, "Project");
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("POST /api/jobs creates an Enter-only one-shot without retaining text", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-enter-job-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const entered = [];
  const client = {
    async getAgent() {
      return { ...agent, agent_status: "working" };
    },
    async sendEnter(sessionName, paneId) {
      entered.push({ sessionName, paneId });
    },
    async sendPrompt() {
      throw new Error("Enter-only jobs must not call prompt");
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        label: "Project",
        deliveryMode: "enter",
        message: "這段文字絕不應被保存或送出",
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        recurrence: "once",
        dispatchMode: "settled",
        graceMinutes: 360,
        expectedFingerprint: agent.agent_session,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.job.deliveryMode, "enter");
    assert.equal(payload.job.message, "");
    assert.equal(payload.job.recurrence, "once");
    assert.equal(payload.job.dispatchMode, "exact");
    assert.equal(payload.job.graceMinutes, 1);

    await store.updateJob(payload.job.id, {
      nextRunAt: new Date(Date.now() - 1_000).toISOString(),
    });
    await app.scheduler.tick();

    assert.deepEqual(entered, [{ sessionName: "default", paneId: "w1:p3" }]);
    assert.equal(app.store.snapshot().jobs[0].status, "sent");
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("POST /api/jobs rejects attachments and recurrence for an Enter-only job", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-enter-invalid-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const client = { async getAgent() { return agent; } };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const base = {
    sessionName: "default",
    paneId: "w1:p3",
    deliveryMode: "enter",
    scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    expectedFingerprint: agent.agent_session,
  };

  try {
    const recurrenceResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...base, recurrence: "daily" }),
    });
    assert.equal(recurrenceResponse.status, 400);
    assert.match((await recurrenceResponse.json()).error, /不能設定重複/);

    const attachmentResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...base,
        attachments: [{ id: "not-allowed", name: "screen.png" }],
      }),
    });
    assert.equal(attachmentResponse.status, 400);
    assert.match((await attachmentResponse.json()).error, /不能附加圖片/);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("POST /api/aliases binds a local name to the verified conversation fingerprint", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-alias-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  let liveAgent = agent;
  const client = {
    async getAgent() {
      return liveAgent;
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const saveAlias = (label, expectedFingerprint = agent.agent_session) => fetch(
    `${baseUrl}/api/aliases`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        expectedFingerprint,
        label,
      }),
    },
  );

  try {
    const saveResponse = await saveAlias("HAI 年報整理");
    const saved = await saveResponse.json();
    assert.equal(saveResponse.status, 200);
    assert.equal(saved.alias.label, "HAI 年報整理");
    assert.equal(app.store.snapshot().aliases[0].fingerprint.value, "conversation-123");

    liveAgent = {
      ...agent,
      agent_session: { ...agent.agent_session, value: "conversation-456" },
    };
    const staleResponse = await saveAlias("不應套用");
    const stale = await staleResponse.json();
    assert.equal(staleResponse.status, 409);
    assert.match(stale.error, /session 已變更/);
    assert.equal(app.store.snapshot().aliases.length, 1);

    const clearResponse = await saveAlias("", liveAgent.agent_session);
    assert.equal(clearResponse.status, 200);
    assert.equal(app.store.snapshot().aliases.length, 1);

    liveAgent = agent;
    const clearOriginal = await saveAlias("");
    const cleared = await clearOriginal.json();
    assert.equal(clearOriginal.status, 200);
    assert.equal(cleared.alias, null);
    assert.equal(app.store.snapshot().aliases.length, 0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("image attachments are stored locally and bound to the scheduled job", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-attachment-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const attachmentRoot = path.join(directory, "attachments");
  const client = {
    async getAgent() {
      return agent;
    },
    async sendPrompt() {},
  };
  const app = await createApplication({ client, store, attachmentRoot });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const uploadResponse = await fetch(`${baseUrl}/api/attachments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "screen.png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      }),
    });
    const uploaded = await uploadResponse.json();
    assert.equal(uploadResponse.status, 201);
    assert.equal(uploaded.attachment.type, "image/png");

    const createResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        message: "請查看圖片後繼續",
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        expectedFingerprint: agent.agent_session,
        attachments: [uploaded.attachment],
      }),
    });
    const created = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(created.job.attachments[0].name, "screen.png");
    assert.equal(created.job.attachments[0].path.startsWith(attachmentRoot), true);

    const editResponse = await fetch(`${baseUrl}/api/jobs/${created.job.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "edit-message", message: "更新後的訊息內容" }),
    });
    const edited = await editResponse.json();
    assert.equal(editResponse.status, 200);
    assert.equal(edited.job.message, "更新後的訊息內容");

    await store.updateJob(created.job.id, { status: "deferred" });
    const changedTime = new Date(Date.now() + 10 * 60_000);
    const editJobResponse = await fetch(`${baseUrl}/api/jobs/${created.job.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "edit-job",
        message: "連同傳送時間一起更新",
        scheduledFor: changedTime.toISOString(),
      }),
    });
    const editedJob = await editJobResponse.json();
    assert.equal(editJobResponse.status, 200);
    assert.equal(editedJob.job.message, "連同傳送時間一起更新");
    assert.equal(editedJob.job.scheduledFor, changedTime.toISOString());
    assert.equal(editedJob.job.nextRunAt, changedTime.toISOString());
    assert.equal(editedJob.job.status, "scheduled");
    assert.equal(
      editedJob.job.retryUntil,
      new Date(changedTime.getTime() + editedJob.job.graceMinutes * 60_000).toISOString(),
    );
    const supplementalUpload = await fetch(`${baseUrl}/api/attachments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "supplemental.png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      }),
    });
    const supplemental = await supplementalUpload.json();
    const attachmentEditResponse = await fetch(`${baseUrl}/api/jobs/${created.job.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "edit-job",
        message: "連同補傳圖片一起更新",
        scheduledFor: changedTime.toISOString(),
        attachments: [editedJob.job.attachments[0], supplemental.attachment],
      }),
    });
    const attachmentEdited = await attachmentEditResponse.json();
    assert.equal(attachmentEditResponse.status, 200);
    assert.equal(attachmentEdited.job.attachments.length, 2);
    assert.equal(attachmentEdited.job.attachments[1].name, "supplemental.png");

    const pastResponse = await fetch(`${baseUrl}/api/jobs/${created.job.id}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "edit-job",
        message: "不應儲存",
        scheduledFor: new Date(Date.now() - 60_000).toISOString(),
      }),
    });
    assert.equal(pastResponse.status, 400);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("GET /api/pane-preview returns bounded cleaned terminal lines", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-preview-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const reads = [];
  const client = {
    async readPane(sessionName, paneId, lines) {
      reads.push({ sessionName, paneId, lines });
      return "\u001b[32m完成後摘要\u001b[0m\n────────\n  下一步：等待額度重置  \n";
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(
      `${baseUrl}/api/pane-preview?session=default&pane=w1%3Ap3`,
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(reads, [{ sessionName: "default", paneId: "w1:p3", lines: 18 }]);
    assert.deepEqual(payload.lines, ["完成後摘要", "  下一步：等待額度重置"]);

    const cachedResponse = await fetch(
      `${baseUrl}/api/pane-preview?session=default&pane=w1%3Ap3`,
    );
    assert.equal(cachedResponse.status, 200);
    assert.equal(reads.length, 1);

    const invalidResponse = await fetch(
      `${baseUrl}/api/pane-preview?session=default&pane=..%2Fsecret`,
    );
    assert.equal(invalidResponse.status, 400);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("GET /api/pane-layout returns normalized real pane rectangles", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-layout-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  let reads = 0;
  const client = {
    async getPaneLayout(sessionName, paneId) {
      reads += 1;
      assert.equal(sessionName, "default");
      assert.equal(paneId, "w1:p1");
      return {
        area: { x: 26, y: 1, width: 164, height: 43 },
        focused_pane_id: "w1:p3",
        panes: [
          { pane_id: "w1:p1", rect: { x: 26, y: 1, width: 82, height: 22 } },
          { pane_id: "w1:p2", rect: { x: 108, y: 1, width: 82, height: 22 } },
          { pane_id: "w1:p3", focused: true, rect: { x: 26, y: 23, width: 164, height: 21 } },
        ],
        tab_id: "w1:t1",
        workspace_id: "w1",
        zoomed: false,
      };
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const url = `${baseUrl}/api/pane-layout?session=default&pane=w1%3Ap1`;
    const response = await fetch(url);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.layout.area.width, 164);
    assert.equal(payload.layout.panes[1].paneId, "w1:p2");
    assert.equal(payload.layout.focusedPaneId, "w1:p3");

    const cachedResponse = await fetch(url);
    assert.equal(cachedResponse.status, 200);
    assert.equal(reads, 1);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("GET /api/focus exposes the global pane focus per Herdr session", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-focus-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  let reads = 0;
  const client = {
    async listFocusState() {
      reads += 1;
      return {
        sessions: [{ name: "default", focusedPaneId: "w1:p2" }],
        readAt: "2026-09-02T08:00:00.000Z",
      };
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/focus`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(payload.sessions, [{ name: "default", focusedPaneId: "w1:p2" }]);
    assert.equal(payload.readAt, "2026-09-02T08:00:00.000Z");

    await fetch(`${baseUrl}/api/focus`);
    assert.equal(reads, 1);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("GET /api/quota returns provider windows and supports forced refresh", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-quota-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const calls = [];
  const quotaProvider = {
    async getSnapshot(options) {
      calls.push(options);
      return {
        providers: {
          codex: {
            status: "ready",
            windows: {
              fiveHour: { remainingPercent: 94, resetsAt: "2026-09-02T10:50:17.000Z" },
            },
          },
        },
        readAt: "2026-09-02T06:00:00.000Z",
      };
    },
  };
  const app = await createApplication({ client: {}, store, quotaProvider });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/quota?refresh=1`);
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.providers.codex.windows.fiveHour.remainingPercent, 94);
    assert.deepEqual(calls, [{ force: true }]);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("POST /api/jobs rejects a pane selection whose conversation changed", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-stale-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const client = {
    async getAgent() {
      return agent;
    },
    async sendPrompt() {},
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        message: "繼續工作",
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        recurrence: "once",
        dispatchMode: "settled",
        graceMinutes: 360,
        expectedFingerprint: {
          ...agent.agent_session,
          value: "conversation-selected-earlier",
        },
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 409);
    assert.match(payload.error, /請重新選擇 pane/);
    assert.equal(app.store.snapshot().jobs.length, 0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("cancel cannot overtake an in-progress pane delivery", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-race-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  let releaseSend;
  let markSendStarted;
  const sendStarted = new Promise((resolve) => {
    markSendStarted = resolve;
  });
  const sendGate = new Promise((resolve) => {
    releaseSend = resolve;
  });
  let promptCount = 0;
  const client = {
    async getAgent() {
      return agent;
    },
    async sendPrompt() {
      promptCount += 1;
      markSendStarted();
      await sendGate;
    },
  };
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        message: "繼續工作",
        scheduledFor: new Date(Date.now() + 60_000).toISOString(),
        recurrence: "once",
        dispatchMode: "exact",
        graceMinutes: 360,
        expectedFingerprint: agent.agent_session,
      }),
    });
    const created = await createResponse.json();
    const jobId = created.job.id;

    const sendNowResponse = await fetch(`${baseUrl}/api/jobs/${jobId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send-now" }),
    });
    assert.equal(sendNowResponse.status, 200);
    await sendStarted;

    const cancelRequest = fetch(`${baseUrl}/api/jobs/${jobId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
    releaseSend();
    const cancelResponse = await cancelRequest;

    assert.equal(cancelResponse.status, 409);
    assert.equal(promptCount, 1);
    assert.equal(app.store.snapshot().jobs[0].status, "sent");
  } finally {
    releaseSend();
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

async function withApp(client, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-queue-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const app = await createApplication({ client, store });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const call = async (method, pathname, body) => {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, payload: await response.json() };
  };
  try {
    await run({ app, store, call });
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("saved message library supports create, update and delete through the API", async () => {
  const client = {
    async getAgent() { return agent; },
    async listTopology() { return { sessions: [], discoveredAt: new Date().toISOString() }; },
  };
  await withApp(client, async ({ store, call }) => {
    const empty = await call("POST", "/api/messages", { title: "空白", message: "   " });
    assert.equal(empty.status, 400);

    const created = await call("POST", "/api/messages", { title: "每日接續", message: "請接續原本工作" });
    assert.equal(created.status, 201);
    const id = created.payload.message.id;

    const state = await call("GET", "/api/state");
    assert.equal(state.payload.messages[0].title, "每日接續");

    const updated = await call("PUT", `/api/messages/${id}`, { title: "每日接續", message: "請繼續並整理結果" });
    assert.equal(updated.status, 200);
    assert.equal(store.snapshot().messages[0].message, "請繼續並整理結果");

    assert.equal((await call("DELETE", `/api/messages/${id}`)).status, 200);
    assert.equal((await call("DELETE", `/api/messages/${id}`)).status, 404);
    assert.equal(store.snapshot().messages.length, 0);
  });
});

function detachedJob(overrides = {}) {
  return {
    id: "job-detached",
    label: "Old pane",
    sessionName: "default",
    paneId: "w1:p0",
    deliveryMode: "prompt",
    message: "hi",
    recurrence: "daily",
    dispatchMode: "settled",
    graceMinutes: 360,
    expectedFingerprint: { agent: "codex", kind: "id", source: "herdr:codex", value: "gone-session" },
    status: "detached",
    scheduledFor: "2026-09-24T22:00:00.000Z",
    nextRunAt: null,
    retryUntil: "2026-09-25T04:00:00.000Z",
    occurrenceCount: 2,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-28T05:34:47.798Z",
    ...overrides,
  };
}

test("rebind moves a detached recurring job to a verified pane at its next future occurrence", async () => {
  const client = {
    async getAgent() { return agent; },
    async listTopology() { return { sessions: [], discoveredAt: new Date().toISOString() }; },
  };
  await withApp(client, async ({ store, call }) => {
    await store.createJob(detachedJob());

    const stale = await call("POST", "/api/jobs/job-detached/action", {
      action: "rebind",
      sessionName: "default",
      paneId: "w1:p3",
      expectedFingerprint: { ...agent.agent_session, value: "someone-else" },
    });
    assert.equal(stale.status, 409);
    assert.equal(store.snapshot().jobs[0].status, "detached");

    const sendNow = await call("POST", "/api/jobs/job-detached/action", { action: "send-now" });
    assert.equal(sendNow.status, 409);

    const rebound = await call("POST", "/api/jobs/job-detached/action", {
      action: "rebind",
      sessionName: "default",
      paneId: "w1:p3",
      expectedFingerprint: agent.agent_session,
    });
    assert.equal(rebound.status, 200);
    const job = rebound.payload.job;
    assert.equal(job.status, "scheduled");
    assert.equal(job.paneId, "w1:p3");
    assert.equal(job.expectedFingerprint.value, "conversation-123");
    assert.ok(new Date(job.nextRunAt) > new Date());
    assert.equal(new Date(job.nextRunAt).getUTCHours(), 22);
    assert.equal(job.recurrence, "daily");
    assert.equal(store.snapshot().events[0].type, "rebound");
  });
});

test("rebind of an overdue one-shot job pauses it instead of sending immediately", async () => {
  const client = {
    async getAgent() { return agent; },
    async listTopology() { return { sessions: [], discoveredAt: new Date().toISOString() }; },
  };
  await withApp(client, async ({ store, call }) => {
    await store.createJob(detachedJob({ recurrence: "once" }));
    const rebound = await call("POST", "/api/jobs/job-detached/action", {
      action: "rebind",
      sessionName: "default",
      paneId: "w1:p3",
      expectedFingerprint: agent.agent_session,
    });
    assert.equal(rebound.status, 200);
    assert.equal(rebound.payload.job.status, "paused");
    assert.equal(rebound.payload.job.nextRunAt, null);

    const canceled = await call("POST", "/api/jobs/job-detached/action", { action: "cancel" });
    assert.equal(canceled.status, 200);
  });
});

// fetch() silently drops a custom Host (and Origin) header, so a forged one needs node:http
function rawRequest(port, { method = "GET", path: requestPath = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: requestPath, headers, agent: false }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// A web page on another site can reach 127.0.0.1 (plain cross-site POST, or DNS rebinding).
test("requests with a foreign Host, a foreign Origin or a non-JSON body are refused", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-guard-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const app = await createApplication({ client: {}, store });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const port = address.port;
    const ok = await fetch(`${base}/api/health`);
    assert.equal(ok.status, 200);

    // DNS rebinding: the attacker's name resolves to 127.0.0.1, so the Host is theirs
    assert.equal(await rawRequest(port, { path: "/api/health", headers: { host: "evil.example" } }), 403);
    assert.equal(await rawRequest(port, { path: "/", headers: { host: `evil.example:${port}` } }), 403);

    // a page on another site posting to the service
    const json = JSON.stringify({ query: "x" });
    assert.equal(await rawRequest(port, {
      method: "POST", path: "/api/conversation/global-search", body: json,
      headers: { host: `127.0.0.1:${port}`, origin: "https://evil.example", "content-type": "application/json", "content-length": Buffer.byteLength(json) },
    }), 403);

    // text/plain is a "simple" cross-site request: no preflight, so it must not be accepted
    const plain = JSON.stringify({ name: "x.png", data: "AAAA" });
    assert.equal(await rawRequest(port, {
      method: "POST", path: "/api/attachments", body: plain,
      headers: { "content-type": "text/plain", "content-length": Buffer.byteLength(plain) },
    }), 415);

    // the page's own requests keep working: same Origin, JSON body
    const own = await rawRequest(port, {
      method: "POST", path: "/api/conversation/global-search", body: json,
      headers: { host: `127.0.0.1:${port}`, origin: base, "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(json) },
    });
    assert.notEqual(own, 403);
    assert.notEqual(own, 415);

    // localhost under another port (an SSH tunnel)
    assert.equal(await rawRequest(port, { path: "/api/health", headers: { host: "localhost:9999" } }), 200);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("job input is checked with the same strict session and pane rules as the other endpoints", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-jobinput-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  const app = await createApplication({ client: {}, store });
  const address = await app.listen(0, "127.0.0.1");
  const base = `http://127.0.0.1:${address.port}`;
  const post = (body) => fetch(`${base}/api/jobs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const valid = {
    sessionName: "main", paneId: "w1:p3", message: "hi",
    scheduledFor: new Date(Date.now() + 60_000).toISOString(),
    expectedFingerprint: { agent: "codex", kind: "id", source: "herdr:codex", value: "c-1" },
  };
  try {
    for (const bad of [
      { ...valid, sessionName: "--help" },
      { ...valid, sessionName: "a b" },
      { ...valid, paneId: "w1:p3 --flag" },
      { ...valid, paneId: "-x:p1" },
    ]) {
      const res = await post(bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

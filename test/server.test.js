import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

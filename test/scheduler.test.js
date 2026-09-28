import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Scheduler } from "../src/scheduler.js";
import { HerdrCommandError } from "../src/herdr-client.js";
import { JsonStore } from "../src/store.js";

const fingerprint = {
  agent: "codex",
  kind: "id",
  source: "herdr:codex",
  value: "conversation-123",
};

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    label: "Project pane",
    sessionName: "default",
    paneId: "w1:p3",
    message: "請繼續原本工作",
    recurrence: "once",
    dispatchMode: "settled",
    graceMinutes: 360,
    expectedFingerprint: fingerprint,
    status: "scheduled",
    scheduledFor: "2026-08-30T02:00:00.000Z",
    nextRunAt: "2026-08-30T02:00:00.000Z",
    retryUntil: "2026-08-30T08:00:00.000Z",
    occurrenceCount: 0,
    createdAt: "2026-08-29T20:00:00.000Z",
    updatedAt: "2026-08-29T20:00:00.000Z",
    ...overrides,
  };
}

async function withStore(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-test-"));
  const store = await new JsonStore(path.join(directory, "state.json")).init();
  try {
    await run(store);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("dispatch sends only to the pane with the same agent session fingerprint", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    const sent = [];
    const client = {
      async getAgent() {
        return {
          agent: "codex",
          agent_status: "idle",
          agent_session: fingerprint,
        };
      },
      async sendPrompt(sessionName, paneId, message) {
        sent.push({ sessionName, paneId, message });
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    assert.deepEqual(sent, [
      {
        sessionName: "default",
        paneId: "w1:p3",
        message: "請繼續原本工作",
      },
    ]);
    const snapshot = store.snapshot();
    assert.equal(snapshot.jobs[0].status, "sent");
    assert.equal(snapshot.jobs[0].occurrenceCount, 1);
    assert.equal(snapshot.events[0].type, "sent");
  });
});

test("Enter-only dispatch sends one key without a message or settled-state wait", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob({
      deliveryMode: "enter",
      message: "",
      dispatchMode: "exact",
      recurrence: "once",
      graceMinutes: 1,
    }));
    const sent = [];
    const client = {
      async getAgent() {
        return {
          agent: "codex",
          agent_status: "working",
          agent_session: fingerprint,
        };
      },
      async sendEnter(sessionName, paneId) {
        sent.push({ sessionName, paneId });
      },
      async sendPrompt() {
        throw new Error("Enter-only jobs must not send a prompt");
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    assert.deepEqual(sent, [{ sessionName: "default", paneId: "w1:p3" }]);
    const job = store.snapshot().jobs[0];
    assert.equal(job.status, "sent");
    assert.equal(job.message, "");
    assert.equal(job.nextRunAt, null);
    assert.match(job.lastOutcome, /一次 Enter/);
  });
});

test("dispatch appends local image paths to the prompt", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob({
      attachments: [{
        id: "image-1",
        name: "screen.png",
        type: "image/png",
        size: 120,
        path: "/private/pane-relay/image-1.png",
      }],
    }));
    let sentMessage = "";
    let sendOptions;
    const client = {
      async getAgent() {
        return {
          agent: "codex",
          agent_status: "idle",
          agent_session: fingerprint,
          state_change_seq: 42,
        };
      },
      async sendPrompt(_sessionName, _paneId, message, options) {
        sentMessage = message;
        sendOptions = options;
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    assert.match(sentMessage, /請繼續原本工作/);
    assert.match(sentMessage, /附加圖片/);
    assert.match(sentMessage, /\/private\/pane-relay\/image-1\.png/);
    assert.deepEqual(sendOptions, {
      expectedFingerprint: fingerprint,
      baselineStateChangeSeq: 42,
      retryEnterOnStall: true,
    });
  });
});

test("dispatch never sends to a changed pane occupant and waits for rebinding", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    let promptCount = 0;
    const client = {
      async getAgent() {
        return {
          agent: "codex",
          agent_status: "idle",
          agent_session: { ...fingerprint, value: "replacement-session" },
        };
      },
      async sendPrompt() {
        promptCount += 1;
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    assert.equal(promptCount, 0);
    assert.equal(store.snapshot().jobs[0].status, "detached");
    assert.equal(store.snapshot().jobs[0].nextRunAt, null);
    assert.match(store.snapshot().jobs[0].lastOutcome, /別的 agent session/);
  });
});

test("settled mode defers while the original agent is still working", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    let promptCount = 0;
    const client = {
      async getAgent() {
        return {
          agent: "codex",
          agent_status: "working",
          agent_session: fingerprint,
        };
      },
      async sendPrompt() {
        promptCount += 1;
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
      retryIntervalMs: 60_000,
    });

    await scheduler.tick();

    const job = store.snapshot().jobs[0];
    assert.equal(promptCount, 0);
    assert.equal(job.status, "deferred");
    assert.equal(job.nextRunAt, "2026-08-30T02:01:01.000Z");
  });
});

test("daily recurrence schedules the following occurrence after delivery", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob({ recurrence: "daily" }));
    const client = {
      async getAgent() {
        return {
          agent: "codex",
          agent_status: "done",
          agent_session: fingerprint,
        };
      },
      async sendPrompt() {},
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    const job = store.snapshot().jobs[0];
    assert.equal(job.status, "scheduled");
    assert.equal(job.nextRunAt, "2026-08-31T02:00:00.000Z");
    assert.equal(job.occurrenceCount, 1);
  });
});

test("store serializes concurrent job and event updates without losing data", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    await Promise.all([
      store.updateJob("job-1", { status: "paused" }),
      store.addEvent({
        id: "event-1",
        jobId: "job-1",
        type: "paused",
        message: "排程已暫停",
        createdAt: "2026-08-29T20:01:00.000Z",
      }),
    ]);

    const snapshot = store.snapshot();
    assert.equal(snapshot.jobs[0].status, "paused");
    assert.equal(snapshot.events[0].id, "event-1");
  });
});

// Captured from a real Herdr failure after a reboot (2026-09-28, data/state.json).
const REAL_AGENT_NOT_FOUND = '{"error":{"code":"agent_not_found","message":"agent target w1:p0 not found"},"id":"cli:agent:get"}';

function missingPaneError() {
  return new HerdrCommandError(REAL_AGENT_NOT_FOUND, { stderr: REAL_AGENT_NOT_FOUND });
}

test("a missing pane after reboot keeps the job waiting for rebinding instead of failing", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob({ recurrence: "daily" }));
    let promptCount = 0;
    const client = {
      async getAgent() {
        throw missingPaneError();
      },
      async listAgents() {
        return [];
      },
      async sendPrompt() {
        promptCount += 1;
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();
    await scheduler.tick();

    const job = store.snapshot().jobs[0];
    assert.equal(promptCount, 0);
    assert.equal(job.status, "detached");
    assert.equal(job.nextRunAt, null);
    assert.equal(job.recurrence, "daily");
    assert.equal(store.snapshot().events[0].type, "detached");
  });
});

test("a missing pane is relocated when exactly one pane holds the same conversation", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    const sent = [];
    const client = {
      async getAgent(sessionName, paneId) {
        if (paneId === "w1:p3") throw missingPaneError();
        return { agent: "codex", agent_status: "idle", agent_session: fingerprint, pane_id: paneId };
      },
      async listAgents() {
        return [
          { agent: "claude", pane_id: "w1:p1", agent_session: { agent: "claude", source: "herdr:claude", value: "other" } },
          { agent: "codex", pane_id: "w1:p9", tab_id: "w1:t2", agent_status: "idle", agent_session: fingerprint },
        ];
      },
      async sendPrompt(sessionName, paneId, message) {
        sent.push({ sessionName, paneId, message });
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    const job = store.snapshot().jobs[0];
    assert.deepEqual(sent.map((item) => item.paneId), ["w1:p9"]);
    assert.equal(job.status, "sent");
    assert.equal(job.paneId, "w1:p9");
    assert.ok(store.snapshot().events.some((event) => event.type === "relocated"));
  });
});

test("relocation refuses when more than one pane claims the same conversation", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    let promptCount = 0;
    const client = {
      async getAgent() {
        throw missingPaneError();
      },
      async listAgents() {
        return [
          { agent: "codex", pane_id: "w1:p8", agent_session: fingerprint },
          { agent: "codex", pane_id: "w1:p9", agent_session: fingerprint },
        ];
      },
      async sendPrompt() {
        promptCount += 1;
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    assert.equal(promptCount, 0);
    assert.equal(store.snapshot().jobs[0].status, "detached");
  });
});

test("other Herdr errors still fail the job", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob());
    const client = {
      async getAgent() {
        throw new HerdrCommandError("Herdr 指令執行失敗");
      },
      async listAgents() {
        throw new Error("must not relocate on unrelated errors");
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T02:00:01.000Z"),
    });

    await scheduler.tick();

    assert.equal(store.snapshot().jobs[0].status, "failed");
  });
});

test("a recurring job overdue past its window skips to the next future occurrence without sending", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob({
      recurrence: "daily",
      scheduledFor: "2026-08-30T02:00:00.000Z",
      nextRunAt: "2026-08-30T02:00:00.000Z",
      retryUntil: "2026-08-30T08:00:00.000Z",
    }));
    let promptCount = 0;
    const client = {
      async getAgent() {
        return { agent: "codex", agent_status: "idle", agent_session: fingerprint };
      },
      async sendPrompt() {
        promptCount += 1;
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-09-02T05:00:00.000Z"),
    });

    await scheduler.tick();
    await scheduler.tick();

    const job = store.snapshot().jobs[0];
    assert.equal(promptCount, 0);
    assert.equal(job.status, "scheduled");
    assert.equal(job.nextRunAt, "2026-09-03T02:00:00.000Z");
    assert.equal(job.retryUntil, "2026-09-03T08:00:00.000Z");
    assert.equal(store.snapshot().events[0].type, "missed");
  });
});

test("a recurring job that times out waiting for the agent rolls to the next occurrence", async () => {
  await withStore(async (store) => {
    await store.createJob(makeJob({ recurrence: "daily", status: "deferred" }));
    const client = {
      async getAgent() {
        return { agent: "codex", agent_status: "working", agent_session: fingerprint };
      },
    };
    const scheduler = new Scheduler({
      client,
      store,
      clock: () => new Date("2026-08-30T08:00:00.000Z"),
    });

    await scheduler.tick();

    const job = store.snapshot().jobs[0];
    assert.equal(job.status, "scheduled");
    assert.equal(job.nextRunAt, "2026-08-31T02:00:00.000Z");
  });
});

test("saved messages survive a store restart", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-messages-"));
  try {
    const filePath = path.join(directory, "state.json");
    const first = await new JsonStore(filePath).init();
    await first.createMessage({ id: "m1", title: "早安", message: "請接續", createdAt: "x", updatedAt: "x" });
    await first.updateMessage("m1", { message: "請接續原本工作" });

    const second = await new JsonStore(filePath).init();
    assert.equal(second.snapshot().messages.length, 1);
    assert.equal(second.snapshot().messages[0].message, "請接續原本工作");
    assert.equal(await second.deleteMessage("m1"), true);
    assert.equal(await second.deleteMessage("m1"), false);
    const third = await new JsonStore(filePath).init();
    assert.equal(third.snapshot().messages.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

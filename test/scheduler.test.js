import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Scheduler } from "../src/scheduler.js";
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

test("dispatch fails closed when the pane occupant changed", async () => {
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
    assert.equal(store.snapshot().jobs[0].status, "failed");
    assert.match(store.snapshot().jobs[0].lastOutcome, /session 已變更/);
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

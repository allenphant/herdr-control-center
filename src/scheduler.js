import { randomUUID } from "node:crypto";
import {
  fingerprintFromAgent,
  fingerprintsEqual,
} from "./herdr-client.js";

const SETTLED_STATES = new Set(["idle", "done"]);

function promptForJob(job) {
  const attachments = Array.isArray(job.attachments) ? job.attachments : [];
  if (!attachments.length) return job.message;
  const lines = attachments.map(
    (attachment, index) => `${index + 1}. ${attachment.path}`,
  );
  return `${job.message}\n\n附加圖片已儲存在本機，請開啟並一併檢視：\n${lines.join("\n")}`;
}

export function nextOccurrence(isoDate, recurrence) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  if (recurrence === "daily") date.setDate(date.getDate() + 1);
  else if (recurrence === "weekly") date.setDate(date.getDate() + 7);
  else return null;
  return date.toISOString();
}

export class Scheduler {
  constructor({
    client,
    store,
    clock = () => new Date(),
    tickIntervalMs = 1_000,
    retryIntervalMs = 60_000,
  }) {
    this.client = client;
    this.store = store;
    this.clock = clock;
    this.tickIntervalMs = tickIntervalMs;
    this.retryIntervalMs = retryIntervalMs;
    this.timer = null;
    this.ticking = false;
    this.jobLocks = new Map();
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.tickIntervalMs);
    void this.tick();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async record(job, type, message, details = {}) {
    await this.store.addEvent({
      id: randomUUID(),
      jobId: job.id,
      type,
      message,
      details,
      createdAt: this.clock().toISOString(),
    });
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const now = this.clock();
      const dueJobs = this.store
        .snapshot()
        .jobs.filter(
          (job) =>
            ["scheduled", "deferred"].includes(job.status) &&
            job.nextRunAt &&
            new Date(job.nextRunAt) <= now,
        );

      for (const job of dueJobs) {
        await this.dispatch(job.id);
      }
    } finally {
      this.ticking = false;
    }
  }

  async withJobLock(jobId, task) {
    const previous = this.jobLocks.get(jobId) || Promise.resolve();
    const operation = previous.catch(() => {}).then(task);
    let tracked;
    const release = () => {
      if (this.jobLocks.get(jobId) === tracked) this.jobLocks.delete(jobId);
    };
    tracked = operation.then(release, release);
    this.jobLocks.set(jobId, tracked);
    return operation;
  }

  async dispatch(jobId) {
    return this.withJobLock(jobId, () => this.dispatchUnlocked(jobId));
  }

  async dispatchUnlocked(jobId) {
    const job = this.store.snapshot().jobs.find((item) => item.id === jobId);
    if (!job || !["scheduled", "deferred"].includes(job.status)) return null;

    await this.store.updateJob(job.id, {
      status: "dispatching",
      lastAttemptAt: this.clock().toISOString(),
    });

    try {
      const agent = await this.client.getAgent(job.sessionName, job.paneId);
      const actualFingerprint = fingerprintFromAgent(agent);
      if (!fingerprintsEqual(job.expectedFingerprint, actualFingerprint)) {
        const message = "Pane 內的 agent session 已變更，已拒絕傳送";
        const failed = await this.store.updateJob(job.id, {
          status: "failed",
          lastOutcome: message,
          nextRunAt: null,
        });
        await this.record(job, "failed", message, {
          expected: job.expectedFingerprint,
          actual: actualFingerprint,
        });
        return failed;
      }

      const state = agent.agent_status || "unknown";
      if (job.dispatchMode === "settled" && !SETTLED_STATES.has(state)) {
        return this.defer(job, state);
      }

      const persisted = this.store.snapshot().jobs.find((item) => item.id === job.id);
      if (!persisted || persisted.status !== "dispatching") {
        return persisted || null;
      }

      const attachments = Array.isArray(job.attachments) ? job.attachments : [];
      await this.client.sendPrompt(
        job.sessionName,
        job.paneId,
        promptForJob(job),
        {
          expectedFingerprint: job.expectedFingerprint,
          baselineStateChangeSeq: agent.state_change_seq,
          retryEnterOnStall: attachments.length > 0,
        },
      );
      const sentAt = this.clock().toISOString();
      const following = nextOccurrence(job.scheduledFor, job.recurrence);
      const patch = following
        ? {
            status: "scheduled",
            scheduledFor: following,
            nextRunAt: following,
            retryUntil: new Date(
              new Date(following).getTime() + job.graceMinutes * 60_000,
            ).toISOString(),
          }
        : { status: "sent", nextRunAt: null };

      const updated = await this.store.updateJob(job.id, {
        ...patch,
        lastRunAt: sentAt,
        lastOutcome: "訊息已送達原 agent session",
        occurrenceCount: (job.occurrenceCount || 0) + 1,
      });
      await this.record(job, "sent", "訊息已送達原 agent session", {
        agentStatus: state,
        nextRunAt: following,
      });
      return updated;
    } catch (error) {
      const message = error?.message || "Herdr 傳送失敗";
      const failed = await this.store.updateJob(job.id, {
        status: "failed",
        lastOutcome: message,
        nextRunAt: null,
      });
      await this.record(job, "failed", message);
      return failed;
    }
  }

  async defer(job, agentStatus) {
    const now = this.clock();
    const retryUntil = new Date(job.retryUntil);
    if (Number.isNaN(retryUntil.getTime()) || now >= retryUntil) {
      const message = `等待 agent 就緒逾時，最後狀態為 ${agentStatus}`;
      const failed = await this.store.updateJob(job.id, {
        status: "failed",
        lastOutcome: message,
        nextRunAt: null,
      });
      await this.record(job, "failed", message, { agentStatus });
      return failed;
    }

    const nextRunAt = new Date(
      Math.min(now.getTime() + this.retryIntervalMs, retryUntil.getTime()),
    ).toISOString();
    const deferred = await this.store.updateJob(job.id, {
      status: "deferred",
      nextRunAt,
      lastOutcome: `等待 agent 就緒，目前為 ${agentStatus}`,
    });
    await this.record(job, "deferred", "Agent 尚未就緒，稍後重試", {
      agentStatus,
      nextRunAt,
    });
    return deferred;
  }
}

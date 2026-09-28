import { randomUUID } from "node:crypto";
import {
  fingerprintFromAgent,
  fingerprintsEqual,
  herdrErrorCode,
} from "./herdr-client.js";

const SETTLED_STATES = new Set(["idle", "done"]);
const RECURRING = new Set(["daily", "weekly"]);

function isRecurringJob(job) {
  return RECURRING.has(job?.recurrence) && job?.deliveryMode !== "enter";
}

function isEnterJob(job) {
  return job?.deliveryMode === "enter";
}

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

export function nextFutureOccurrence(isoDate, recurrence, now) {
  let candidate = isoDate;
  for (let index = 0; index < 1_000; index += 1) {
    candidate = nextOccurrence(candidate, recurrence);
    if (!candidate) return null;
    if (new Date(candidate) > now) return candidate;
  }
  return null;
}

export function timingForOccurrence(scheduledFor, graceMinutes) {
  return {
    scheduledFor,
    nextRunAt: scheduledFor,
    retryUntil: new Date(
      new Date(scheduledFor).getTime() + graceMinutes * 60_000,
    ).toISOString(),
  };
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
    let job = this.store.snapshot().jobs.find((item) => item.id === jobId);
    if (!job || !["scheduled", "deferred"].includes(job.status)) return null;

    const retryUntil = new Date(job.retryUntil);
    if (isRecurringJob(job) && !Number.isNaN(retryUntil.getTime()) && this.clock() > retryUntil) {
      return this.skipMissedOccurrence(job, "錯過傳送時段（服務或電腦未執行）");
    }

    await this.store.updateJob(job.id, {
      status: "dispatching",
      lastAttemptAt: this.clock().toISOString(),
    });

    try {
      const target = await this.resolveTarget(job);
      if (target.detached) {
        return this.detach(job, target.detached, target.details);
      }
      const { agent } = target;
      job = target.job;

      const state = agent.agent_status || "unknown";
      if (!isEnterJob(job) && job.dispatchMode === "settled" && !SETTLED_STATES.has(state)) {
        return this.defer(job, state);
      }

      const persisted = this.store.snapshot().jobs.find((item) => item.id === job.id);
      if (!persisted || persisted.status !== "dispatching") {
        return persisted || null;
      }

      const enterOnly = isEnterJob(job);
      if (enterOnly) {
        await this.client.sendEnter(job.sessionName, job.paneId);
      } else {
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
      }
      const sentAt = this.clock().toISOString();
      const following = enterOnly ? null : nextOccurrence(job.scheduledFor, job.recurrence);
      const sentMessage = enterOnly
        ? "已對原 pane 送出一次 Enter"
        : "訊息已送達原 agent session";
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
        lastOutcome: sentMessage,
        occurrenceCount: (job.occurrenceCount || 0) + 1,
      });
      await this.record(job, "sent", sentMessage, {
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

  async resolveTarget(job) {
    let agent = null;
    try {
      agent = await this.client.getAgent(job.sessionName, job.paneId);
    } catch (error) {
      if (herdrErrorCode(error) !== "agent_not_found") throw error;
    }
    const actual = agent ? fingerprintFromAgent(agent) : null;
    if (agent && fingerprintsEqual(job.expectedFingerprint, actual)) {
      return { agent, job };
    }

    const relocated = await this.findRelocatedAgent(job);
    if (relocated) {
      const updated = await this.store.updateJob(job.id, {
        paneId: relocated.pane_id,
        targetSnapshot: {
          ...(job.targetSnapshot || {}),
          tabId: relocated.tab_id || null,
          workspaceId: relocated.workspace_id || null,
          terminalTitle: relocated.terminal_title_stripped || job.targetSnapshot?.terminalTitle || null,
        },
      });
      await this.record(job, "relocated", `原 pane 已不存在，已依對話指紋改送到 ${relocated.pane_id}`, {
        from: job.paneId,
        to: relocated.pane_id,
      });
      return { agent: relocated, job: updated };
    }

    return {
      detached: agent
        ? "原 pane 內已換成別的 agent session，等待重新綁定"
        : "找不到原本的 pane（重開機後 pane 編號可能已改變），等待重新綁定",
      details: { expected: job.expectedFingerprint, actual, paneId: job.paneId },
    };
  }

  async findRelocatedAgent(job) {
    if (typeof this.client.listAgents !== "function") return null;
    let agents;
    try {
      agents = await this.client.listAgents(job.sessionName);
    } catch {
      return null;
    }
    const matches = (Array.isArray(agents) ? agents : []).filter((agent) =>
      agent?.pane_id && fingerprintsEqual(job.expectedFingerprint, fingerprintFromAgent(agent)),
    );
    return matches.length === 1 ? matches[0] : null;
  }

  async detach(job, message, details = {}) {
    const detached = await this.store.updateJob(job.id, {
      status: "detached",
      nextRunAt: null,
      lastOutcome: message,
    });
    await this.record(job, "detached", message, details);
    return detached;
  }

  async skipMissedOccurrence(job, reason) {
    const following = nextFutureOccurrence(job.scheduledFor, job.recurrence, this.clock());
    if (!following) {
      const failed = await this.store.updateJob(job.id, {
        status: "failed",
        nextRunAt: null,
        lastOutcome: reason,
      });
      await this.record(job, "failed", reason);
      return failed;
    }
    const message = `${reason}，已跳到下一次`;
    const updated = await this.store.updateJob(job.id, {
      status: "scheduled",
      ...timingForOccurrence(following, job.graceMinutes),
      lastOutcome: message,
    });
    await this.record(job, "missed", message, { missed: job.scheduledFor, nextRunAt: following });
    return updated;
  }

  async defer(job, agentStatus) {
    const now = this.clock();
    const retryUntil = new Date(job.retryUntil);
    if (Number.isNaN(retryUntil.getTime()) || now >= retryUntil) {
      if (isRecurringJob(job)) {
        return this.skipMissedOccurrence(job, `等待 agent 就緒逾時（最後狀態為 ${agentStatus}）`);
      }
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

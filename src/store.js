import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const EMPTY_STATE = Object.freeze({ version: 1, jobs: [], events: [], aliases: [], messages: [] });

function clone(value) {
  return structuredClone(value);
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = clone(EMPTY_STATE);
    this.writeQueue = Promise.resolve();
    this.mutationQueue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const content = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(content);
      this.state = {
        version: 1,
        jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
        events: Array.isArray(parsed.events) ? parsed.events : [],
        aliases: Array.isArray(parsed.aliases) ? parsed.aliases : [],
        messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.persist();
    }
    return this;
  }

  snapshot() {
    return clone(this.state);
  }

  async mutate(mutator) {
    const operation = this.mutationQueue.then(async () => {
      const next = clone(this.state);
      const result = await mutator(next);
      this.state = next;
      await this.persist();
      return clone(result);
    });
    this.mutationQueue = operation.catch(() => {});
    return operation;
  }

  async persist() {
    this.writeQueue = this.writeQueue.then(async () => {
      const tempPath = `${this.filePath}.tmp`;
      const content = `${JSON.stringify(this.state, null, 2)}\n`;
      await writeFile(tempPath, content, { mode: 0o600 });
      await rename(tempPath, this.filePath);
    });
    return this.writeQueue;
  }

  async createJob(job) {
    return this.mutate((state) => {
      state.jobs.unshift(job);
      return job;
    });
  }

  async updateJob(id, updater) {
    return this.mutate((state) => {
      const index = state.jobs.findIndex((job) => job.id === id);
      if (index === -1) return null;
      state.jobs[index] = {
        ...state.jobs[index],
        ...(typeof updater === "function" ? updater(state.jobs[index]) : updater),
        updatedAt: new Date().toISOString(),
      };
      return state.jobs[index];
    });
  }

  async updateJobLabelsForFingerprint(fingerprint, label) {
    return this.mutate((state) => {
      let updatedCount = 0;
      for (const job of state.jobs) {
        const same = job.expectedFingerprint?.agent === fingerprint.agent &&
          job.expectedFingerprint?.source === fingerprint.source &&
          job.expectedFingerprint?.value === fingerprint.value;
        if (!same) continue;
        job.label = label || job.targetSnapshot?.terminalTitle || job.paneId || job.label;
        job.updatedAt = new Date().toISOString();
        updatedCount += 1;
      }
      return updatedCount;
    });
  }

  async addEvent(event) {
    return this.mutate((state) => {
      state.events.unshift(event);
      state.events = state.events.slice(0, 500);
      return event;
    });
  }

  async createMessage(message) {
    return this.mutate((state) => {
      state.messages.unshift(message);
      return message;
    });
  }

  async updateMessage(id, patch) {
    return this.mutate((state) => {
      const index = state.messages.findIndex((message) => message.id === id);
      if (index === -1) return null;
      state.messages[index] = {
        ...state.messages[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      return state.messages[index];
    });
  }

  async deleteMessage(id) {
    return this.mutate((state) => {
      const before = state.messages.length;
      state.messages = state.messages.filter((message) => message.id !== id);
      return state.messages.length !== before;
    });
  }

  async upsertAlias(alias) {
    return this.mutate((state) => {
      state.aliases = state.aliases.filter((item) => !(
        item.fingerprint?.agent === alias.fingerprint.agent &&
        item.fingerprint?.source === alias.fingerprint.source &&
        item.fingerprint?.value === alias.fingerprint.value
      ));
      if (alias.label) state.aliases.unshift(alias);
      return alias.label ? alias : null;
    });
  }
}

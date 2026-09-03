import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const PROMPT_START_TIMEOUT_MS = 10_000;
const PROMPT_TRANSITION_TIMEOUT_MS = 5_000;
const PROMPT_TRANSITION_POLL_MS = 100;
const ENTER_FALLBACK_STATES = new Set(["idle", "done"]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function herdrErrorCode(error) {
  for (const raw of [error?.details?.stderr, error?.message]) {
    if (!raw) continue;
    try {
      const payload = JSON.parse(raw);
      if (payload?.error?.code) return payload.error.code;
    } catch {
      // Herdr may also return a plain-text CLI error.
    }
  }
  return null;
}

export class HerdrCommandError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "HerdrCommandError";
    this.details = details;
  }
}

export function fingerprintFromAgent(agent) {
  const session = agent?.agent_session;
  if (!session?.value || !session?.source) return null;

  return {
    agent: session.agent || agent.agent || null,
    kind: session.kind || null,
    source: session.source,
    value: session.value,
  };
}

export function fingerprintsEqual(expected, actual) {
  if (!expected || !actual) return false;
  return (
    expected.agent === actual.agent &&
    expected.source === actual.source &&
    expected.value === actual.value
  );
}

function unwrapResult(payload, field) {
  const result = payload?.result;
  if (!result || !(field in result)) {
    throw new HerdrCommandError(`Herdr 回應缺少 ${field}`, { payload });
  }
  return result[field];
}

export class HerdrClient {
  constructor({
    binary = process.env.HERDR_BIN || "herdr",
    timeoutMs = 12_000,
    runner = execFileAsync,
  } = {}) {
    this.binary = binary;
    this.timeoutMs = timeoutMs;
    this.runner = runner;
  }

  async run(args) {
    try {
      const { stdout, stderr } = await this.runner(this.binary, args, {
        encoding: "utf8",
        timeout: this.timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
      });
      const output = String(stdout || "").trim();
      if (!output) {
        throw new HerdrCommandError("Herdr 沒有回傳資料", { args, stderr });
      }
      return JSON.parse(output);
    } catch (error) {
      if (error instanceof HerdrCommandError) throw error;
      const stderr = String(error?.stderr || "").trim();
      throw new HerdrCommandError(
        stderr || error?.message || "Herdr 指令執行失敗",
        { args, code: error?.code, stderr },
      );
    }
  }

  async runText(args) {
    try {
      const { stdout, stderr } = await this.runner(this.binary, args, {
        encoding: "utf8",
        timeout: this.timeoutMs,
        maxBuffer: 64 * 1024,
      });
      const output = String(stdout || "").trim();
      if (!output) {
        throw new HerdrCommandError("Herdr pane 目前沒有可預覽的內容", {
          args,
          stderr,
        });
      }
      return output;
    } catch (error) {
      if (error instanceof HerdrCommandError) throw error;
      const stderr = String(error?.stderr || "").trim();
      throw new HerdrCommandError(
        stderr || error?.message || "Herdr pane 內容讀取失敗",
        { args, code: error?.code, stderr },
      );
    }
  }

  async runVoid(args) {
    try {
      await this.runner(this.binary, args, {
        encoding: "utf8",
        timeout: this.timeoutMs,
        maxBuffer: 64 * 1024,
      });
    } catch (error) {
      const stderr = String(error?.stderr || "").trim();
      throw new HerdrCommandError(
        stderr || error?.message || "Herdr 指令執行失敗",
        { args, code: error?.code, stderr },
      );
    }
  }

  withSession(sessionName, args) {
    return ["--session", sessionName, ...args];
  }

  async listSessions() {
    const payload = await this.run(["session", "list", "--json"]);
    if (!Array.isArray(payload.sessions)) {
      throw new HerdrCommandError("Herdr session 清單格式不正確", { payload });
    }
    return payload.sessions;
  }

  async listWorkspaces(sessionName) {
    const payload = await this.run(
      this.withSession(sessionName, ["workspace", "list"]),
    );
    return unwrapResult(payload, "workspaces");
  }

  async listTabs(sessionName, workspaceId) {
    const payload = await this.run(
      this.withSession(sessionName, [
        "tab",
        "list",
        "--workspace",
        workspaceId,
      ]),
    );
    return unwrapResult(payload, "tabs");
  }

  async listPanes(sessionName, workspaceId) {
    const payload = await this.run(
      this.withSession(sessionName, [
        "pane",
        "list",
        "--workspace",
        workspaceId,
      ]),
    );
    return unwrapResult(payload, "panes");
  }

  async getAgent(sessionName, paneId) {
    const payload = await this.run(
      this.withSession(sessionName, ["agent", "get", paneId]),
    );
    return unwrapResult(payload, "agent");
  }

  async getPaneProcessInfo(sessionName, paneId) {
    const payload = await this.run(
      this.withSession(sessionName, ["pane", "process-info", "--pane", paneId]),
    );
    return unwrapResult(payload, "process_info");
  }

  async reportAgentSession(sessionName, paneId, { agent, source, sessionId }) {
    await this.runVoid(
      this.withSession(sessionName, [
        "pane",
        "report-agent-session",
        paneId,
        "--source",
        source,
        "--agent",
        agent,
        "--agent-session-id",
        sessionId,
      ]),
    );
  }

  async sendPrompt(sessionName, paneId, message, {
    expectedFingerprint = null,
    baselineStateChangeSeq = null,
    retryEnterOnStall = false,
  } = {}) {
    try {
      return await this.run(
        this.withSession(sessionName, [
          "agent",
          "prompt",
          paneId,
          message,
          "--wait",
          "--until",
          "working",
          "--until",
          "blocked",
          "--until",
          "done",
          "--until",
          "idle",
          "--timeout",
          String(PROMPT_START_TIMEOUT_MS),
        ]),
      );
    } catch (error) {
      if (!retryEnterOnStall || herdrErrorCode(error) !== "agent_prompt_stalled") {
        throw error;
      }
    }

    const stalledAgent = await this.getAgent(sessionName, paneId);
    const stalledFingerprint = fingerprintFromAgent(stalledAgent);
    if (!fingerprintsEqual(expectedFingerprint, stalledFingerprint)) {
      throw new HerdrCommandError(
        "圖片提示停滯後 agent session 已變更，拒絕補送 Enter",
        { expectedFingerprint, actualFingerprint: stalledFingerprint },
      );
    }
    if (
      !Number.isInteger(baselineStateChangeSeq)
      || stalledAgent.state_change_seq !== baselineStateChangeSeq
      || !ENTER_FALLBACK_STATES.has(stalledAgent.agent_status)
    ) {
      throw new HerdrCommandError(
        "圖片提示停滯後 pane 狀態已變更，拒絕補送 Enter",
        {
          baselineStateChangeSeq,
          actualStateChangeSeq: stalledAgent.state_change_seq,
          agentStatus: stalledAgent.agent_status,
        },
      );
    }

    await this.run(
      this.withSession(sessionName, ["agent", "send-keys", paneId, "enter"]),
    );

    const deadline = Date.now() + PROMPT_TRANSITION_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const agent = await this.getAgent(sessionName, paneId);
      const actualFingerprint = fingerprintFromAgent(agent);
      if (!fingerprintsEqual(expectedFingerprint, actualFingerprint)) {
        throw new HerdrCommandError(
          "補送 Enter 後 agent session 已變更，無法確認送達",
          { expectedFingerprint, actualFingerprint },
        );
      }
      if (
        agent.state_change_seq > baselineStateChangeSeq
        && agent.agent_status !== "unknown"
      ) {
        return {
          result: {
            type: "agent_prompted",
            agent,
            recoveredWithEnter: true,
          },
        };
      }
      await delay(PROMPT_TRANSITION_POLL_MS);
    }

    throw new HerdrCommandError(
      "圖片提示補送 Enter 後未觀察到 agent lifecycle 變化",
      { paneId, baselineStateChangeSeq },
    );
  }

  async readPane(sessionName, paneId, lines = 18) {
    return this.runText(
      this.withSession(sessionName, [
        "pane",
        "read",
        paneId,
        "--source",
        "recent-unwrapped",
        "--lines",
        String(lines),
        "--format",
        "text",
      ]),
    );
  }

  async getPaneLayout(sessionName, paneId) {
    const payload = await this.run(
      this.withSession(sessionName, ["pane", "layout", "--pane", paneId]),
    );
    return unwrapResult(payload, "layout");
  }

  async getSnapshot(sessionName) {
    const payload = await this.run(
      this.withSession(sessionName, ["api", "snapshot"]),
    );
    return unwrapResult(payload, "snapshot");
  }

  async listFocusState() {
    const sessions = await this.listSessions();
    const runningSessions = sessions.filter((session) => session.running);
    const focus = await Promise.all(
      runningSessions.map(async (session) => {
        const snapshot = await this.getSnapshot(session.name);
        return {
          name: session.name,
          focusedPaneId: snapshot?.focused_pane_id || null,
        };
      }),
    );
    return { sessions: focus, readAt: new Date().toISOString() };
  }

  async listTopology() {
    const sessions = await this.listSessions();
    const runningSessions = sessions.filter((session) => session.running);

    const topology = await Promise.all(
      runningSessions.map(async (session) => {
        const workspaces = await this.listWorkspaces(session.name);
        const hydrated = await Promise.all(
          workspaces.map(async (workspace) => {
            const [tabs, panes] = await Promise.all([
              this.listTabs(session.name, workspace.workspace_id),
              this.listPanes(session.name, workspace.workspace_id),
            ]);
            return { ...workspace, tabs, panes };
          }),
        );
        return { ...session, workspaces: hydrated };
      }),
    );

    return {
      sessions: topology,
      discoveredAt: new Date().toISOString(),
    };
  }
}

import { readdir, readlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function executableName(process) {
  const executable = process?.argv?.[0] || process?.name || "";
  return path.basename(String(executable));
}

function agentProcesses(processInfo, agent) {
  const processes = Array.isArray(processInfo?.foreground_processes)
    ? processInfo.foreground_processes
    : [];
  return processes.filter((process) => executableName(process) === agent);
}

function processKey(process) {
  return `${process.pid}:${(process.argv || []).join("\u0000")}`;
}

async function listProcessLinks(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 1) return [];
  const fdRoot = `/proc/${pid}/fd`;
  const entries = await readdir(fdRoot).catch(() => []);
  const links = await Promise.all(
    entries.map((entry) => readlink(path.join(fdRoot, entry)).catch(() => null)),
  );
  return links.filter(Boolean);
}

function result(status, details = {}) {
  return { status, ...details };
}

export async function resolvePaneSession(agentInfo, processInfo, {
  openFiles = listProcessLinks,
  homeDirectory = os.homedir(),
} = {}) {
  const agent = agentInfo?.agent;
  if (!agent) return result("unavailable", { reason: "這個 pane 沒有可辨識的 agent" });

  if (agent === "codex") {
    const processes = agentProcesses(processInfo, "codex");
    if (processes.length !== 1) {
      return result("unavailable", { reason: "無法唯一辨識目前的 Codex 程序" });
    }
    const process = processes[0];
    const resumeIndex = process.argv.findIndex((value) => value === "resume");
    const sessionId = resumeIndex >= 0 ? process.argv[resumeIndex + 1] : null;
    if (!UUID_PATTERN.test(sessionId || "")) {
      return result("unavailable", {
        reason: "目前 Codex 不是以可驗證的 resume UUID 啟動",
      });
    }
    return result("repairable", {
      agent,
      sessionId,
      source: "herdr:codex",
      processKey: processKey(process),
      evidence: "codex-resume-argument",
    });
  }

  if (agent === "agy") {
    const processes = agentProcesses(processInfo, "agy");
    if (processes.length !== 1) {
      return result("unavailable", { reason: "無法唯一辨識目前的 AGY 程序" });
    }
    const process = processes[0];
    const presenceRoot = path.resolve(
      homeDirectory,
      ".gemini",
      "antigravity-cli",
      "presence",
    );
    const ids = new Set();
    for (const link of await openFiles(process.pid)) {
      const resolved = path.resolve(String(link));
      if (path.dirname(resolved) !== presenceRoot || path.extname(resolved) !== ".lock") continue;
      const sessionId = path.basename(resolved, ".lock");
      if (UUID_PATTERN.test(sessionId)) ids.add(sessionId);
    }
    if (ids.size !== 1) {
      return result("unavailable", {
        reason: ids.size
          ? "AGY 程序同時持有多個 conversation lock，無法安全判定"
          : "AGY 程序沒有可讀取的 conversation lock",
      });
    }
    return result("repairable", {
      agent,
      sessionId: [...ids][0],
      source: "herdr:antigravity_cli",
      processKey: processKey(process),
      evidence: "antigravity-presence-lock",
    });
  }

  return result("unavailable", {
    reason: `${agent} 尚未支援從 GUI 修復 session`,
  });
}

export function sameRepairCandidate(left, right) {
  return Boolean(
    left?.status === "repairable" &&
    right?.status === "repairable" &&
    left.agent === right.agent &&
    left.source === right.source &&
    left.sessionId === right.sessionId &&
    left.processKey === right.processKey,
  );
}

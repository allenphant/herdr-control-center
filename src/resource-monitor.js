import { readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const CLOCK_TICKS_PER_SECOND = 100;
const MAX_CGROUP_DIRECTORIES = 512;
const MAX_TOP_PROCESSES = 8;
const MAX_TOP_WORKLOAD_GROUPS = 8;
const MAX_WORKLOAD_CANDIDATES = 32;

export const RESOURCE_UNITS = Object.freeze([
  { id: "herdr", unit: "herdr.service", label: "Herdr" },
  { id: "screenshot-editor", unit: "screenshot-editor.service", label: "Screenshot Editor" },
  { id: "pane-relay", unit: "pane-relay.service", label: "Pane Relay" },
]);

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseByteValue(value) {
  if (value === undefined || value === null || value === "" || value === "max") return null;
  const number = finiteNumber(value);
  return number === null ? null : number;
}

export function parseMeminfo(text) {
  const values = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_]+):\s+(\d+)(?:\s+(\w+))?/);
    if (!match) continue;
    const number = Number(match[2]);
    if (!Number.isFinite(number)) continue;
    const multiplier = match[3]?.toLowerCase() === "kb" ? 1024
      : match[3]?.toLowerCase() === "mb" ? 1024 ** 2
        : match[3]?.toLowerCase() === "gb" ? 1024 ** 3
          : 1;
    values[match[1]] = number * multiplier;
  }
  return values;
}

export function parseLoadavg(text) {
  const values = String(text || "").trim().split(/\s+/).slice(0, 3).map(Number);
  return values.length === 3 && values.every(Number.isFinite)
    ? { one: values[0], five: values[1], fifteen: values[2] }
    : { one: null, five: null, fifteen: null };
}

export function parsePressure(text) {
  const result = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^(some|full)\s+(.+)$/);
    if (!match) continue;
    const values = {};
    for (const item of match[2].split(/\s+/)) {
      const [key, rawValue] = item.split("=", 2);
      const value = finiteNumber(rawValue);
      if (key && value !== null) values[key] = value;
    }
    result[match[1]] = values;
  }
  return result;
}

export function parseKeyValueNumbers(text) {
  const result = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const [key, rawValue] = line.trim().split(/\s+/, 2);
    const value = finiteNumber(rawValue);
    if (key && value !== null) result[key] = value;
  }
  return result;
}

export function parseSystemdProperties(text) {
  const result = {};
  for (const line of String(text || "").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    result[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return result;
}

export function parseProcStat(text) {
  const source = String(text || "");
  const open = source.indexOf("(");
  const close = source.lastIndexOf(")");
  if (open < 0 || close <= open) return null;
  const fields = source.slice(close + 1).trim().split(/\s+/);
  const utimeTicks = finiteNumber(fields[11]);
  const stimeTicks = finiteNumber(fields[12]);
  if (utimeTicks === null || stimeTicks === null) return null;
  return {
    name: source.slice(open + 1, close),
    state: fields[0] || null,
    utimeTicks,
    stimeTicks,
    totalCpuTicks: utimeTicks + stimeTicks,
  };
}

export function parsePsProcesses(text) {
  const processes = [];
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+(\d+)\s+([^\s]+)\s+(\S+)\s*(.*)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const rssKb = Number(match[3]);
    const cpuPercent = finiteNumber(match[4]);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(rssKb)) continue;
    processes.push({
      pid,
      name: match[2],
      commandLine: (match[6].trim() || match[2]).slice(0, 240),
      rssBytes: rssKb * 1024,
      cpuPercent,
      state: match[5]?.[0] || null,
    });
  }
  return processes;
}

export function groupProcessLabel(process) {
  const name = process?.name || "unknown";
  const commandLine = String(process?.commandLine || "");
  const script = commandLine.match(/(?:^|\s)(?:[^\s]*\/)?([A-Za-z0-9_.-]+\.(?:py|js|mjs|cjs|ts|sh|rb|go|php))(?:\s|$)/i)?.[1];
  if (script) return `${name} · ${script}`;
  const role = commandLine.match(/--type=([^\s]+)/)?.[1];
  return role ? `${name} · ${role}` : name;
}

export function aggregateProcessGroups(processes) {
  const groups = new Map();
  for (const process of processes || []) {
    const label = groupProcessLabel(process);
    const existing = groups.get(label) || {
      label,
      count: 0,
      rssBytes: 0,
      cpuPercent: null,
      commandLine: process.commandLine || label,
      largestProcessBytes: -1,
    };
    existing.count += 1;
    existing.rssBytes += process.rssBytes || 0;
    if (process.cpuPercent !== null && process.cpuPercent !== undefined) {
      existing.cpuPercent = (existing.cpuPercent || 0) + process.cpuPercent;
    }
    if ((process.rssBytes || 0) >= existing.largestProcessBytes) {
      existing.largestProcessBytes = process.rssBytes || 0;
      existing.commandLine = process.commandLine || label;
    }
    groups.set(label, existing);
  }
  return [...groups.values()].map(({ largestProcessBytes, ...group }) => ({
    ...group,
    cpuPercent: group.cpuPercent === null ? null : round(group.cpuPercent),
  }));
}

function parseStatusValue(text, key) {
  const match = String(text || "").match(new RegExp(`^${key}:\\s+(\\d+)(?:\\s+(\\w+))?`, "m"));
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return match[2]?.toLowerCase() === "kb" ? value * 1024 : value;
}

function parseProcessName(text) {
  return String(text || "").match(/^Name:\s+(.+)$/m)?.[1]?.trim() || null;
}

function cgroupPath(root, relativePath) {
  const normalized = String(relativePath || "").replace(/^\/+/, "");
  return path.join(root, ...normalized.split("/").filter(Boolean));
}

function parseCurrentCgroup(text) {
  for (const line of String(text || "").split(/\r?\n/)) {
    const match = line.match(/^0::(.*)$/);
    if (match) return match[1] || "/";
  }
  return null;
}

function parseProcessIds(text) {
  return String(text || "")
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function statusRank(status) {
  return { healthy: 0, warning: 1, critical: 2, unavailable: 3 }[status] ?? 3;
}

function maxStatus(...statuses) {
  return statuses.reduce((highest, status) =>
    statusRank(status) > statusRank(highest) ? status : highest, "healthy");
}

function hostStatus(host) {
  if (!host || host.totalBytes === null || host.availableBytes === null) return "unavailable";
  const availableRatio = host.availableBytes / host.totalBytes;
  const swapRatio = host.swapTotalBytes > 0 ? host.swapUsedBytes / host.swapTotalBytes : 0;
  if (availableRatio < 0.1 || swapRatio >= 0.8) return "critical";
  if (availableRatio < 0.2 || swapRatio >= 0.5) return "warning";
  return "healthy";
}

function workloadStatus(host) {
  const cpuPressure = finiteNumber(host?.pressure?.cpu?.some?.avg10);
  if (cpuPressure === null) return "unavailable";
  if (cpuPressure >= 80) return "critical";
  if (cpuPressure >= 50) return "warning";
  return "healthy";
}

function serviceStatus({ memoryBytes, memoryLimitBytes, memoryTotalBytes, events, systemd }) {
  if (!memoryBytes && !systemd) return "unavailable";
  if (
    (events?.oom_kill || 0) > 0
    || (events?.oom_group_kill || 0) > 0
    || systemd?.result === "oom-kill"
    || systemd?.activeState === "failed"
  ) return "critical";
  const ratio = memoryLimitBytes && memoryLimitBytes > 0
    ? memoryBytes / memoryLimitBytes
    : memoryTotalBytes && memoryTotalBytes > 0
      ? memoryBytes / memoryTotalBytes
      : 0;
  if (ratio >= 0.5 || (systemd?.restarts || 0) > 0) return "warning";
  return "healthy";
}

export class ResourceMonitor {
  constructor({
    procRoot = process.env.PROC_ROOT || "/proc",
    cgroupRoot = process.env.CGROUP_ROOT || "/sys/fs/cgroup",
    units = RESOURCE_UNITS,
    uid = typeof process.getuid === "function" ? process.getuid() : os.userInfo().uid,
    readFileFn = readFile,
    readdirFn = readdir,
    statFn = stat,
    commandRunner = execFileAsync,
    now = () => Date.now(),
  } = {}) {
    this.procRoot = procRoot;
    this.cgroupRoot = cgroupRoot;
    this.units = units;
    this.uid = uid;
    this.readFileFn = readFileFn;
    this.readdirFn = readdirFn;
    this.statFn = statFn;
    this.commandRunner = commandRunner;
    this.now = now;
    this.cgroupPaths = new Map();
    this.processCpu = new Map();
    this.cgroupCpu = new Map();
    this.lastSnapshot = null;
    this.lastSnapshotAt = 0;
  }

  async readText(filePath) {
    try {
      return await this.readFileFn(filePath, "utf8");
    } catch {
      return null;
    }
  }

  async directoryExists(directoryPath) {
    try {
      return (await this.statFn(directoryPath)).isDirectory();
    } catch {
      return false;
    }
  }

  async readHost() {
    const [meminfoText, loadavgText, memoryPressureText, cpuPressureText, ioPressureText] = await Promise.all([
      this.readText(path.join(this.procRoot, "meminfo")),
      this.readText(path.join(this.procRoot, "loadavg")),
      this.readText(path.join(this.procRoot, "pressure", "memory")),
      this.readText(path.join(this.procRoot, "pressure", "cpu")),
      this.readText(path.join(this.procRoot, "pressure", "io")),
    ]);
    const meminfo = parseMeminfo(meminfoText);
    const load = parseLoadavg(loadavgText);
    const totalBytes = meminfo.MemTotal ?? null;
    const availableBytes = meminfo.MemAvailable ?? null;
    const swapTotalBytes = meminfo.SwapTotal ?? 0;
    const swapFreeBytes = meminfo.SwapFree ?? 0;
    const host = {
      status: "unavailable",
      totalBytes,
      usedBytes: totalBytes !== null && availableBytes !== null
        ? Math.max(0, totalBytes - availableBytes)
        : null,
      availableBytes,
      availablePercent: totalBytes && availableBytes !== null
        ? round((availableBytes / totalBytes) * 100, 1)
        : null,
      swapTotalBytes,
      swapUsedBytes: Math.max(0, swapTotalBytes - swapFreeBytes),
      swapPercent: swapTotalBytes > 0 ? round(((swapTotalBytes - swapFreeBytes) / swapTotalBytes) * 100, 1) : 0,
      load,
      cpuCount: typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length,
      pressure: {
        memory: parsePressure(memoryPressureText),
        cpu: parsePressure(cpuPressureText),
        io: parsePressure(ioPressureText),
      },
    };
    host.status = hostStatus(host);
    return host;
  }

  async resolveCgroupPath(unit) {
    const cached = this.cgroupPaths.get(unit);
    if (cached && await this.directoryExists(cached)) return cached;

    const currentRelative = parseCurrentCgroup(await this.readText(path.join(this.procRoot, "self", "cgroup")));
    const candidates = [];
    if (currentRelative) {
      const appSliceMarker = "/app.slice/";
      const appSliceIndex = currentRelative.indexOf(appSliceMarker);
      if (appSliceIndex >= 0) {
        const appSlice = `${currentRelative.slice(0, appSliceIndex)}${appSliceMarker.slice(0, -1)}`;
        candidates.push(cgroupPath(this.cgroupRoot, `${appSlice}/${unit}`));
      }
      const parent = path.posix.dirname(currentRelative);
      candidates.push(cgroupPath(this.cgroupRoot, `${parent}/${unit}`));
    }

    const uid = String(this.uid);
    candidates.push(
      cgroupPath(this.cgroupRoot, `/user.slice/user-${uid}.slice/user@${uid}.service/app.slice/${unit}`),
      cgroupPath(this.cgroupRoot, `/user.slice/user-${uid}.slice/user@${uid}.service/${unit}`),
      cgroupPath(this.cgroupRoot, `/user.slice/user-${uid}.slice/${unit}`),
      cgroupPath(this.cgroupRoot, `/user.slice/${unit}`),
      cgroupPath(this.cgroupRoot, `/system.slice/${unit}`),
    );

    for (const candidate of [...new Set(candidates)]) {
      if (await this.directoryExists(candidate)) {
        this.cgroupPaths.set(unit, candidate);
        return candidate;
      }
    }
    return null;
  }

  async cgroupDirectories(root) {
    const directories = [root];
    for (let index = 0; index < directories.length && directories.length < MAX_CGROUP_DIRECTORIES; index += 1) {
      let entries;
      try {
        entries = await this.readdirFn(directories[index], { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
        directories.push(path.join(directories[index], entry.name));
        if (directories.length >= MAX_CGROUP_DIRECTORIES) break;
      }
    }
    return directories;
  }

  async cgroupProcessIds(root) {
    const directories = await this.cgroupDirectories(root);
    const contents = await Promise.all(
      directories.map((directory) => this.readText(path.join(directory, "cgroup.procs"))),
    );
    return [...new Set(contents.flatMap(parseProcessIds))];
  }

  async processInfo(pid, now) {
    const processRoot = path.join(this.procRoot, String(pid));
    const [statText, statusText, commandText] = await Promise.all([
      this.readText(path.join(processRoot, "stat")),
      this.readText(path.join(processRoot, "status")),
      this.readText(path.join(processRoot, "cmdline")),
    ]);
    if (!statText || !statusText) return null;
    const statInfo = parseProcStat(statText);
    if (!statInfo) return null;

    const previous = this.processCpu.get(pid);
    this.processCpu.set(pid, { ticks: statInfo.totalCpuTicks, at: now });
    const elapsedMs = previous ? now - previous.at : 0;
    const deltaTicks = previous ? statInfo.totalCpuTicks - previous.ticks : 0;
    const cpuPercent = previous && elapsedMs > 0 && deltaTicks >= 0
      ? round((deltaTicks * 100_000) / (CLOCK_TICKS_PER_SECOND * elapsedMs), 1)
      : null;
    const rawCommand = String(commandText || "").replaceAll("\0", " ").trim();
    return {
      pid,
      name: parseProcessName(statusText) || statInfo.name,
      commandLine: (rawCommand || statInfo.name).slice(0, 240),
      rssBytes: parseStatusValue(statusText, "VmRSS") ?? 0,
      cpuPercent,
      state: statInfo.state,
    };
  }

  async topProcesses(pids, now) {
    const infos = (await Promise.all(pids.map((pid) => this.processInfo(pid, now)))).filter(Boolean);
    infos.sort((left, right) => right.rssBytes - left.rssBytes || right.pid - left.pid);
    return infos.slice(0, MAX_TOP_PROCESSES);
  }

  async readPsSnapshot(sortKey) {
    try {
      const { stdout } = await this.commandRunner(
        "ps",
        ["-eo", "pid=,comm=,rss=,pcpu=,stat=,args=", `--sort=-${sortKey}`],
        { encoding: "utf8", timeout: 1_500, maxBuffer: 512 * 1024 },
      );
      const processes = parsePsProcesses(stdout).filter((process) => !process.commandLine.startsWith("ps -eo "));
      return {
        processCount: processes.length,
        processes: processes.slice(0, MAX_WORKLOAD_CANDIDATES),
      };
    } catch {
      return null;
    }
  }

  async readHostWorkloads(host, now) {
    const [cpuSnapshot, memorySnapshot] = await Promise.all([
      this.readPsSnapshot("pcpu"),
      this.readPsSnapshot("rss"),
    ]);
    if (!cpuSnapshot && !memorySnapshot) {
      return {
        status: "unavailable",
        processCount: null,
        sampleReady: false,
        topCpuProcesses: [],
        topMemoryProcesses: [],
        topCpuGroups: [],
        topMemoryGroups: [],
      };
    }

    const candidates = [...new Map([
      ...(cpuSnapshot?.processes || []),
      ...(memorySnapshot?.processes || []),
    ].map((process) => [process.pid, process])).values()];
    const infos = (await Promise.all(candidates.map(async (candidate) => {
      const info = await this.processInfo(candidate.pid, now);
      return info
        ? { ...info, cpuPercent: info.cpuPercent ?? candidate.cpuPercent }
        : candidate;
    }))).filter(Boolean);
    const topMemoryProcesses = [...infos]
      .sort((left, right) => right.rssBytes - left.rssBytes || right.pid - left.pid)
      .slice(0, MAX_TOP_PROCESSES);
    const topCpuProcesses = infos
      .filter((process) => process.cpuPercent !== null)
      .sort((left, right) => right.cpuPercent - left.cpuPercent || right.rssBytes - left.rssBytes)
      .slice(0, MAX_TOP_PROCESSES);
    const groups = aggregateProcessGroups(infos);
    const topMemoryGroups = [...groups]
      .sort((left, right) => right.rssBytes - left.rssBytes || right.count - left.count)
      .slice(0, MAX_TOP_WORKLOAD_GROUPS);
    const topCpuGroups = groups
      .filter((group) => group.cpuPercent !== null)
      .sort((left, right) => right.cpuPercent - left.cpuPercent || right.rssBytes - left.rssBytes)
      .slice(0, MAX_TOP_WORKLOAD_GROUPS);

    return {
      status: workloadStatus(host),
      processCount: Math.max(cpuSnapshot?.processCount || 0, memorySnapshot?.processCount || 0),
      sampleReady: topCpuProcesses.length > 0,
      topCpuProcesses,
      topMemoryProcesses,
      topCpuGroups,
      topMemoryGroups,
    };
  }

  async readSystemdStatus(unit) {
    const properties = [
      "ActiveState",
      "SubState",
      "MainPID",
      "MemoryCurrent",
      "MemoryPeak",
      "MemoryMax",
      "TasksCurrent",
      "NRestarts",
      "Result",
    ];
    try {
      const { stdout } = await this.commandRunner(
        "systemctl",
        ["--user", "show", unit, `--property=${properties.join(",")}`, "--no-pager"],
        { encoding: "utf8", timeout: 1_500, maxBuffer: 64 * 1024 },
      );
      const values = parseSystemdProperties(stdout);
      return {
        activeState: values.ActiveState || null,
        subState: values.SubState || null,
        mainPid: finiteNumber(values.MainPID),
        memoryCurrentBytes: parseByteValue(values.MemoryCurrent),
        memoryPeakBytes: parseByteValue(values.MemoryPeak),
        memoryMaxBytes: parseByteValue(values.MemoryMax),
        tasksCurrent: finiteNumber(values.TasksCurrent),
        restarts: finiteNumber(values.NRestarts) ?? 0,
        result: values.Result || null,
      };
    } catch {
      return null;
    }
  }

  async readCgroup(unitDefinition, host, now) {
    const cgroupPathValue = await this.resolveCgroupPath(unitDefinition.unit);
    if (!cgroupPathValue) {
      const systemd = await this.readSystemdStatus(unitDefinition.unit);
      return {
        ...unitDefinition,
        status: systemd ? serviceStatus({ systemd }) : "unavailable",
        cgroupPath: null,
        memoryBytes: systemd?.memoryCurrentBytes ?? null,
        memoryPeakBytes: systemd?.memoryPeakBytes ?? null,
        memoryLimitBytes: systemd?.memoryMaxBytes ?? null,
        processCount: null,
        tasks: systemd?.tasksCurrent ?? null,
        cpuPercent: null,
        events: {},
        systemd,
        topProcesses: [],
      };
    }

    const [memoryBytesText, memoryPeakText, memoryMaxText, eventsText, cpuStatText, pids] = await Promise.all([
      this.readText(path.join(cgroupPathValue, "memory.current")),
      this.readText(path.join(cgroupPathValue, "memory.peak")),
      this.readText(path.join(cgroupPathValue, "memory.max")),
      this.readText(path.join(cgroupPathValue, "memory.events")),
      this.readText(path.join(cgroupPathValue, "cpu.stat")),
      this.cgroupProcessIds(cgroupPathValue),
    ]);
    const memoryBytes = parseByteValue(memoryBytesText?.trim());
    const memoryPeakBytes = parseByteValue(memoryPeakText?.trim());
    const memoryLimitBytes = parseByteValue(memoryMaxText?.trim());
    const events = parseKeyValueNumbers(eventsText);
    const cpuStat = parseKeyValueNumbers(cpuStatText);
    const previousCpu = this.cgroupCpu.get(unitDefinition.unit);
    this.cgroupCpu.set(unitDefinition.unit, { usageUsec: cpuStat.usage_usec, at: now });
    const elapsedMs = previousCpu ? now - previousCpu.at : 0;
    const deltaUsec = previousCpu && cpuStat.usage_usec !== undefined
      ? cpuStat.usage_usec - previousCpu.usageUsec
      : 0;
    const cpuPercent = previousCpu && elapsedMs > 0 && deltaUsec >= 0
      ? round((deltaUsec * 100) / (elapsedMs * 1_000), 1)
      : null;
    const systemd = await this.readSystemdStatus(unitDefinition.unit);
    return {
      ...unitDefinition,
      status: serviceStatus({
        memoryBytes,
        memoryLimitBytes,
        memoryTotalBytes: host.totalBytes,
        events,
        systemd,
      }),
      cgroupPath: cgroupPathValue,
      memoryBytes,
      memoryPeakBytes,
      memoryLimitBytes,
      processCount: pids.length,
      tasks: systemd?.tasksCurrent ?? pids.length,
      cpuPercent,
      events,
      systemd,
      topProcesses: await this.topProcesses(pids, now),
    };
  }

  alertsFor(host, services) {
    const alerts = [];
    if (host.status === "critical") {
      alerts.push({ level: "critical", code: "host-memory", message: "主機可用記憶體或 Swap 已進入危險狀態" });
    } else if (host.status === "warning") {
      alerts.push({ level: "warning", code: "host-pressure", message: "主機記憶體資源開始緊張" });
    }
    for (const service of services) {
      const oomKills = service.events?.oom_kill || 0;
      const oomGroups = service.events?.oom_group_kill || 0;
      if (oomKills || oomGroups || service.systemd?.result === "oom-kill") {
        alerts.push({
          level: "critical",
          code: "service-oom",
          service: service.id,
          message: `${service.label} 曾發生 OOM kill（${oomKills + oomGroups}）`,
        });
      } else if ((service.systemd?.restarts || 0) > 0) {
        alerts.push({
          level: "warning",
          code: "service-restarted",
          service: service.id,
          message: `${service.label} 已重啟 ${service.systemd.restarts} 次`,
        });
      }
    }
    return alerts;
  }

  async snapshot() {
    const now = this.now();
    if (this.lastSnapshot && now - this.lastSnapshotAt < 4_000) return this.lastSnapshot;
    const host = await this.readHost();
    const services = await Promise.all(this.units.map((unit) => this.readCgroup(unit, host, now)));
    host.workloads = await this.readHostWorkloads(host, now);
    for (const [pid, sample] of this.processCpu) {
      if (now - sample.at > 120_000) this.processCpu.delete(pid);
    }
    const alerts = this.alertsFor(host, services);
    const snapshot = {
      readAt: new Date(now).toISOString(),
      status: maxStatus(host.status, ...services.map((service) => service.status)),
      host,
      services,
      alerts,
    };
    this.lastSnapshot = snapshot;
    this.lastSnapshotAt = now;
    return snapshot;
  }
}

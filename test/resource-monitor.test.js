import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApplication } from "../src/server.js";
import { JsonStore } from "../src/store.js";
import {
  aggregateProcessGroups,
  groupProcessLabel,
  parseKeyValueNumbers,
  parseLoadavg,
  parseMeminfo,
  parsePressure,
  parseProcStat,
  parsePsProcesses,
  parseSystemdProperties,
} from "../src/resource-monitor.js";

test("resource monitor groups background processes into readable workloads", () => {
  assert.equal(groupProcessLabel({ name: "python", commandLine: "python /srv/pom/server.py --port 8088" }), "python · server.py");
  assert.equal(groupProcessLabel({ name: "chrome", commandLine: "chrome --type=renderer --lang=zh-TW" }), "chrome · renderer");
  assert.deepEqual(aggregateProcessGroups([
    { name: "python", commandLine: "python /srv/pom/server.py --port 8088", rssBytes: 100, cpuPercent: 120 },
    { name: "python", commandLine: "python /srv/pom/server.py --port 8088", rssBytes: 50, cpuPercent: 35 },
    { name: "chrome", commandLine: "chrome --type=renderer", rssBytes: 80, cpuPercent: null },
  ]), [
    { label: "python · server.py", count: 2, rssBytes: 150, cpuPercent: 155, commandLine: "python /srv/pom/server.py --port 8088" },
    { label: "chrome · renderer", count: 1, rssBytes: 80, cpuPercent: null, commandLine: "chrome --type=renderer" },
  ]);
});

test("resource monitor parses low-cost ps workload snapshots", () => {
  assert.deepEqual(parsePsProcesses(" 42 python 1200 155.5 Sl python /srv/pom/server.py --port 8088\n 7 chrome 800 0.0 S chrome --type=renderer\n"), [
    {
      pid: 42,
      name: "python",
      commandLine: "python /srv/pom/server.py --port 8088",
      rssBytes: 1200 * 1024,
      cpuPercent: 155.5,
      state: "S",
    },
    {
      pid: 7,
      name: "chrome",
      commandLine: "chrome --type=renderer",
      rssBytes: 800 * 1024,
      cpuPercent: 0,
      state: "S",
    },
  ]);
});

test("resource monitor parsers normalize Linux resource files", () => {
  assert.deepEqual(parseMeminfo("MemTotal:       1024 kB\nMemAvailable:    512 kB\nSwapTotal:         0 kB"), {
    MemTotal: 1024 * 1024,
    MemAvailable: 512 * 1024,
    SwapTotal: 0,
  });
  assert.deepEqual(parseLoadavg("12.34 5.67 1.23 4/100 12345"), {
    one: 12.34,
    five: 5.67,
    fifteen: 1.23,
  });
  assert.deepEqual(parsePressure("some avg10=2.50 avg60=1.25 avg300=0.50 total=42\nfull avg10=0.10 total=3"), {
    some: { avg10: 2.5, avg60: 1.25, avg300: 0.5, total: 42 },
    full: { avg10: 0.1, total: 3 },
  });
  assert.deepEqual(parseKeyValueNumbers("oom 2\noom_kill 1\n"), { oom: 2, oom_kill: 1 });
  assert.deepEqual(parseSystemdProperties("ActiveState=active\nNRestarts=3\n"), {
    ActiveState: "active",
    NRestarts: "3",
  });

  const statFields = Array.from({ length: 40 }, () => "0");
  statFields[0] = "S";
  statFields[11] = "100";
  statFields[12] = "50";
  assert.deepEqual(parseProcStat(`42 (python (worker)) ${statFields.join(" ")}`), {
    name: "python (worker)",
    state: "S",
    utimeTicks: 100,
    stimeTicks: 50,
    totalCpuTicks: 150,
  });
});

test("GET /api/resources returns a read-only resource snapshot", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-resources-"));
  const snapshot = {
    readAt: "2026-09-11T03:00:00.000Z",
    status: "critical",
    host: { status: "critical", availableBytes: 1024, swapPercent: 100 },
    services: [{ id: "herdr", status: "warning", memoryBytes: 2048 }],
    alerts: [{ level: "critical", code: "host-memory", message: "主機資源緊張" }],
  };
  const app = await createApplication({
    store: new JsonStore(path.join(directory, "state.json")),
    client: {},
    resourceMonitor: { async snapshot() { return snapshot; } },
  });
  const address = await app.listen(0, "127.0.0.1");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/resources`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), snapshot);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

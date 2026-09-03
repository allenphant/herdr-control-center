import assert from "node:assert/strict";
import test from "node:test";
import { resolvePaneSession, sameRepairCandidate } from "../src/session-repair.js";

test("resolvePaneSession extracts a Codex resume UUID from the live process", async () => {
  const resolved = await resolvePaneSession(
    { agent: "codex" },
    {
      foreground_processes: [
        {
          pid: 42,
          argv: ["codex", "resume", "01a031b4-5500-7221-9006-1c3857b5e416"],
        },
      ],
    },
  );

  assert.equal(resolved.status, "repairable");
  assert.equal(resolved.source, "herdr:codex");
  assert.equal(resolved.sessionId, "01a031b4-5500-7221-9006-1c3857b5e416");
  assert.equal(sameRepairCandidate(resolved, { ...resolved }), true);
});

test("resolvePaneSession refuses a Codex process without an explicit resume UUID", async () => {
  const resolved = await resolvePaneSession(
    { agent: "codex" },
    { foreground_processes: [{ pid: 42, argv: ["codex"] }] },
  );

  assert.equal(resolved.status, "unavailable");
  assert.match(resolved.reason, /resume UUID/);
});

test("resolvePaneSession extracts the one AGY presence lock held by the process", async () => {
  const resolved = await resolvePaneSession(
    { agent: "agy" },
    { foreground_processes: [{ pid: 77, argv: ["agy"] }] },
    {
      homeDirectory: "/home/tester",
      async openFiles(pid) {
        assert.equal(pid, 77);
        return [
          "/home/tester/.gemini/antigravity-cli/log/cli.log",
          "/home/tester/.gemini/antigravity-cli/presence/b9645e63-6dd0-443d-b0cc-5792d3fb3044.lock",
        ];
      },
    },
  );

  assert.equal(resolved.status, "repairable");
  assert.equal(resolved.source, "herdr:antigravity_cli");
  assert.equal(resolved.sessionId, "b9645e63-6dd0-443d-b0cc-5792d3fb3044");
});

test("resolvePaneSession refuses ambiguous AGY presence locks", async () => {
  const resolved = await resolvePaneSession(
    { agent: "agy" },
    { foreground_processes: [{ pid: 77, argv: ["agy"] }] },
    {
      homeDirectory: "/home/tester",
      async openFiles() {
        return [
          "/home/tester/.gemini/antigravity-cli/presence/b9645e63-6dd0-443d-b0cc-5792d3fb3044.lock",
          "/home/tester/.gemini/antigravity-cli/presence/174d2a34-0715-41a9-a31d-cdc8e14849e4.lock",
        ];
      },
    },
  );

  assert.equal(resolved.status, "unavailable");
  assert.match(resolved.reason, /多個 conversation lock/);
});

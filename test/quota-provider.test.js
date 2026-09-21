import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  QuotaProvider,
  parseAgyQuotaSummary,
  parseAgyStatusline,
  parseClaudeStatusline,
  parseClaudeUsageCache,
  parseCodexRateLimits,
} from "../src/quota-provider.js";

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

test("parseCodexRateLimits reads structured five-hour and weekly reset epochs", () => {
  const record = fixture("codex-rate-limit.jsonl");
  const parsed = parseCodexRateLimits(record, new Date(0));
  assert.equal(parsed.plan, "plus");
  assert.equal(parsed.windows.fiveHour.remainingPercent, 94);
  assert.equal(parsed.windows.fiveHour.resetsAt, "2026-09-02T10:50:17.000Z");
  assert.equal(parsed.windows.weekly.remainingPercent, 47);
});

test("parseClaudeStatusline reads the official rate_limits payload", () => {
  const parsed = parseClaudeStatusline(
    JSON.parse(fixture("claude-statusline.json")),
    new Date("2026-09-02T06:00:00Z"),
  );
  assert.equal(parsed.windows.fiveHour.remainingPercent, 3);
  assert.equal(parsed.windows.weekly.remainingPercent, 81);
  assert.equal(parsed.observedAt, "2026-09-02T06:00:00.000Z");
});

test("parseClaudeUsageCache keeps a saturated five-hour window and reset time", () => {
  const parsed = parseClaudeUsageCache(
    JSON.parse(fixture("claude-usage-cache.json")),
    new Date("2026-09-02T06:50:00Z"),
  );
  assert.equal(parsed.windows.fiveHour.usedPercent, 100);
  assert.equal(parsed.windows.fiveHour.remainingPercent, 0);
  assert.equal(parsed.windows.fiveHour.resetsAt, "2026-09-02T08:29:59.815Z");
  assert.equal(parsed.windows.weekly.usedPercent, 20);
});

test("parseAgyQuotaSummary keeps Gemini and third-party windows separate", () => {
  const parsed = parseAgyQuotaSummary(JSON.parse(fixture("agy-quota-summary.json")));
  assert.equal(parsed.groups[0].id, "gemini");
  assert.equal(parsed.groups[0].windows.fiveHour.remainingPercent, 96.70859);
  assert.equal(parsed.groups[1].id, "thirdParty");
  assert.equal(parsed.groups[1].windows.fiveHour.remainingPercent, 100);
});

test("parseAgyStatusline reads the official status-line quota buckets", () => {
  // Fixture captured from AGY 1.2.7's status-line payload on 2026-09-21 (private fields removed).
  const observedAt = new Date("2026-09-21T06:08:24Z");
  const parsed = parseAgyStatusline(JSON.parse(fixture("agy-statusline.json")), observedAt);
  assert.equal(parsed.source, "AGY statusline");
  assert.equal(parsed.plan, "Google AI Pro");
  assert.equal(parsed.observedAt, "2026-09-21T06:08:24.000Z");
  const [gemini, thirdParty] = parsed.groups;
  assert.equal(gemini.id, "gemini");
  assert.equal(gemini.windows.fiveHour.remainingPercent, 94.0016);
  assert.equal(gemini.windows.fiveHour.resetsAt, "2026-09-21T06:50:12.000Z");
  assert.equal(gemini.windows.weekly.remainingPercent, 86.357415);
  assert.equal(thirdParty.id, "thirdParty");
  assert.equal(thirdParty.windows.fiveHour.remainingPercent, 100);
  assert.equal(thirdParty.windows.weekly.resetsAt, "2026-09-28T06:08:37.000Z");
});

test("parseAgyStatusline derives the reset time from reset_in_seconds when reset_time is absent", () => {
  const observedAt = new Date("2026-09-21T06:00:00Z");
  const parsed = parseAgyStatusline({ quota: { "3p-weekly": { remaining_fraction: 1, reset_in_seconds: 432000 } } }, observedAt);
  assert.equal(parsed.groups.length, 1);
  assert.equal(parsed.groups[0].id, "thirdParty");
  assert.equal(parsed.groups[0].windows.weekly.resetsAt, "2026-09-26T06:00:00.000Z");
  assert.equal(parsed.groups[0].windows.fiveHour, null);
});

test("parseAgyStatusline ignores payloads without quota buckets", () => {
  assert.equal(parseAgyStatusline({ model: { display_name: "Gemini" } }), null);
  assert.equal(parseAgyStatusline({ quota: {} }), null);
});

test("readAgy prefers the relayed status-line snapshot and skips the probe", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agy-quota-"));
  const snapshotPath = path.join(dir, "agy-quota.json");
  const future = new Date(Date.now() + 3_600_000).toISOString();
  writeFileSync(snapshotPath, JSON.stringify({
    quota: { "gemini-5h": { remaining_fraction: 0.5, reset_time: future } },
  }));
  let probed = false;
  const provider = new QuotaProvider({
    agySnapshotPath: snapshotPath,
    runner: async () => { probed = true; return { stdout: "" }; },
    fetcher: async () => { probed = true; throw new Error("unexpected"); },
  });
  const result = await provider.readAgy();
  assert.equal(result.status, "ready");
  assert.equal(result.groups[0].windows.fiveHour.remainingPercent, 50);
  assert.equal(probed, false);
});

test("readAgy falls through to the probe when the snapshot windows have expired", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agy-quota-"));
  const snapshotPath = path.join(dir, "agy-quota.json");
  writeFileSync(snapshotPath, JSON.stringify({
    quota: { "gemini-5h": { remaining_fraction: 0.5, reset_time: "2020-01-01T00:00:00Z" } },
  }));
  const provider = new QuotaProvider({
    agySnapshotPath: snapshotPath,
    runner: async () => ({ stdout: "" }),
    fetcher: async () => { throw new Error("unexpected"); },
  });
  const result = await provider.readAgy();
  assert.equal(result.status, "unavailable");
  assert.equal(result.reason, "目前沒有執行中的 AGY");
});

test("readAgy reports setup-required when AGY answers 401 missing CSRF token", async () => {
  // `ss -ltnp` shape and the 401 body were captured from AGY 1.2.7 on 2026-09-21.
  const ssOutput = [
    'LISTEN 0 4096 127.0.0.1:39597 0.0.0.0:* users:(("agy",pid=16648,fd=11))',
    'LISTEN 0 4096 127.0.0.1:44727 0.0.0.0:* users:(("agy",pid=16648,fd=13))',
  ].join("\n");
  const requested = [];
  const provider = new QuotaProvider({
    runner: async () => ({ stdout: ssOutput }),
    fetcher: async (url) => {
      requested.push(url);
      return { ok: false, status: 401, json: async () => JSON.parse(fixture("agy-csrf-401.json")) };
    },
  });
  const result = await provider.readAgy();
  assert.equal(result.status, "setup-required");
  assert.match(result.reason, /CSRF token/);
  assert.match(result.reason, /install-agy-quota-relay/);
  assert.equal(requested.length, 2);
});

test("readAgy reports waiting on 401 when a relay snapshot path is configured but empty", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "agy-quota-"));
  const provider = new QuotaProvider({
    agySnapshotPath: path.join(dir, "missing.json"),
    runner: async () => ({ stdout: 'LISTEN 0 4096 127.0.0.1:44727 0.0.0.0:* users:(("agy",pid=16648,fd=13))' }),
    fetcher: async () => ({ ok: false, status: 401, json: async () => JSON.parse(fixture("agy-csrf-401.json")) }),
  });
  const result = await provider.readAgy();
  assert.equal(result.status, "waiting");
  assert.match(result.reason, /statusline/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseAgyQuotaSummary,
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

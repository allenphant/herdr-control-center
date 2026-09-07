import assert from "node:assert/strict";
import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ConversationSearchService,
  TranscriptRepository,
} from "../src/conversation-search.js";
import { parseAgyTranscript } from "../src/transcripts/agy.js";
import { parseClaudeTranscript } from "../src/transcripts/claude.js";
import { parseCodexRollouts } from "../src/transcripts/codex.js";

const fixtureRoot = path.join(import.meta.dirname, "fixtures", "conversation");
const ids = {
  agy: "00000000-0000-4000-8000-000000000030",
  claude: "00000000-0000-4000-8000-000000000001",
  codex: "00000000-0000-7000-8000-000000000020",
};

const fixture = (name) => readFile(path.join(fixtureRoot, name), "utf8");

test("Claude adapter keeps the active branch and only visible text", async () => {
  const messages = parseClaudeTranscript(
    await fixture("claude-active-branch.jsonl"),
    ids.claude,
  );

  assert.deepEqual(messages.map(({ role, text }) => ({ role, text })), [
    { role: "user", text: "Start the active conversation" },
    { role: "assistant", text: "Shared answer before the fork" },
    { role: "user", text: "Active branch asks for needle" },
    { role: "assistant", text: "Visible needle appears twice: needle" },
  ]);
  assert.equal(messages.some((message) => message.text.includes("fossil")), false);
  assert.equal(messages.some((message) => message.text.includes("hidden")), false);
  assert.equal(new Set(messages.map((message) => message.anchor)).size, messages.length);
});

test("Codex adapter merges resumed fragments and deduplicates replayed items", async () => {
  const messages = parseCodexRollouts([
    { id: "original", text: await fixture("codex-original.jsonl") },
    { id: "resumed", text: await fixture("codex-resumed.jsonl") },
  ], ids.codex);

  assert.deepEqual(messages.map(({ role, text }) => ({ role, text })), [
    { role: "user", text: "Original user asks for needle" },
    { role: "assistant", text: "Commentary finds needle" },
    { role: "assistant", text: "Original final answer" },
    { role: "user", text: "Resumed user question" },
    { role: "assistant", text: "Resumed answer includes needle" },
  ]);
  assert.equal(messages.filter((message) => message.anchor === "codex:item_u1:0").length, 1);
  assert.equal(messages.some((message) => message.text.includes("hidden")), false);
  assert.equal(messages.some((message) => message.text.includes("duplicate")), false);
});

test("AGY adapter enforces source, type, and status allowlists", async () => {
  const messages = parseAgyTranscript(await fixture("agy-transcript.jsonl"), ids.agy);

  assert.deepEqual(messages.map(({ role, text }) => ({ role, text })), [
    { role: "user", text: "AGY user asks for needle" },
    { role: "assistant", text: "AGY visible answer" },
    { role: "user", text: "Second AGY user message" },
    { role: "assistant", text: "AGY final needle response" },
  ]);
  assert.equal(messages.some((message) => message.text.includes("hidden")), false);
  assert.equal(messages.some((message) => message.text.includes("incomplete")), false);
});

test("search returns all ranges, role filters, pagination, and revision-bound cursors", async () => {
  const conversation = {
    provider: "claude",
    conversationId: ids.claude,
    revision: "revision-1",
    messages: [
      {
        provider: "claude",
        conversationId: ids.claude,
        anchor: "claude:u1:0",
        ordinal: 0,
        role: "user",
        timestamp: null,
        text: "needle one needle",
      },
      {
        provider: "claude",
        conversationId: ids.claude,
        anchor: "claude:a1:0",
        ordinal: 1,
        role: "assistant",
        timestamp: null,
        text: "another needle",
      },
    ],
  };
  const service = new ConversationSearchService({ repository: { async load() { return conversation; } } });
  const fingerprint = { agent: "claude", source: "herdr:claude", value: ids.claude };

  const first = await service.search(fingerprint, { query: "needle", limit: 1 });
  assert.equal(first.hits.length, 1);
  assert.deepEqual(first.hits[0].matchRanges, [
    { start: 0, end: 6 },
    { start: 11, end: 17 },
  ]);
  assert.ok(first.nextCursor);

  const second = await service.search(fingerprint, {
    query: "needle",
    limit: 1,
    cursor: first.nextCursor,
  });
  assert.equal(second.hits[0].role, "assistant");
  assert.equal(second.nextCursor, null);

  const users = await service.search(fingerprint, { query: "needle", roles: ["user"] });
  assert.deepEqual(users.hits.map((hit) => hit.role), ["user"]);

  conversation.revision = "revision-2";
  await assert.rejects(
    service.search(fingerprint, { query: "needle", cursor: first.nextCursor }),
    (error) => error.statusCode === 409,
  );
});

test("context uses the same canonical messages and rejects stale revisions", async () => {
  const messages = ["before", "target", "after"].map((text, ordinal) => ({
    provider: "agy",
    conversationId: ids.agy,
    anchor: `agy:${ordinal}`,
    ordinal,
    role: ordinal === 1 ? "assistant" : "user",
    timestamp: null,
    text,
  }));
  const repository = {
    async load() {
      return { provider: "agy", conversationId: ids.agy, revision: "r1", messages };
    },
  };
  const service = new ConversationSearchService({ repository });
  const fingerprint = { agent: "agy", source: "herdr:antigravity_cli", value: ids.agy };
  const context = await service.context(fingerprint, {
    anchor: "agy:1",
    revision: "r1",
    before: 1,
    after: 1,
  });
  assert.deepEqual(context.messages.map((message) => message.text), ["before", "target", "after"]);
  await assert.rejects(
    service.context(fingerprint, { anchor: "agy:1", revision: "old" }),
    (error) => error.statusCode === 409,
  );
});

test("repository ingests appended bytes, rebuilds truncation, and applies LRU bounds", async () => {
  const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "conversation-search-"));
  const projects = path.join(homeDirectory, ".claude", "projects", "project-a");
  await mkdir(projects, { recursive: true });
  const transcriptPath = path.join(projects, `${ids.claude}.jsonl`);
  const base = [
    JSON.stringify({
      type: "user",
      sessionId: ids.claude,
      uuid: "00000000-0000-4000-8000-000000000101",
      parentUuid: null,
      timestamp: "2026-01-01T00:00:00Z",
      isSidechain: false,
      message: { role: "user", content: "first message" },
    }),
    "",
  ].join("\n");
  await writeFile(transcriptPath, base);
  const repository = new TranscriptRepository({ homeDirectory, maxEntries: 1, discoveryTtlMs: 0 });
  const fingerprint = { agent: "claude", source: "herdr:claude", value: ids.claude };

  try {
    const first = await repository.load(fingerprint);
    const unchanged = await repository.load(fingerprint);
    assert.equal(first, unchanged);
    assert.equal(first.messages.length, 1);
    const initialRevision = unchanged.revision;

    await appendFile(transcriptPath, `${JSON.stringify({
      type: "assistant",
      sessionId: ids.claude,
      uuid: "00000000-0000-4000-8000-000000000102",
      parentUuid: "00000000-0000-4000-8000-000000000101",
      timestamp: "2026-01-01T00:00:01Z",
      isSidechain: false,
      message: { id: "msg_101", role: "assistant", type: "message", content: [{ type: "text", text: "appended message" }] },
    })}\n`);
    const appended = await repository.load(fingerprint);
    assert.equal(appended, first);
    assert.equal(appended.messages.length, 2);
    assert.notEqual(appended.revision, initialRevision);

    await writeFile(transcriptPath, base.replace("first message", "rebuilt message"));
    const rebuilt = await repository.load(fingerprint);
    assert.deepEqual(rebuilt.messages.map((message) => message.text), ["rebuilt message"]);

    const secondId = "00000000-0000-4000-8000-000000000002";
    await writeFile(path.join(projects, `${secondId}.jsonl`), `${JSON.stringify({
      type: "user",
      sessionId: secondId,
      uuid: "00000000-0000-4000-8000-000000000201",
      parentUuid: null,
      isSidechain: false,
      message: { role: "user", content: "second conversation" },
    })}\n`);
    await repository.load({ agent: "claude", source: "herdr:claude", value: secondId });
    assert.equal(repository.cache.size, 1);
    assert.equal(repository.cache.has(`claude:${ids.claude}`), false);
  } finally {
    await rm(homeDirectory, { recursive: true, force: true });
  }
});

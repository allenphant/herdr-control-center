import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApplication } from "../src/server.js";
import { ConversationSearchService, TranscriptRepository } from "../src/conversation-search.js";
import { JsonStore } from "../src/store.js";

const fingerprint = {
  agent: "codex",
  kind: "id",
  source: "herdr:codex",
  value: "00000000-0000-7000-8000-000000000020",
};

async function withApp(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "conversation-api-"));
  const store = new JsonStore(path.join(directory, "state.json"));
  let liveFingerprint = fingerprint;
  const calls = [];
  const client = {
    async getAgent() {
      return { agent: "codex", agent_session: liveFingerprint };
    },
  };
  const conversationSearch = {
    async search(actual, input) {
      calls.push({ method: "search", actual, input });
      return { provider: "codex", conversationId: actual.value, revision: "r1", hits: [], nextCursor: null };
    },
    async context(actual, input) {
      calls.push({ method: "context", actual, input });
      return { provider: "codex", conversationId: actual.value, revision: "r1", messages: [] };
    },
  };
  const app = await createApplication({ client, store, conversationSearch });
  const address = await app.listen(0, "127.0.0.1");
  try {
    await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      calls,
      setFingerprint(value) { liveFingerprint = value; },
    });
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test("conversation search API revalidates the live fingerprint and does not need a path", async () => {
  await withApp(async ({ baseUrl, calls }) => {
    const response = await fetch(`${baseUrl}/api/conversation/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        expectedFingerprint: fingerprint,
        query: "needle",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].actual, fingerprint);
    assert.deepEqual(calls[0].input, {
      query: "needle",
      roles: undefined,
      limit: undefined,
      cursor: undefined,
    });
  });
});

test("conversation APIs reject transcript path and provider overrides", async () => {
  await withApp(async ({ baseUrl, calls }) => {
    for (const [endpoint, override] of [
      ["search", { path: "/tmp/other.jsonl" }],
      ["search", { transcriptPath: "/tmp/other.jsonl" }],
      ["context", { provider: "claude" }],
    ]) {
      const response = await fetch(`${baseUrl}/api/conversation/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionName: "default",
          paneId: "w1:p3",
          expectedFingerprint: fingerprint,
          query: "needle",
          anchor: "codex:item_a1:0",
          revision: "r1",
          ...override,
        }),
      });
      const payload = await response.json();
      assert.equal(response.status, 400);
      assert.match(payload.error, /不得指定/);
    }
    assert.equal(calls.length, 0);
  });
});

test("conversation search API rejects a stale pane occupant before transcript access", async () => {
  await withApp(async ({ baseUrl, calls, setFingerprint }) => {
    setFingerprint({ ...fingerprint, value: "00000000-0000-7000-8000-000000000099" });
    const response = await fetch(`${baseUrl}/api/conversation/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        expectedFingerprint: fingerprint,
        query: "needle",
      }),
    });
    const payload = await response.json();
    assert.equal(response.status, 409);
    assert.match(payload.error, /session 已變更/);
    assert.equal(calls.length, 0);
  });
});

test("conversation context API forwards only after fingerprint verification", async () => {
  await withApp(async ({ baseUrl, calls }) => {
    const response = await fetch(`${baseUrl}/api/conversation/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionName: "default",
        paneId: "w1:p3",
        expectedFingerprint: fingerprint,
        anchor: "codex:item_a1:0",
        revision: "r1",
      }),
    });
    assert.equal(response.status, 200);
    assert.equal(calls[0].method, "context");
    assert.deepEqual(calls[0].input, {
      anchor: "codex:item_a1:0",
      revision: "r1",
      before: undefined,
      after: undefined,
    });
  });
});

test("conversation API runs the real Claude fixture through discovery, normalization, search, and context", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "conversation-vertical-api-"));
  const conversationId = "00000000-0000-4000-8000-000000000001";
  const actualFingerprint = {
    agent: "claude",
    kind: "id",
    source: "herdr:claude",
    value: conversationId,
  };
  const transcriptDirectory = path.join(directory, ".claude", "projects", "sanitized-fixture");
  await mkdir(transcriptDirectory, { recursive: true });
  await writeFile(
    path.join(transcriptDirectory, `${conversationId}.jsonl`),
    await readFile(new URL("./fixtures/conversation/claude-active-branch.jsonl", import.meta.url)),
  );

  const store = new JsonStore(path.join(directory, "state.json"));
  const client = {
    async getAgent() {
      return { agent: "claude", agent_session: actualFingerprint };
    },
  };
  const conversationSearch = new ConversationSearchService({
    repository: new TranscriptRepository({ homeDirectory: directory }),
  });
  const app = await createApplication({ client, store, conversationSearch });
  const address = await app.listen(0, "127.0.0.1");

  try {
    const target = {
      sessionName: "default",
      paneId: "w1:p3",
      expectedFingerprint: actualFingerprint,
    };
    const searchResponse = await fetch(`http://127.0.0.1:${address.port}/api/conversation/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...target, query: "needle" }),
    });
    const searchPayload = await searchResponse.json();
    assert.equal(searchResponse.status, 200);
    assert.equal(searchPayload.provider, "claude");
    assert.equal(searchPayload.hits.length, 2);
    assert.match(searchPayload.revision, /^[0-9a-f]{64}$/);

    const contextResponse = await fetch(`http://127.0.0.1:${address.port}/api/conversation/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...target,
        anchor: searchPayload.hits[0].anchor,
        revision: searchPayload.revision,
        before: 1,
        after: 1,
      }),
    });
    const contextPayload = await contextResponse.json();
    assert.equal(contextResponse.status, 200);
    assert.equal(contextPayload.messages.length, 3);
    assert.equal(contextPayload.messages.some((message) => message.anchor === searchPayload.hits[0].anchor), true);

    const excludedResponse = await fetch(`http://127.0.0.1:${address.port}/api/conversation/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...target, query: "hidden reasoning" }),
    });
    const excludedPayload = await excludedResponse.json();
    assert.equal(excludedResponse.status, 200);
    assert.equal(excludedPayload.hits.length, 0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

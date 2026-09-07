import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConversationSearchService, TranscriptRepository } from "../src/conversation-search.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const configPath = path.join(projectRoot, "test", "fixtures", "conversation", "search-benchmark.json");

function conversationId(suffix) {
  return `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, "0")}`;
}

function transcriptLines(id, messageCount, query, needleEvery) {
  let parentUuid = null;
  const lines = [];
  for (let index = 0; index < messageCount; index += 1) {
    const uuid = conversationId(index + 10_000);
    const role = index % 2 === 0 ? "user" : "assistant";
    const text = `Sanitized benchmark message ${index}${index % needleEvery === 0 ? ` ${query}` : ""}`;
    lines.push(JSON.stringify({
      type: role,
      sessionId: id,
      uuid,
      parentUuid,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      isSidechain: false,
      ...(role === "user"
        ? { isMeta: false, message: { role, content: text } }
        : { message: { role, content: [{ type: "text", text }] } }),
    }));
    parentUuid = uuid;
  }
  return `${lines.join("\n")}\n`;
}

async function createTranscript(homeDirectory, id, messageCount, config) {
  const directory = path.join(homeDirectory, ".claude", "projects", `benchmark-${messageCount}`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${id}.jsonl`),
    transcriptLines(id, messageCount, config.query, config.needleEvery),
  );
}

async function timedSearch(service, fingerprint, config) {
  const startedAt = performance.now();
  const result = await service.search(fingerprint, {
    query: config.query,
    roles: ["user", "assistant"],
    limit: config.searchLimit,
  });
  return { elapsedMs: performance.now() - startedAt, result };
}

const config = JSON.parse(await readFile(configPath, "utf8"));
const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "conversation-search-benchmark-"));

try {
  const ordinaryId = conversationId(90);
  const largeId = conversationId(91);
  await createTranscript(homeDirectory, ordinaryId, config.ordinaryMessageCount, config);
  await createTranscript(homeDirectory, largeId, config.largeMessageCount, config);

  const repository = new TranscriptRepository({ homeDirectory, discoveryTtlMs: 60_000 });
  const service = new ConversationSearchService({ repository });
  const fingerprintFor = (value) => ({
    agent: "claude",
    kind: "id",
    source: "herdr:claude",
    value,
  });

  const ordinaryCold = await timedSearch(service, fingerprintFor(ordinaryId), config);
  const largeCold = await timedSearch(service, fingerprintFor(largeId), config);
  const largeWarm = await timedSearch(service, fingerprintFor(largeId), config);

  for (const [messageCount, measurement] of [
    [config.ordinaryMessageCount, ordinaryCold],
    [config.largeMessageCount, largeCold],
    [config.largeMessageCount, largeWarm],
  ]) {
    const expectedMatches = Math.floor((messageCount - 1) / config.needleEvery) + 1;
    assert.equal(measurement.result.hits.length, Math.min(expectedMatches, config.searchLimit));
    assert.equal(Boolean(measurement.result.nextCursor), expectedMatches > config.searchLimit);
    assert.match(measurement.result.revision, /^[0-9a-f]{64}$/);
  }

  const measurements = {
    ordinaryCold: ordinaryCold.elapsedMs,
    largeCold: largeCold.elapsedMs,
    largeWarm: largeWarm.elapsedMs,
  };
  for (const [name, elapsedMs] of Object.entries(measurements)) {
    assert.ok(
      elapsedMs < config.thresholdsMs[name],
      `${name} ${elapsedMs.toFixed(2)} ms exceeded ${config.thresholdsMs[name]} ms`,
    );
  }

  process.stdout.write(`${JSON.stringify({
    fixture: config.schema,
    runtime: process.version,
    platform: `${process.platform}/${process.arch}`,
    cpu: os.cpus()[0]?.model || "unknown",
    messageCounts: { ordinary: config.ordinaryMessageCount, large: config.largeMessageCount },
    measurementsMs: Object.fromEntries(
      Object.entries(measurements).map(([name, value]) => [name, Number(value.toFixed(2))]),
    ),
    thresholdsMs: config.thresholdsMs,
  }, null, 2)}\n`);
} finally {
  await rm(homeDirectory, { recursive: true, force: true });
}

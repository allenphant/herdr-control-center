import assert from "node:assert/strict";

const baseUrl = process.env.APP_URL || "http://127.0.0.1:4317";
const supportedSources = new Map([
  ["herdr:claude", "claude"],
  ["herdr:codex", "codex"],
  ["herdr:antigravity_cli", "agy"],
]);

const topologyResponse = await fetch(`${baseUrl}/api/topology`);
assert.equal(topologyResponse.ok, true, `topology returned HTTP ${topologyResponse.status}`);
const topology = await topologyResponse.json();
const candidates = new Map([...supportedSources].map(([source]) => [source, []]));

for (const session of topology.sessions || []) {
  for (const workspace of session.workspaces || []) {
    for (const pane of workspace.panes || []) {
      const fingerprint = pane.agent_session;
      if (!supportedSources.has(fingerprint?.source)) continue;
      candidates.get(fingerprint.source).push({
        sessionName: session.name,
        paneId: pane.pane_id,
        expectedFingerprint: fingerprint,
      });
    }
  }
}

const results = [];
for (const [source, provider] of supportedSources) {
  const providerCandidates = candidates.get(source);
  let verified = null;
  const failures = [];
  for (const target of providerCandidates) {
    const response = await fetch(`${baseUrl}/api/conversation/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...target,
        query: "a",
        roles: ["user", "assistant"],
        limit: 1,
      }),
    });
    if (!response.ok) {
      failures.push(response.status);
      continue;
    }
    const payload = await response.json();
    assert.equal(payload.provider, provider);
    assert.equal(Array.isArray(payload.hits), true);
    assert.match(payload.revision, /^[0-9a-f]{64}$/);
    verified = { provider, status: "verified", hitsOnProbe: payload.hits.length };
    break;
  }

  if (!providerCandidates.length) {
    results.push({ provider, status: "no-live-pane" });
  } else if (verified) {
    results.push(verified);
  } else {
    throw new Error(`${provider}: ${providerCandidates.length} live pane(s), search HTTP statuses ${failures.join(",")}`);
  }
}

assert.equal(results.some((result) => result.status === "verified"), true, "no live searchable pane was verified");
process.stdout.write(`${JSON.stringify({ baseUrl, results }, null, 2)}\n`);

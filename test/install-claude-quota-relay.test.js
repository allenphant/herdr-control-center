import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installerPath = path.join(projectRoot, "scripts", "install-claude-quota-relay.mjs");

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "claude-relay-test-"));
  const settingsPath = path.join(root, "settings.json");
  const upstreamPath = path.join(root, "data", "upstream.json");
  const relayPath = path.join(root, "new", "deploy", "claude-statusline-relay.sh");
  await mkdir(path.dirname(upstreamPath), { recursive: true });
  return { root, settingsPath, upstreamPath, relayPath };
}

async function runInstaller(paths) {
  return execFileAsync(process.execPath, [installerPath], {
    env: {
      ...process.env,
      CLAUDE_RELAY_SETTINGS_PATH: paths.settingsPath,
      CLAUDE_RELAY_UPSTREAM_PATH: paths.upstreamPath,
      CLAUDE_RELAY_SCRIPT_PATH: paths.relayPath,
    },
  });
}

test("installer preserves a normal existing statusline", async (t) => {
  const paths = await fixture();
  t.after(() => rm(paths.root, { recursive: true, force: true }));
  const original = { type: "command", command: "bash /opt/statusline.sh", refreshInterval: 12 };
  await writeFile(paths.settingsPath, `${JSON.stringify({ statusLine: original })}\n`);

  await runInstaller(paths);

  const settings = JSON.parse(await readFile(paths.settingsPath, "utf8"));
  const upstream = JSON.parse(await readFile(paths.upstreamPath, "utf8"));
  assert.deepEqual(upstream, original);
  assert.equal(settings.statusLine.command, `bash ${paths.relayPath}`);
  assert.equal(settings.statusLine.refreshInterval, 12);
});

test("installer migration does not preserve a stale relay as upstream", async (t) => {
  const paths = await fixture();
  t.after(() => rm(paths.root, { recursive: true, force: true }));
  const original = { type: "command", command: "bash /opt/original-statusline.sh" };
  await writeFile(paths.upstreamPath, `${JSON.stringify(original)}\n`);
  await writeFile(paths.settingsPath, `${JSON.stringify({
    statusLine: {
      type: "command",
      command: "bash /old/project/deploy/claude-statusline-relay.sh",
      refreshInterval: 30,
    },
  })}\n`);

  await runInstaller(paths);

  const settings = JSON.parse(await readFile(paths.settingsPath, "utf8"));
  const upstream = JSON.parse(await readFile(paths.upstreamPath, "utf8"));
  assert.deepEqual(upstream, original);
  assert.equal(settings.statusLine.command, `bash ${paths.relayPath}`);
});

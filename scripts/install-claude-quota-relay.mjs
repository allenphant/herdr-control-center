import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const settingsPath = process.env.CLAUDE_RELAY_SETTINGS_PATH
  || path.join(os.homedir(), ".claude", "settings.json");
const upstreamPath = process.env.CLAUDE_RELAY_UPSTREAM_PATH
  || path.join(projectRoot, "data", "claude-statusline-upstream.json");
const relayPath = process.env.CLAUDE_RELAY_SCRIPT_PATH
  || path.join(projectRoot, "deploy", "claude-statusline-relay.sh");

const settings = JSON.parse(await readFile(settingsPath, "utf8"));
const relayCommand = `bash ${relayPath}`;
if (settings.statusLine?.command === relayCommand) {
  process.stdout.write("Claude quota relay 已啟用\n");
  process.exit(0);
}

await mkdir(path.dirname(upstreamPath), { recursive: true, mode: 0o700 });
const previousCommand = String(settings.statusLine?.command || "");
const previousWasRelay = /(?:^|\s)\S*\/deploy\/claude-statusline-relay\.sh(?:\s|$)/.test(previousCommand);
if (!previousWasRelay) {
  await writeFile(upstreamPath, `${JSON.stringify(settings.statusLine || {}, null, 2)}\n`, {
    mode: 0o600,
  });
} else {
  await readFile(upstreamPath, "utf8").catch(async () => {
    await writeFile(upstreamPath, "{}\n", { mode: 0o600 });
  });
}
settings.statusLine = {
  ...(settings.statusLine || {}),
  type: "command",
  command: relayCommand,
  refreshInterval: Math.max(5, Number(settings.statusLine?.refreshInterval) || 30),
};

const tempPath = `${settingsPath}.pane-relay.tmp`;
await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
await rename(tempPath, settingsPath);
process.stdout.write(previousWasRelay
  ? "Claude quota relay 已遷移，既有 upstream statusline 已保留\n"
  : "Claude quota relay 已啟用，原 statusline 已保留\n");

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const settingsPath = path.join(os.homedir(), ".claude", "settings.json");
const upstreamPath = path.join(projectRoot, "data", "claude-statusline-upstream.json");
const relayPath = path.join(projectRoot, "deploy", "claude-statusline-relay.sh");

const settings = JSON.parse(await readFile(settingsPath, "utf8"));
const relayCommand = `bash ${relayPath}`;
if (settings.statusLine?.command === relayCommand) {
  process.stdout.write("Claude quota relay 已啟用\n");
  process.exit(0);
}

await mkdir(path.dirname(upstreamPath), { recursive: true, mode: 0o700 });
await writeFile(upstreamPath, `${JSON.stringify(settings.statusLine || {}, null, 2)}\n`, {
  mode: 0o600,
});
settings.statusLine = {
  ...(settings.statusLine || {}),
  type: "command",
  command: relayCommand,
  refreshInterval: Math.max(5, Number(settings.statusLine?.refreshInterval) || 30),
};

const tempPath = `${settingsPath}.pane-relay.tmp`;
await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
await rename(tempPath, settingsPath);
process.stdout.write("Claude quota relay 已啟用，原 statusline 已保留\n");

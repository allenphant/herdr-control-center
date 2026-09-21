import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const settingsPath = process.env.AGY_RELAY_SETTINGS_PATH
  || path.join(os.homedir(), ".gemini", "antigravity-cli", "settings.json");
const upstreamPath = process.env.AGY_RELAY_UPSTREAM_PATH
  || path.join(projectRoot, "data", "agy-statusline-upstream.json");
const relayPath = process.env.AGY_RELAY_SCRIPT_PATH
  || path.join(projectRoot, "deploy", "agy-statusline-relay.sh");

const settings = JSON.parse(await readFile(settingsPath, "utf8"));
const relayCommand = `bash ${relayPath}`;
if (settings.statusLine?.command === relayCommand) {
  process.stdout.write("AGY quota relay 已啟用\n");
  process.exit(0);
}

await mkdir(path.dirname(upstreamPath), { recursive: true, mode: 0o700 });
const previousCommand = String(settings.statusLine?.command || "");
const previousWasRelay = /(?:^|\s)\S*\/deploy\/agy-statusline-relay\.sh(?:\s|$)/.test(previousCommand);
if (!previousWasRelay) {
  await writeFile(upstreamPath, `${JSON.stringify(settings.statusLine || {}, null, 2)}\n`, {
    mode: 0o600,
  });
} else {
  await readFile(upstreamPath, "utf8").catch(async () => {
    await writeFile(upstreamPath, "{}\n", { mode: 0o600 });
  });
}
// Antigravity CLI's `statusLine` schema (types.StatusLineConfig in the agy
// binary) uses `type: "custom"` + `enabled`; other keys such as
// `stack_with_default` are preserved as-is.
settings.statusLine = {
  ...(settings.statusLine || {}),
  type: "custom",
  command: relayCommand,
  enabled: true,
};

const tempPath = `${settingsPath}.pane-relay.tmp`;
await writeFile(tempPath, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
await rename(tempPath, settingsPath);
process.stdout.write(previousWasRelay
  ? "AGY quota relay 已遷移，既有 upstream statusline 已保留\n"
  : "AGY quota relay 已啟用，原 statusline 已保留\n");

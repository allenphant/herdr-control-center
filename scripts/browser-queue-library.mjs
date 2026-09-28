// End-to-end check for the saved-message library and detached-job rebinding.
// Runs an isolated Pane Relay (own port + temporary state file) so the live
// service data is never touched. The seeded job is a one-shot whose time has
// passed, so rebinding pauses it and nothing is ever sent to a real pane.
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPort = Number(process.env.QUEUE_TEST_PORT || 4399);
const webdriverPort = Number(process.env.WEBDRIVER_PORT || 9516);
const webdriverUrl = `http://127.0.0.1:${webdriverPort}`;
const appUrl = `http://127.0.0.1:${appPort}/?theme=light`;
const screenshotPath = process.env.SCREENSHOT_PATH || "";
const elementKey = "element-6066-11e4-a52e-4f735466cecf";

const directory = await mkdtemp(path.join(os.tmpdir(), "pane-relay-queue-e2e-"));
const statePath = path.join(directory, "state.json");
await writeFile(statePath, JSON.stringify({
  version: 1,
  events: [],
  aliases: [],
  messages: [],
  jobs: [{
    id: "e2e-detached",
    label: "E2E detached job",
    sessionName: "default",
    paneId: "w1:p0",
    deliveryMode: "prompt",
    message: "e2e placeholder",
    recurrence: "once",
    dispatchMode: "settled",
    graceMinutes: 360,
    expectedFingerprint: { agent: "codex", kind: "id", source: "herdr:codex", value: "e2e-gone-session" },
    status: "detached",
    scheduledFor: "2026-01-01T00:00:00.000Z",
    nextRunAt: null,
    retryUntil: "2026-01-01T06:00:00.000Z",
    occurrenceCount: 0,
    lastOutcome: "找不到原本的 pane",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }],
}));

const server = spawn(process.execPath, ["src/server.js"], {
  cwd: projectRoot,
  env: {
    ...process.env,
    PORT: String(appPort),
    STATE_PATH: statePath,
    ATTACHMENT_ROOT: path.join(directory, "attachments"),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
const driver = spawn(process.env.CHROMEDRIVER_BIN || "chromedriver", [
  `--port=${webdriverPort}`,
  "--allowed-ips=127.0.0.1",
], { stdio: ["ignore", "pipe", "pipe"] });

let sessionId;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function webdriver(route, { method = "GET", body } = {}) {
  const response = await fetch(`${webdriverUrl}${route}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) {
    throw new Error(payload.value?.message || `WebDriver ${response.status}`);
  }
  return payload.value;
}

async function waitFor(check, label, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ""}`);
}

const find = (css, timeoutMs) => waitFor(async () => {
  const value = await webdriver(`/session/${sessionId}/element`, {
    method: "POST",
    body: { using: "css selector", value: css },
  });
  return value[elementKey];
}, css, timeoutMs);

const click = async (css) => {
  const id = await find(css);
  await webdriver(`/session/${sessionId}/element/${id}/click`, { method: "POST", body: {} });
};

const type = async (css, text) => {
  const id = await find(css);
  await webdriver(`/session/${sessionId}/element/${id}/clear`, { method: "POST", body: {} });
  await webdriver(`/session/${sessionId}/element/${id}/value`, {
    method: "POST",
    body: { text, value: [...text] },
  });
};

const run = (script, args = []) => webdriver(`/session/${sessionId}/execute/sync`, {
  method: "POST",
  body: { script, args },
});

const state = async () => JSON.parse(await readFile(statePath, "utf8"));

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${appPort}/api/health`)).ok, "isolated server");
  await waitFor(async () => webdriver("/status"), "chromedriver");
  const session = await webdriver("/session", {
    method: "POST",
    body: {
      capabilities: {
        alwaysMatch: {
          browserName: "chrome",
          "goog:chromeOptions": { args: ["--headless", "--disable-gpu", "--no-sandbox", "--window-size=1440,1000"] },
        },
      },
    },
  });
  sessionId = session.sessionId;
  await webdriver(`/session/${sessionId}/url`, { method: "POST", body: { url: appUrl } });
  await find("#service-state.is-online");

  // Detached job stays visible under 待執行 with its own status.
  await find(".job-item[data-status='detached']");
  const summary = await run("return document.querySelector('#queue-summary').textContent;");
  if (!summary.includes("待重新綁定")) throw new Error(`Queue summary missing detached count: ${summary}`);

  // Library: create, then edit.
  await click("[data-job-filter='library']");
  await find("#library-panel:not([hidden])");
  if (!await run("return document.querySelector('#job-list').hidden;")) throw new Error("Job list still visible in library tab");
  await type("#library-name", "每日接續");
  await type("#library-message", "請接續原本的工作");
  await click("#library-save");
  await find(".library-item");
  await waitFor(async () => (await state()).messages?.[0]?.message === "請接續原本的工作", "message persisted");
  await click("[data-focus-key$=':edit']");
  await type("#library-message", "請接續原本的工作並整理結果");
  await click("#library-save");
  await waitFor(async () => (await state()).messages?.[0]?.message === "請接續原本的工作並整理結果", "message updated");
  if ((await state()).messages.length !== 1) throw new Error("Editing created a duplicate message");

  // Select a real pane (read-only topology), then apply the saved message.
  try {
    await find(".pane-choice:not(.is-unsupported)", 2_000);
  } catch {
    await click(".workspace-summary");
  }
  await click(".pane-choice:not(.is-unsupported)");
  const paneId = await waitFor(async () => {
    const value = await run("return document.querySelector('#target-pane')?.textContent?.trim();");
    return value && value.includes(":p") ? value : null;
  }, "selected pane");
  await click("[data-focus-key$=':apply']");
  const applied = await run("return document.querySelector('#message').value;");
  if (applied !== "請接續原本的工作並整理結果") throw new Error(`Apply did not fill composer: ${applied}`);

  if (screenshotPath) {
    const image = await webdriver(`/session/${sessionId}/screenshot`);
    await writeFile(screenshotPath, Buffer.from(image, "base64"));
  }

  // Rebind the detached job to the selected pane.
  await click("[data-job-filter='active']");
  await click(".job-item[data-status='detached']");
  await find("#job-dialog[open]");
  await click("[data-focus-key='job:e2e-detached:rebind']");
  await find("#confirm-dialog[open]");
  await click("#confirm-accept");
  const rebound = await waitFor(async () => {
    const job = (await state()).jobs.find((item) => item.id === "e2e-detached");
    return job?.status !== "detached" ? job : null;
  }, "job rebound");
  if (rebound.status !== "paused" || rebound.nextRunAt !== null) {
    throw new Error(`Overdue one-shot should pause after rebind: ${rebound.status}`);
  }
  if (rebound.paneId !== paneId) throw new Error(`Rebound to ${rebound.paneId}, expected ${paneId}`);
  await click("#close-job-dialog");

  // Delete the saved message.
  await click("[data-job-filter='library']");
  await click("[data-focus-key$=':delete']");
  await find("#confirm-dialog[open]");
  await click("#confirm-accept");
  await waitFor(async () => (await state()).messages.length === 0, "message deleted");

  console.log(`Queue library e2e passed: rebound to ${paneId}, library create/edit/apply/delete ok`);
} finally {
  if (sessionId) await webdriver(`/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
  driver.kill();
  server.kill();
  await rm(directory, { recursive: true, force: true });
}

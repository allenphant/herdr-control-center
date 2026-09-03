import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";

const webdriverPort = Number(process.env.WEBDRIVER_PORT || 9515);
const webdriverUrl = `http://127.0.0.1:${webdriverPort}`;
const appUrl = process.env.APP_URL || "http://127.0.0.1:4317/?theme=light";
const browserWidth = Number(process.env.BROWSER_WIDTH || 1440);
const browserHeight = Number(process.env.BROWSER_HEIGHT || 1000);
const screenshotPath = process.env.SCREENSHOT_PATH || "";
const captureErrorState = process.env.CAPTURE_ERROR_STATE === "1";
const captureJobDialog = process.env.CAPTURE_JOB_DIALOG === "1";
const captureQuotaPanel = process.env.CAPTURE_QUOTA_PANEL === "1";
const createJob = process.env.CREATE_JOB === "1";
const testImagePath = process.env.TEST_IMAGE_PATH || "";
const elementKey = "element-6066-11e4-a52e-4f735466cecf";

const driver = spawn(
  process.env.CHROMEDRIVER_BIN || "chromedriver",
  [`--port=${webdriverPort}`, "--allowed-ips=127.0.0.1"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let sessionId;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function webdriver(path, { method = "GET", body } = {}) {
  const response = await fetch(`${webdriverUrl}${path}`, {
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

async function waitForDriver() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await webdriver("/status");
      return;
    } catch {
      await delay(100);
    }
  }
  throw new Error("ChromeDriver did not start");
}

async function find(css, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await webdriver(`/session/${sessionId}/element`, {
        method: "POST",
        body: { using: "css selector", value: css },
      });
      return value[elementKey];
    } catch {
      await delay(200);
    }
  }
  throw new Error(`Timed out waiting for ${css}`);
}

async function clearElement(elementId) {
  await webdriver(`/session/${sessionId}/element/${elementId}/clear`, {
    method: "POST",
    body: {},
  });
}

async function sendKeys(elementId, value) {
  await webdriver(`/session/${sessionId}/element/${elementId}/value`, {
    method: "POST",
    body: { text: value, value: [...value] },
  });
}

try {
  await waitForDriver();
  const session = await webdriver("/session", {
    method: "POST",
    body: {
      capabilities: {
        alwaysMatch: {
          browserName: "chrome",
          "goog:chromeOptions": {
            args: [
              "--headless",
              "--disable-gpu",
              "--no-sandbox",
              `--window-size=${browserWidth},${browserHeight}`,
            ],
          },
        },
      },
    },
  });
  sessionId = session.sessionId;
  await webdriver(`/session/${sessionId}/url`, {
    method: "POST",
    body: { url: appUrl },
  });

  const online = await find("#service-state.is-online");
  if (!online) throw new Error("Herdr connection did not become ready");
  if (browserWidth > 760) {
    await find(".pane-space.is-ready .space-pane");
  }
  if (browserWidth > 1280) {
    const headingEdges = await webdriver(`/session/${sessionId}/execute/sync`, {
      method: "POST",
      body: {
        script: `
          return [...document.querySelectorAll('.app-shell > * > .panel-heading')].map((heading) => {
            const rect = heading.getBoundingClientRect();
            return { top: rect.top, bottom: rect.bottom, height: rect.height };
          });
        `,
        args: [],
      },
    });
    const topEdges = headingEdges.map((edge) => edge.top);
    const bottomEdges = headingEdges.map((edge) => edge.bottom);
    if (
      headingEdges.length !== 3
      || Math.max(...topEdges) - Math.min(...topEdges) > 1
      || Math.max(...bottomEdges) - Math.min(...bottomEdges) > 1
    ) {
      throw new Error(`Desktop panel headings do not share grid lines: ${JSON.stringify(headingEdges)}`);
    }
  }
  const quotaOrb = await find("#quota-orb");
  await webdriver(`/session/${sessionId}/element/${quotaOrb}/click`, { method: "POST", body: {} });
  await find("#quota-panel:not([hidden])");
  await find("[data-quota-provider='codex'] .quota-window");
  await find("[data-quota-provider='claude'] .quota-window");
  await find("[data-quota-provider='agy'] .quota-group");
  await find("progress.quota-track[value][max='100']");
  const quotaOverlay = await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: `
        const panel = document.querySelector('#quota-panel');
        const backdrop = document.querySelector('#quota-backdrop');
        const body = getComputedStyle(document.body);
        const panelStyle = getComputedStyle(panel);
        const backdropStyle = getComputedStyle(backdrop);
        const rect = panel.getBoundingClientRect();
        return {
          backdropVisible: !backdrop.hidden && backdropStyle.display !== 'none',
          backdropFilter: backdropStyle.backdropFilter || backdropStyle.webkitBackdropFilter,
          panelBackground: panelStyle.backgroundColor,
          bodyBackground: body.backgroundColor,
          withinViewport: rect.left >= 0 && rect.top >= 0
            && rect.right <= window.innerWidth && rect.bottom <= window.innerHeight,
        };
      `,
      args: [],
    },
  });
  if (
    !quotaOverlay.backdropVisible
    || !quotaOverlay.backdropFilter.includes("blur")
    || quotaOverlay.panelBackground === quotaOverlay.bodyBackground
    || !quotaOverlay.withinViewport
  ) {
    throw new Error(`Quota overlay treatment is incomplete: ${JSON.stringify(quotaOverlay)}`);
  }
  const quotaBars = await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: `
        return [...document.querySelectorAll('progress.quota-track')].map((track) => ({
          value: track.value,
          trackWidth: track.getBoundingClientRect().width,
        }));
      `,
      args: [],
    },
  });
  if (!quotaBars.some((bar) => bar.value > 0 && bar.trackWidth > 0)) {
    throw new Error(`Quota progress elements did not render: ${JSON.stringify(quotaBars)}`);
  }
  const closeQuota = await find("#close-quota");
  await webdriver(`/session/${sessionId}/element/${closeQuota}/click`, { method: "POST", body: {} });
  await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: "const node = document.querySelector('#quota-float'); node.style.left = '8px'; node.style.top = '8px'; return true;",
      args: [],
    },
  });
  const searchToggle = await find("#toggle-pane-search");
  await webdriver(`/session/${sessionId}/element/${searchToggle}/click`, { method: "POST", body: {} });
  await find("#pane-search-popover:not([hidden]) #pane-filter");
  const searchBounds = await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: `
        const rect = document.querySelector('#pane-search-popover').getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        };
      `,
      args: [],
    },
  });
  if (
    searchBounds.left < 0
    || searchBounds.top < 0
    || searchBounds.right > searchBounds.viewportWidth
    || searchBounds.bottom > searchBounds.viewportHeight
  ) {
    throw new Error(`Pane search escaped the viewport: ${JSON.stringify(searchBounds)}`);
  }
  await webdriver(`/session/${sessionId}/element/${searchToggle}/click`, { method: "POST", body: {} });

  let pane;
  try {
    pane = await find(".pane-choice:not(.is-unsupported):has(.agent-label[data-agent='codex'])", 1_500);
  } catch {
    const workspace = await find(".workspace-summary");
    await webdriver(`/session/${sessionId}/element/${workspace}/click`, {
      method: "POST",
      body: {},
    });
    pane = await find(".pane-choice:not(.is-unsupported):has(.agent-label[data-agent='codex'])");
  }
  let previewText = "quota panel responsive check";
  if (!captureQuotaPanel) {
    const previewLine = await find(
      ".pane-choice:not(.is-unsupported) .pane-preview[data-preview-state='ready'] .pane-preview-line",
    );
    previewText = await webdriver(`/session/${sessionId}/element/${previewLine}/text`);
    if (!previewText.trim()) throw new Error("Pane preview did not render terminal content");
  }
  await find(".pane-choice .agent-label");
  const toggleAll = await find("#toggle-all-workspaces");
  const toggleAllText = await webdriver(`/session/${sessionId}/element/${toggleAll}/text`);
  if (toggleAllText.includes("展開")) {
    await webdriver(`/session/${sessionId}/element/${toggleAll}/click`, {
      method: "POST",
      body: {},
    });
    await delay(150);
  }
  const routeMetrics = await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: `
        const filters = document.querySelector('.agent-filters');
        const list = document.querySelector('.route-list');
        return {
          filterClientHeight: filters.clientHeight,
          filterScrollHeight: filters.scrollHeight,
          listClientHeight: list.clientHeight,
          listScrollHeight: list.scrollHeight,
        };
      `,
      args: [],
    },
  });
  if (routeMetrics.filterScrollHeight > routeMetrics.filterClientHeight + 1) {
    throw new Error(`Agent filters gained a vertical scrollbar: ${JSON.stringify(routeMetrics)}`);
  }
  if (routeMetrics.listClientHeight <= 0) {
    throw new Error(`Pane route list lost its scroll viewport: ${JSON.stringify(routeMetrics)}`);
  }
  if (browserWidth > 760) {
    const outerScroll = await webdriver(`/session/${sessionId}/execute/sync`, {
      method: "POST",
      body: {
        script: `return {
          viewport: window.innerHeight,
          documentHeight: document.documentElement.scrollHeight,
          bodyHeight: document.body.scrollHeight,
        };`,
        args: [],
      },
    });
    if (outerScroll.documentHeight > outerScroll.viewport + 2) {
      throw new Error(`Desktop page gained an outer scrollbar: ${JSON.stringify(outerScroll)}`);
    }
  }
  await find(".agent-filters [data-agent-filter='codex']");
  await webdriver(`/session/${sessionId}/element/${pane}/click`, {
    method: "POST",
    body: {},
  });

  const paneValueElement = await find("#target-pane");
  const paneId = await webdriver(`/session/${sessionId}/element/${paneValueElement}/text`);
  const fields = await find("#schedule-fields");
  const disabled = await webdriver(
    `/session/${sessionId}/element/${fields}/property/disabled`,
  );
  const fingerprintElement = await find("#target-fingerprint");
  const fingerprint = await webdriver(
    `/session/${sessionId}/element/${fingerprintElement}/text`,
  );

  if (disabled) throw new Error("Schedule form remained disabled after pane selection");
  if (!/^w[^:]*:p/.test(paneId)) throw new Error(`Unexpected pane ID: ${paneId}`);
  if (!fingerprint || fingerprint === "無法驗證") {
    throw new Error("Conversation fingerprint was not rendered");
  }
  const selectedAgentElement = await find("#target-agent");
  const selectedAgent = await webdriver(`/session/${sessionId}/element/${selectedAgentElement}/text`);
  const immediateButton = await find("#send-immediately:not([disabled])");
  await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' }); return true;",
      args: [{ [elementKey]: immediateButton }],
    },
  });
  await webdriver(`/session/${sessionId}/element/${immediateButton}/click`, { method: "POST", body: {} });
  await find("#confirm-dialog[open]");
  const cancelImmediate = await find("#confirm-dialog button[value='cancel']");
  await webdriver(`/session/${sessionId}/element/${cancelImmediate}/click`, { method: "POST", body: {} });

  let existingJob = null;
  try {
    existingJob = await find(".job-item", 800);
  } catch {
    const historyTab = await find("[data-job-filter='history']");
    await webdriver(`/session/${sessionId}/element/${historyTab}/click`, { method: "POST", body: {} });
    try {
      existingJob = await find(".job-item", 1_500);
    } catch {
      // A clean installation can legitimately have no history either.
    }
  }
  if (existingJob) {
    const noisyCardDetails = await webdriver(`/session/${sessionId}/execute/sync`, {
      method: "POST",
      body: {
        script: "return Boolean(document.querySelector('.job-item .job-fingerprint, .job-item .job-pane, .job-item .copy-fingerprint'));",
        args: [],
      },
    });
    if (noisyCardDetails) throw new Error("Queue card still exposes technical identity details");
    await webdriver(`/session/${sessionId}/element/${existingJob}/click`, { method: "POST", body: {} });
    await find("#job-dialog[open] #job-dialog-message");
    const closeJobDialog = await find("#close-job-dialog");
    await webdriver(`/session/${sessionId}/element/${closeJobDialog}/click`, { method: "POST", body: {} });
  }
  const quotaButtonSelector = selectedAgent === "agy"
    ? "[data-quota-agent^='agy-']:not([disabled])"
    : `[data-quota-agent='${selectedAgent}']:not([disabled])`;
  const quotaTimeButton = await find(quotaButtonSelector);
  await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' }); return true;",
      args: [{ [elementKey]: quotaTimeButton }],
    },
  });
  await webdriver(`/session/${sessionId}/element/${quotaTimeButton}/click`, {
    method: "POST",
    body: {},
  });
  const quotaScheduledValue = await webdriver(
    `/session/${sessionId}/element/${await find("#scheduled-for")}/property/value`,
  );
  if (new Date(quotaScheduledValue).getTime() <= Date.now()) {
    throw new Error(`Quota reset quick time is not in the future: ${quotaScheduledValue}`);
  }

  const renameButton = await find("#edit-target-alias");
  await find("#edit-target-alias svg");
  await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' }); return true;",
      args: [{ [elementKey]: renameButton }],
    },
  });
  await webdriver(`/session/${sessionId}/element/${renameButton}/click`, {
    method: "POST",
    body: {},
  });
  await find("#target-alias-form:not([hidden])");
  const cancelRename = await find("#cancel-target-alias");
  await webdriver(`/session/${sessionId}/element/${cancelRename}/click`, {
    method: "POST",
    body: {},
  });
  await find("#target-alias-form[hidden]");

  for (const minutes of [120, 180, 240]) {
    await find(`[data-offset-minutes='${minutes}']`);
  }
  const threeHours = await find("[data-offset-minutes='180']");
  await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' }); return true;",
      args: [{ [elementKey]: threeHours }],
    },
  });
  await webdriver(`/session/${sessionId}/element/${threeHours}/click`, {
    method: "POST",
    body: {},
  });
  const quickTimeOffset = await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: `return Math.round((new Date(document.querySelector('#scheduled-for').value).getTime() - Date.now()) / 60000);`,
      args: [],
    },
  });
  if (quickTimeOffset < 179 || quickTimeOffset > 180) {
    throw new Error(`Three-hour quick time produced ${quickTimeOffset} minutes`);
  }

  const messageElement = await find("#message");
  await clearElement(messageElement);
  await sendKeys(messageElement, "空白鍵 回歸測試");
  const messageValue = await webdriver(
    `/session/${sessionId}/element/${messageElement}/property/value`,
  );
  if (messageValue !== "空白鍵 回歸測試") {
    throw new Error(`Textarea lost spaces: ${JSON.stringify(messageValue)}`);
  }

  const pastedImages = await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: `
        const bytes = Uint8Array.from([137,80,78,71,13,10,26,10]);
        const file = new File([bytes], 'clipboard.png', { type: 'image/png' });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const event = new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true });
        document.querySelector('#message').dispatchEvent(event);
        return document.querySelectorAll('.attachment-item').length;
      `,
      args: [],
    },
  });
  if (pastedImages !== 1) throw new Error(`Clipboard image paste created ${pastedImages} attachments`);
  const pastedRemove = await find(".attachment-remove");
  await webdriver(`/session/${sessionId}/execute/sync`, {
    method: "POST",
    body: {
      script: "arguments[0].scrollIntoView({ block: 'center', inline: 'nearest' }); return true;",
      args: [{ [elementKey]: pastedRemove }],
    },
  });
  await webdriver(`/session/${sessionId}/element/${pastedRemove}/click`, {
    method: "POST",
    body: {},
  });

  if (testImagePath) {
    const attachmentInput = await find("#attachment-input");
    await sendKeys(attachmentInput, testImagePath);
    await find(".attachment-item");
  }

  if (createJob) {
    const submit = await find("#schedule-submit");
    await webdriver(`/session/${sessionId}/element/${submit}/click`, {
      method: "POST",
      body: {},
    });
    await find(".job-item", 20_000);
    await find(".job-countdown");
    await find("#target-empty:not([hidden])");
    const clearedMessage = await webdriver(
      `/session/${sessionId}/element/${messageElement}/property/value`,
    );
    if (clearedMessage !== "") throw new Error("Composer did not clear after scheduling");

    const createdJobCard = await find(".job-item");
    await webdriver(`/session/${sessionId}/element/${createdJobCard}/click`, {
      method: "POST",
      body: {},
    });
    const editor = await find("#job-dialog[open] #job-dialog-message");
    await clearElement(editor);
    await sendKeys(editor, "更新 後訊息");
    const saveButton = await find("[data-job-action='save-message']");
    await webdriver(`/session/${sessionId}/element/${saveButton}/click`, {
      method: "POST",
      body: {},
    });
    await delay(250);
    const editedText = await webdriver(`/session/${sessionId}/element/${editor}/property/value`);
    if (editedText !== "更新 後訊息") throw new Error("Queue message edit did not persist");
    const closeCreatedJob = await find("#close-job-dialog");
    await webdriver(`/session/${sessionId}/element/${closeCreatedJob}/click`, { method: "POST", body: {} });
  }

  if (captureErrorState) {
    await webdriver(`/session/${sessionId}/execute/sync`, {
      method: "POST",
      body: {
        script: `
          const originalFetch = window.fetch.bind(window);
          window.fetch = (url, options = {}) => {
            if (String(url).endsWith('/api/jobs') && options.method === 'POST') {
              return Promise.resolve(new Response(
                JSON.stringify({ error: '選取後 agent session 已變更，請重新選擇 pane 再建立排程' }),
                { status: 409, headers: { 'content-type': 'application/json' } }
              ));
            }
            return originalFetch(url, options);
          };
          return true;
        `,
        args: [],
      },
    });
    const submit = await find("#schedule-submit");
    await webdriver(`/session/${sessionId}/element/${submit}/click`, {
      method: "POST",
      body: {},
    });
    await find(".toast.is-error");
  }

  if (screenshotPath) {
    if (captureJobDialog) {
      const card = await find(".job-item");
      await webdriver(`/session/${sessionId}/element/${card}/click`, { method: "POST", body: {} });
      await find("#job-dialog[open]");
    }
    if (captureQuotaPanel) {
      const orb = await find("#quota-orb");
      await webdriver(`/session/${sessionId}/element/${orb}/click`, { method: "POST", body: {} });
      await find("#quota-panel:not([hidden])");
    }
    await webdriver(`/session/${sessionId}/execute/sync`, {
      method: "POST",
      body: {
        script: `
          document.querySelectorAll('.toast').forEach((node) => node.remove());
          const quotaFloat = document.querySelector('#quota-float');
          quotaFloat.style.left = (window.innerWidth - 64) + 'px';
          quotaFloat.style.top = (window.innerHeight - 64) + 'px';
          window.scrollTo({ top: 0, behavior: 'instant' });
          return window.scrollY;
        `,
        args: [],
      },
    });
    await delay(450);
    const screenshot = await webdriver(`/session/${sessionId}/screenshot`);
    await writeFile(screenshotPath, Buffer.from(screenshot, "base64"));
  }

  console.log(
    `Browser smoke passed: selected ${paneId}, fingerprint ${fingerprint}, preview ${previewText.slice(0, 48)}`,
  );
} finally {
  if (sessionId) {
    await webdriver(`/session/${sessionId}`, { method: "DELETE" }).catch(() => {});
  }
  driver.kill("SIGTERM");
}

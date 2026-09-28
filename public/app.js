import { ConversationRequestState } from "./conversation-request-state.js";
import { renderMarkdown } from "./markdown.js";

const ui = {
  attachmentInput: document.querySelector("#attachment-input"),
  attachmentList: document.querySelector("#attachment-list"),
  agentFilters: document.querySelector(".agent-filters"),
  cancelTargetAlias: document.querySelector("#cancel-target-alias"),
  clearTargetAlias: document.querySelector("#clear-target-alias"),
  editTargetAlias: document.querySelector("#edit-target-alias"),
  jobList: document.querySelector("#job-list"),
  jobDialog: document.querySelector("#job-dialog"),
  jobDialogActions: document.querySelector("#job-dialog-actions"),
  jobDialogAttachments: document.querySelector("#job-dialog-attachments"),
  jobDialogAttachmentInput: document.querySelector("#job-dialog-attachment-input"),
  jobDialogAttachmentList: document.querySelector("#job-dialog-attachment-list"),
  jobDialogMessageField: document.querySelector("#job-dialog-message-field"),
  jobDialogMessage: document.querySelector("#job-dialog-message"),
  jobDialogQuickTime: document.querySelector("#job-dialog-quick-time"),
  jobDialogScheduledFor: document.querySelector("#job-dialog-scheduled-for"),
  jobDialogStatus: document.querySelector("#job-dialog-status"),
  jobDialogSummary: document.querySelector("#job-dialog-summary"),
  jobDialogTechnical: document.querySelector("#job-dialog-technical"),
  jobDialogTiming: document.querySelector("#job-dialog-timing"),
  jobDialogTitle: document.querySelector("#job-dialog-title"),
  closeJobDialog: document.querySelector("#close-job-dialog"),
  closeConversationSearch: document.querySelector("#close-conversation-search"),
  conversationAgent: document.querySelector("#conversation-agent"),
  conversationContext: document.querySelector("#conversation-context"),
  conversationContextMeta: document.querySelector("#conversation-context-meta"),
  conversationDialog: document.querySelector("#conversation-dialog"),
  conversationDialogTitle: document.querySelector("#conversation-dialog-title"),
  conversationDialogSubtitle: document.querySelector("#conversation-dialog-subtitle"),
  conversationLoadMore: document.querySelector("#conversation-load-more"),
  conversationQuery: document.querySelector("#conversation-query"),
  conversationResults: document.querySelector("#conversation-results"),
  conversationResultCount: document.querySelector("#conversation-result-count"),
  conversationRoleAssistant: document.querySelector("#conversation-role-assistant"),
  conversationRoleUser: document.querySelector("#conversation-role-user"),
  conversationSearchForm: document.querySelector("#conversation-search-form"),
  conversationSearchStatus: document.querySelector("#conversation-search-status"),
  conversationSearchSubmit: document.querySelector("#conversation-search-submit"),
  composerActionbar: document.querySelector(".composer-actionbar"),
  composerHeading: document.querySelector(".composer-heading"),
  composerPanel: document.querySelector(".composer-panel"),
  deliveryModeFieldset: document.querySelector("#delivery-mode-fieldset"),
  messageField: document.querySelector("#message-field"),
  message: document.querySelector("#message"),
  saveToLibrary: document.querySelector("#save-to-library"),
  libraryPanel: document.querySelector("#library-panel"),
  libraryForm: document.querySelector("#library-form"),
  libraryName: document.querySelector("#library-name"),
  libraryMessage: document.querySelector("#library-message"),
  librarySave: document.querySelector("#library-save"),
  libraryCancelEdit: document.querySelector("#library-cancel-edit"),
  libraryList: document.querySelector("#library-list"),
  messageCount: document.querySelector("#message-count"),
  attachmentField: document.querySelector("#attachment-field"),
  recurrenceField: document.querySelector("#recurrence-field"),
  dispatchPolicyFieldset: document.querySelector("#dispatch-policy-fieldset"),
  graceField: document.querySelector("#grace-field"),
  enterOnlyNote: document.querySelector("#enter-only-note"),
  openConversationSearch: document.querySelector("#open-conversation-search"),
  openGlobalConversationSearch: document.querySelector("#open-global-conversation-search"),
  paneFilter: document.querySelector("#pane-filter"),
  paneSearchPopover: document.querySelector("#pane-search-popover"),
  refreshTopology: document.querySelector("#refresh-topology"),
  openResourceMonitor: document.querySelector("#open-resource-monitor"),
  resourceButtonDot: document.querySelector("#resource-button-dot"),
  resourceDialog: document.querySelector("#resource-dialog"),
  closeResourceMonitor: document.querySelector("#close-resource-monitor"),
  refreshResources: document.querySelector("#refresh-resources"),
  resourceStatusBadge: document.querySelector("#resource-status-badge"),
  resourceReadAt: document.querySelector("#resource-read-at"),
  resourceHostStatus: document.querySelector("#resource-host-status"),
  resourceHostMetrics: document.querySelector("#resource-host-metrics"),
  resourcePressure: document.querySelector("#resource-pressure"),
  resourceOverview: document.querySelector("#resource-overview"),
  resourceWorkloadStatus: document.querySelector("#resource-workload-status"),
  resourceWorkloadSummary: document.querySelector("#resource-workload-summary"),
  resourceWorkloadPanels: document.querySelector("#resource-workload-panels"),
  resourceServices: document.querySelector("#resource-services"),
  resourceAlerts: document.querySelector("#resource-alerts"),
  routeList: document.querySelector("#route-list"),
  scheduleFields: document.querySelector("#schedule-fields"),
  scheduleForm: document.querySelector("#schedule-form"),
  scheduleSubmit: document.querySelector("#schedule-submit"),
  sendImmediately: document.querySelector("#send-immediately"),
  scheduledFor: document.querySelector("#scheduled-for"),
  serviceState: document.querySelector("#service-state"),
  targetAgent: document.querySelector("#target-agent"),
  targetAgentPill: document.querySelector("#target-agent-pill"),
  targetAliasForm: document.querySelector("#target-alias-form"),
  targetAliasInput: document.querySelector("#target-alias-input"),
  targetEmpty: document.querySelector("#target-empty"),
  targetFingerprint: document.querySelector("#target-fingerprint"),
  targetPane: document.querySelector("#target-pane"),
  targetPreview: document.querySelector("#target-preview"),
  targetSession: document.querySelector("#target-session"),
  targetStatus: document.querySelector("#target-status"),
  targetSummary: document.querySelector("#target-summary"),
  targetTitle: document.querySelector("#target-title"),
  themeToggle: document.querySelector("#theme-toggle"),
  timezoneLabel: document.querySelector("#timezone-label"),
  toastRegion: document.querySelector("#toast-region"),
  toggleAllWorkspaces: document.querySelector("#toggle-all-workspaces"),
  queueSummary: document.querySelector("#queue-summary"),
  quotaBackdrop: document.querySelector("#quota-backdrop"),
  quotaGrid: document.querySelector("#quota-grid"),
  quotaFloat: document.querySelector("#quota-float"),
  quotaOrb: document.querySelector("#quota-orb"),
  quotaPanel: document.querySelector("#quota-panel"),
  quotaQuickTimes: document.querySelector("#quota-quick-times"),
  refreshQuota: document.querySelector("#refresh-quota"),
  closeQuota: document.querySelector("#close-quota"),
  togglePaneSearch: document.querySelector("#toggle-pane-search"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmTitle: document.querySelector("#confirm-title"),
  confirmCopy: document.querySelector("#confirm-copy"),
  confirmAccept: document.querySelector("#confirm-accept"),
};

const appState = {
  topology: null,
  selected: null,
  jobs: [],
  aliases: [],
  messages: [],
  libraryEditingId: null,
  agentFilter: "all",
  jobFilter: "active",
  collapsedWorkspaces: new Set(),
  loadingTopology: false,
  mobileTopologyPrepared: false,
  panePreviews: new Map(),
  paneLayouts: new Map(),
  sessionRepairs: new Map(),
  autoRepairAttempts: new Set(),
  routeView: localStorage.getItem("pane-relay-route-view") ||
    (window.matchMedia("(max-width: 760px)").matches ? "list" : "space"),
  attachments: [],
  drafts: new Map(),
  activeJobId: null,
  jobDialogDirty: false,
  jobDialogAttachmentItems: [],
  editingAlias: false,
  herdrFocus: new Map(),
  quota: null,
  resources: null,
  loadingResources: false,
  conversationSearch: new ConversationRequestState(),
};

const SEARCHABLE_TRANSCRIPT_SOURCES = new Set([
  "herdr:antigravity_cli",
  "herdr:claude",
  "herdr:codex",
]);

const visiblePreviewKeys = new Set();
const visibleLayoutKeys = new Set();
let previewObserver;
let layoutObserver;
const PREVIEW_STALE_MS = 55_000;
const LAYOUT_STALE_MS = 18_000;

const ACTIVE_STATUSES = new Set(["scheduled", "deferred", "dispatching", "paused", "detached"]);
const EDITABLE_STATUSES = new Set(["scheduled", "deferred", "paused", "detached"]);
const DEFAULT_MESSAGE = "請接續原本的工作，從目前進度繼續完成。完成後請整理結果與尚未解決的問題。";
const DRAFT_STORAGE_PREFIX = "pane-relay-draft:v1:";
const STATUS_TEXT = {
  blocked: "blocked",
  canceled: "已取消",
  deferred: "等待中",
  detached: "待重新綁定",
  dispatching: "傳送中",
  done: "done",
  edited: "已編輯",
  failed: "失敗",
  idle: "idle",
  paused: "已暫停",
  scheduled: "已排程",
  sent: "已送達",
  unknown: "unknown",
  working: "working",
};

function element(tagName, options = {}, children = []) {
  const node = document.createElement(tagName);
  for (const [key, value] of Object.entries(options)) {
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "on") {
      for (const [eventName, listener] of Object.entries(value)) {
        node.addEventListener(eventName, listener);
      }
    } else if (value !== undefined && value !== null) {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) node.append(child);
  return node;
}

function statusLabel(status) {
  return element("span", {
    className: "status-label",
    text: STATUS_TEXT[status] || status || "unknown",
    dataset: { status: status || "unknown" },
  });
}

function agentName(agent) {
  return {
    agy: "AGY",
    claude: "Claude",
    codex: "Codex",
    shell: "Shell",
  }[agent] || (agent ? String(agent).toUpperCase() : "Shell");
}

function agentLabel(agent) {
  const normalized = agent || "shell";
  return element("span", {
    className: "agent-label",
    text: agentName(normalized),
    dataset: { agent: normalized },
  });
}

function shortFingerprint(fingerprint) {
  if (!fingerprint?.value) return "無法驗證";
  const value = fingerprint.value;
  return value.length > 17 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function paneFingerprint(pane) {
  const source = pane?.agent_session;
  if (!source?.source || !source?.value) return null;
  return {
    agent: source.agent || pane.agent || null,
    kind: source.kind || null,
    source: source.source,
    value: source.value,
  };
}

function aliasForFingerprint(fingerprint) {
  return appState.aliases.find((item) => sameFingerprint(item.fingerprint, fingerprint)) || null;
}

function paneDisplayName(pane, fingerprint = paneFingerprint(pane)) {
  return aliasForFingerprint(fingerprint)?.label ||
    pane?.terminal_title_stripped ||
    pane?.pane_id ||
    pane?.agent ||
    "Terminal pane";
}

function previewKey(sessionName, paneId) {
  return `${sessionName}\u001f${paneId}`;
}

function layoutKey(sessionName, tabId) {
  return `${sessionName}\u001f${tabId}`;
}

function sessionRepairKey(sessionName, paneId) {
  return `${sessionName}\u001f${paneId}`;
}

function canRepairPane(row) {
  return ["codex", "agy"].includes(row?.pane?.agent);
}

function repairStateFor(row) {
  return appState.sessionRepairs.get(
    sessionRepairKey(row.sessionName, row.pane.pane_id),
  );
}

function renderPreviewNode(node, key, compact = false) {
  const preview = appState.panePreviews.get(key);
  node.replaceChildren();
  node.dataset.previewState = preview?.status || "loading";

  if (!preview || preview.status === "loading") {
    node.append(element("span", { className: "pane-preview-message", text: "讀取末尾內容…" }));
    return;
  }
  if (preview.status === "error") {
    node.append(element("span", { className: "pane-preview-message", text: "內容暫時無法讀取" }));
    return;
  }
  if (!preview.lines?.length) {
    node.append(element("span", { className: "pane-preview-message", text: "這個 pane 尚無最近輸出" }));
    return;
  }

  for (const line of preview.lines.slice(0, compact ? 2 : 4)) {
    node.append(element("span", { className: "pane-preview-line", text: line }));
  }
}

function updatePreviewNodes(key) {
  for (const node of document.querySelectorAll("[data-preview-key]")) {
    if (node.dataset.previewKey === key) {
      renderPreviewNode(node, key, node.dataset.previewCompact === "true");
    }
  }
}

async function loadPanePreview(sessionName, paneId, { force = false } = {}) {
  const key = previewKey(sessionName, paneId);
  const current = appState.panePreviews.get(key);
  if (current?.promise) return current.promise;
  if (
    !force &&
    current?.status === "ready" &&
    Date.now() - current.loadedAt < PREVIEW_STALE_MS
  ) {
    return current;
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams({ session: sessionName, pane: paneId });
      const data = await requestJson(`/api/pane-preview?${params}`);
      const next = {
        status: "ready",
        lines: Array.isArray(data.lines) ? data.lines : [],
        loadedAt: Date.now(),
      };
      appState.panePreviews.set(key, next);
      updatePreviewNodes(key);
      return next;
    } catch (error) {
      const next = { status: "error", error: error.message, loadedAt: Date.now() };
      appState.panePreviews.set(key, next);
      updatePreviewNodes(key);
      return next;
    }
  })();

  appState.panePreviews.set(key, {
    ...current,
    status: current?.lines?.length ? current.status : "loading",
    promise,
  });
  updatePreviewNodes(key);
  return promise;
}

function observeRoutePreviews() {
  previewObserver?.disconnect();
  visiblePreviewKeys.clear();
  const nodes = [...ui.routeList.querySelectorAll(".pane-preview[data-preview-key]")];
  if (!("IntersectionObserver" in window)) {
    for (const node of nodes.slice(0, 8)) {
      visiblePreviewKeys.add(node.dataset.previewKey);
      void loadPanePreview(node.dataset.previewSession, node.dataset.previewPane);
    }
    return;
  }

  previewObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const node = entry.target;
        const key = node.dataset.previewKey;
        if (entry.isIntersecting) {
          visiblePreviewKeys.add(key);
          void loadPanePreview(node.dataset.previewSession, node.dataset.previewPane);
        } else {
          visiblePreviewKeys.delete(key);
        }
      }
    },
    { root: ui.routeList, rootMargin: "180px 0px" },
  );
  for (const node of nodes) previewObserver.observe(node);
}

function refreshVisiblePreviews() {
  if (document.visibilityState !== "visible") return;
  for (const node of ui.routeList.querySelectorAll(".pane-preview[data-preview-key]")) {
    if (!visiblePreviewKeys.has(node.dataset.previewKey)) continue;
    void loadPanePreview(node.dataset.previewSession, node.dataset.previewPane, { force: true });
  }
}

function paneMatchesFilter(row, filter) {
  if (!filter) return true;
  const preview = appState.panePreviews.get(
    previewKey(row.sessionName, row.pane.pane_id),
  );
  return [
    row.pane.pane_id,
    paneDisplayName(row.pane, row.fingerprint),
    row.pane.terminal_title_stripped,
    row.pane.cwd,
    row.pane.agent,
    row.tab?.label,
    ...(preview?.lines || []),
  ]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase().includes(filter));
}

function paneMatchesAgent(row) {
  if (appState.agentFilter === "all") return true;
  return (row.pane.agent || "shell") === appState.agentFilter;
}

function paneMatchesFilters(row, filter) {
  return paneMatchesAgent(row) && paneMatchesFilter(row, filter);
}

function sameFingerprint(left, right) {
  return Boolean(
    left &&
    right &&
    left.agent === right.agent &&
    left.source === right.source &&
    left.value === right.value,
  );
}

function formatDate(value, includeSeconds = false) {
  if (!value) return "未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間格式錯誤";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: false,
  }).format(date);
}

function toDateTimeLocal(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function composerDraftKey(row = appState.selected) {
  if (!row?.fingerprint) return null;
  return [
    row.sessionName,
    row.pane.pane_id,
    row.fingerprint.source,
    row.fingerprint.value,
  ].map(encodeURIComponent).join(":");
}

function composerValues() {
  const form = new FormData(ui.scheduleForm);
  return {
    deliveryMode: String(form.get("deliveryMode") || "prompt"),
    message: ui.message.value,
    scheduledFor: ui.scheduledFor.value,
    recurrence: String(form.get("recurrence") || "once"),
    dispatchMode: String(form.get("dispatchMode") || "settled"),
    graceMinutes: String(form.get("graceMinutes") || "360"),
  };
}

function currentDeliveryMode() {
  return ui.scheduleForm.elements.deliveryMode?.value === "enter" ? "enter" : "prompt";
}

function updateDeliveryModeUI() {
  const enterOnly = currentDeliveryMode() === "enter";
  ui.messageField.hidden = enterOnly;
  ui.attachmentField.hidden = enterOnly;
  ui.recurrenceField.hidden = enterOnly;
  ui.dispatchPolicyFieldset.hidden = enterOnly;
  ui.graceField.hidden = enterOnly;
  ui.enterOnlyNote.hidden = !enterOnly;
  ui.saveToLibrary.hidden = enterOnly;
  ui.message.disabled = enterOnly;
  ui.message.required = !enterOnly;
  ui.attachmentInput.disabled = enterOnly;
  ui.scheduleForm.elements.recurrence.disabled = enterOnly;
  for (const option of ui.scheduleForm.elements.dispatchMode) option.disabled = enterOnly;
  ui.scheduleForm.elements.graceMinutes.disabled = enterOnly;
  ui.scheduleSubmit.textContent = enterOnly ? "建立 Enter 排程" : "建立排程";
  ui.sendImmediately.textContent = enterOnly ? "立即按 Enter" : "立刻傳送";
}

function saveComposerDraft() {
  const key = composerDraftKey();
  if (!key) return;
  const draft = {
    ...composerValues(),
    attachments: appState.attachments,
    updatedAt: new Date().toISOString(),
  };
  appState.drafts.set(key, draft);
  try {
    sessionStorage.setItem(`${DRAFT_STORAGE_PREFIX}${key}`, JSON.stringify({
      ...draft,
      attachments: undefined,
    }));
  } catch {
    // Draft persistence is best-effort; pane switching still works in memory.
  }
}

function loadComposerDraft(row) {
  const key = composerDraftKey(row);
  let draft = key ? appState.drafts.get(key) : null;
  if (!draft && key) {
    try {
      draft = JSON.parse(sessionStorage.getItem(`${DRAFT_STORAGE_PREFIX}${key}`) || "null");
    } catch {
      draft = null;
    }
  }
  if (!draft) {
    const date = new Date(Date.now() + 305 * 60_000);
    date.setSeconds(0, 0);
    draft = {
      deliveryMode: "prompt",
      message: DEFAULT_MESSAGE,
      scheduledFor: toDateTimeLocal(date),
      recurrence: "once",
      dispatchMode: "settled",
      graceMinutes: "360",
      attachments: [],
    };
  }
  const deliveryMode = draft.deliveryMode === "enter" ? "enter" : "prompt";
  for (const option of ui.scheduleForm.elements.deliveryMode) {
    option.checked = option.value === deliveryMode;
  }
  ui.message.value = draft.message ?? DEFAULT_MESSAGE;
  ui.scheduledFor.value = draft.scheduledFor || "";
  ui.scheduledFor.min = toDateTimeLocal(new Date());
  ui.scheduleForm.elements.recurrence.value = draft.recurrence || "once";
  const dispatchMode = ui.scheduleForm.elements.dispatchMode;
  for (const option of dispatchMode) option.checked = option.value === (draft.dispatchMode || "settled");
  ui.scheduleForm.elements.graceMinutes.value = draft.graceMinutes || "360";
  appState.attachments = draft.attachments || [];
  ui.attachmentInput.value = "";
  updateDeliveryModeUI();
  updateMessageCount();
  renderAttachments();
}

function deleteComposerDraft(row = appState.selected) {
  const key = composerDraftKey(row);
  if (!key) return;
  appState.drafts.delete(key);
  try {
    sessionStorage.removeItem(`${DRAFT_STORAGE_PREFIX}${key}`);
  } catch {
    // Storage may be unavailable; the in-memory draft has still been removed.
  }
}

function setServiceState(kind, text) {
  ui.serviceState.className = `service-state ${kind ? `is-${kind}` : ""}`.trim();
  ui.serviceState.lastElementChild.textContent = text;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

function toast(message, type = "info") {
  const item = element("div", {
    className: `toast ${type === "error" ? "is-error" : ""}`.trim(),
    text: message,
  });
  ui.toastRegion.append(item);
  setTimeout(() => item.remove(), 4_500);
}

function formatBytes(value) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const RESOURCE_STATUS_TEXT = {
  healthy: "正常",
  warning: "注意",
  critical: "危險",
  unavailable: "無法讀取",
};

function formatResourceBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (number >= 1024 ** 3) return `${(number / 1024 ** 3).toFixed(1)} GiB`;
  if (number >= 1024 ** 2) return `${(number / 1024 ** 2).toFixed(1)} MiB`;
  if (number >= 1024) return `${Math.round(number / 1024)} KiB`;
  return `${Math.max(0, Math.round(number))} B`;
}

function resourceStatusText(status) {
  return RESOURCE_STATUS_TEXT[status] || RESOURCE_STATUS_TEXT.unavailable;
}

function resourceStatusBadge(node, status) {
  node.className = `resource-status-badge is-${status || "unavailable"}`;
  node.textContent = resourceStatusText(status);
}

function resourceMetric(label, value, detail = "") {
  return element("div", { className: "resource-metric" }, [
    element("span", { className: "resource-metric-label", text: label }),
    element("strong", { className: "resource-metric-value", text: value }),
    ...(detail ? [element("span", { className: "resource-metric-detail", text: detail })] : []),
  ]);
}

function resourcePercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(number < 10 ? 1 : 0)}%` : "—";
}

function resourceLoadLabel(load, cpuCount) {
  if (!Number.isFinite(Number(load?.one))) return "—";
  return `${Number(load.one).toFixed(1)} / ${cpuCount || "?"} CPU`;
}

function resourcePressureValue(pressure) {
  const value = Number(pressure?.some?.avg10);
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
}

function renderResourceHost(host) {
  if (!host || host.status === "unavailable") {
    ui.resourceHostMetrics.replaceChildren(element("div", {
      className: "resource-loading is-error",
      text: "主機資源暫時無法讀取",
    }));
    ui.resourcePressure.replaceChildren();
    resourceStatusBadge(ui.resourceHostStatus, "unavailable");
    return;
  }

  const usedPercent = host.totalBytes > 0 && host.usedBytes !== null
    ? (host.usedBytes / host.totalBytes) * 100
    : null;
  ui.resourceHostMetrics.replaceChildren(
    resourceMetric("RAM 使用", formatResourceBytes(host.usedBytes), resourcePercent(usedPercent)),
    resourceMetric("RAM 可用", formatResourceBytes(host.availableBytes), resourcePercent(host.availablePercent)),
    resourceMetric("Swap", formatResourceBytes(host.swapUsedBytes), host.swapTotalBytes > 0 ? resourcePercent(host.swapPercent) : "未啟用"),
    resourceMetric("系統負載", resourceLoadLabel(host.load, host.cpuCount), `${Number(host.load?.five || 0).toFixed(1)} / ${Number(host.load?.fifteen || 0).toFixed(1)} · ${host.cpuCount || "?"} cores`),
  );
  ui.resourcePressure.replaceChildren(
    element("span", { text: `Memory pressure ${resourcePressureValue(host.pressure?.memory)}` }),
    element("span", { text: `CPU pressure ${resourcePressureValue(host.pressure?.cpu)}` }),
    element("span", { text: `I/O pressure ${resourcePressureValue(host.pressure?.io)}` }),
  );
  resourceStatusBadge(ui.resourceHostStatus, host.status);
}

const RESOURCE_SERVICE_CHART_STYLES = Object.freeze({
  herdr: { color: "var(--resource-herdr)", swatchClass: "is-herdr" },
  "screenshot-editor": { color: "var(--resource-screenshot)", swatchClass: "is-screenshot" },
  "pane-relay": { color: "var(--resource-pane-relay)", swatchClass: "is-pane-relay" },
});
const RESOURCE_SERVICE_FALLBACK_STYLES = [
  { color: "var(--resource-herdr)", swatchClass: "is-herdr" },
  { color: "var(--resource-screenshot)", swatchClass: "is-screenshot" },
  { color: "var(--resource-pane-relay)", swatchClass: "is-pane-relay" },
];
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function svgElement(tagName, attributes = {}) {
  const node = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

function resourceChartSegments(segments) {
  return (segments || [])
    .map((segment) => ({ ...segment, value: Number(segment.value) }))
    .filter((segment) => Number.isFinite(segment.value) && segment.value > 0);
}

function createResourceDonut(label, segments, centerValue, centerLabel) {
  const visibleSegments = resourceChartSegments(segments);
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
  const chart = element("div", { className: "resource-donut" });
  const ariaLabel = visibleSegments.length
    ? `${label}：${visibleSegments.map((segment) => `${segment.label} ${formatResourceBytes(segment.value)}`).join("、")}`
    : `${label}：目前無資料`;
  const svg = svgElement("svg", { viewBox: "0 0 160 160", role: "img", "aria-label": ariaLabel });
  const group = svgElement("g", { transform: "rotate(-90 80 80)" });
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  group.append(svgElement("circle", {
    cx: 80,
    cy: 80,
    r: radius,
    fill: "none",
    stroke: "var(--surface-muted)",
    "stroke-width": 20,
  }));
  let offset = 0;
  for (const segment of visibleSegments) {
    const length = total > 0 ? (segment.value / total) * circumference : 0;
    group.append(svgElement("circle", {
      cx: 80,
      cy: 80,
      r: radius,
      fill: "none",
      stroke: segment.color,
      "stroke-width": 20,
      "stroke-dasharray": `${length} ${circumference - length}`,
      "stroke-dashoffset": -offset,
      "stroke-linecap": "butt",
    }));
    offset += length;
  }
  svg.append(group);
  chart.append(
    svg,
    element("div", { className: "resource-donut-center", "aria-hidden": "true" }, [
      element("strong", { text: centerValue }),
      element("span", { text: centerLabel }),
    ]),
  );
  return chart;
}

function createResourceLegend(segments) {
  const visibleSegments = resourceChartSegments(segments);
  const total = visibleSegments.reduce((sum, segment) => sum + segment.value, 0);
  if (!visibleSegments.length) return element("p", { className: "resource-empty-copy", text: "目前無可視化資料" });
  return element("ul", { className: "resource-chart-legend" }, visibleSegments.map((segment) => {
    const percent = total > 0 ? (segment.value / total) * 100 : 0;
    return element("li", { className: "resource-chart-legend-item" }, [
      element("span", { className: `resource-chart-swatch ${segment.swatchClass || "is-accent"}`, "aria-hidden": "true" }),
      element("div", { className: "resource-chart-legend-copy" }, [
        element("strong", { text: segment.label }),
        element("span", { text: `${formatResourceBytes(segment.value)} · ${resourcePercent(percent)}` }),
      ]),
    ]);
  }));
}

function createResourceChartPanel(title, subtitle, segments, centerValue, centerLabel) {
  return element("article", { className: "resource-chart-panel" }, [
    element("header", {}, [
      element("h4", { text: title }),
      element("span", { text: subtitle }),
    ]),
    element("div", { className: "resource-chart-content" }, [
      createResourceDonut(title, segments, centerValue, centerLabel),
      createResourceLegend(segments),
    ]),
  ]);
}

function resourceServiceChartStyle(service, index) {
  return RESOURCE_SERVICE_CHART_STYLES[service.id] || RESOURCE_SERVICE_FALLBACK_STYLES[index % RESOURCE_SERVICE_FALLBACK_STYLES.length];
}

function renderResourceOverview(host, services) {
  if (!host || host.status === "unavailable") {
    ui.resourceOverview.replaceChildren(element("div", {
      className: "resource-loading is-error",
      text: "資源分布暫時無法讀取",
    }));
    return;
  }

  const totalBytes = Number(host.totalBytes);
  const usedBytes = Math.max(0, Number(host.usedBytes) || 0);
  const availableBytes = Math.max(0, Number(host.availableBytes) || 0);
  const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : null;
  const memorySegments = [
    { label: "已用 RAM", value: usedBytes, color: "var(--accent)", swatchClass: "is-accent" },
    { label: "可用 RAM", value: availableBytes, color: "var(--surface-muted)", swatchClass: "is-muted" },
  ];
  const serviceSegments = (services || []).map((service, index) => {
    const chartStyle = resourceServiceChartStyle(service, index);
    return {
      label: service.label,
      value: Math.max(0, Number(service.memoryBytes) || 0),
      color: chartStyle.color,
      swatchClass: chartStyle.swatchClass,
    };
  });
  const serviceTotalBytes = serviceSegments.reduce((sum, segment) => sum + segment.value, 0);
  const otherBytes = Math.max(0, (totalBytes || usedBytes) - serviceTotalBytes);
  if (otherBytes > 0) serviceSegments.push({ label: "其他／核心", value: otherBytes, color: "var(--line-strong)", swatchClass: "is-line" });
  const serviceShare = totalBytes > 0 ? (serviceTotalBytes / totalBytes) * 100 : null;
  ui.resourceOverview.replaceChildren(
    createResourceChartPanel(
      "RAM 組成",
      "已用 vs 可用",
      memorySegments,
      resourcePercent(usedPercent),
      "RAM 使用",
    ),
    createResourceChartPanel(
      "Service 記憶體",
      "目前占主機總量",
      serviceSegments,
      resourcePercent(serviceShare),
      "三個 service",
    ),
  );
}

function resourceCpuText(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `CPU ${number.toFixed(1)}%` : "CPU 取樣中";
}

function createResourceWorkloadRow(group) {
  return element("li", { className: "resource-workload-row" }, [
    element("div", { className: "resource-workload-row-heading" }, [
      element("strong", { text: group.label }),
      element("span", { text: `${group.count} 程序 · RSS ${formatResourceBytes(group.rssBytes)}` }),
    ]),
    element("div", { className: "resource-workload-row-meta" }, [
      element("span", { text: resourceCpuText(group.cpuPercent) }),
      element("code", { text: group.commandLine || group.label }),
    ]),
  ]);
}

function createResourceWorkloadPanel(title, groups, emptyText) {
  return element("article", { className: "resource-workload-panel" }, [
    element("header", {}, [element("h4", { text: title })]),
    groups?.length
      ? element("ol", { className: "resource-workload-list" }, groups.map(createResourceWorkloadRow))
      : element("p", { className: "resource-empty-copy", text: emptyText }),
  ]);
}

function createResourceProcessList(title, processes, emptyText) {
  return element("section", { className: "resource-workload-process-column" }, [
    element("h5", { text: title }),
    processes?.length
      ? element("ol", { className: "resource-process-list" }, processes.map((process) =>
        element("li", {}, [
          element("div", { className: "resource-process-topline" }, [
            element("strong", { text: `${process.name} · ${process.pid}` }),
            element("span", { text: formatResourceBytes(process.rssBytes) }),
          ]),
          element("code", { text: process.commandLine }),
          element("span", { className: "resource-process-cpu", text: resourceCpuText(process.cpuPercent) }),
        ]),
      ))
      : element("p", { className: "resource-empty-copy", text: emptyText }),
  ]);
}

function renderResourceWorkloads(workloads, host, error = "") {
  if (error || !workloads) {
    resourceStatusBadge(ui.resourceWorkloadStatus, "unavailable");
    ui.resourceWorkloadSummary.replaceChildren(element("div", { className: "resource-loading is-error", text: error || "背景程序暫時無法讀取" }));
    ui.resourceWorkloadPanels.replaceChildren();
    return;
  }

  resourceStatusBadge(ui.resourceWorkloadStatus, workloads.status);
  const topCpuGroup = workloads.topCpuGroups?.[0];
  const topMemoryGroup = workloads.topMemoryGroups?.[0];
  ui.resourceWorkloadSummary.replaceChildren(
    resourceMetric("主機程序", workloads.processCount === null ? "—" : String(workloads.processCount), workloads.sampleReady ? "CPU 已完成第二次取樣" : "CPU 第一次取樣中"),
    resourceMetric("CPU pressure", resourcePressureValue(host?.pressure?.cpu), "10 秒平均"),
    resourceMetric("CPU 熱點", topCpuGroup?.label || "取樣中", topCpuGroup ? resourceCpuText(topCpuGroup.cpuPercent) : "等待第二次更新"),
    resourceMetric("記憶體熱點", topMemoryGroup?.label || "—", topMemoryGroup ? formatResourceBytes(topMemoryGroup.rssBytes) : "目前無資料"),
  );
  ui.resourceWorkloadPanels.replaceChildren(
    createResourceWorkloadPanel("CPU 熱點群組", workloads.topCpuGroups, "CPU 尚在取樣；約 10 秒後會出現排行"),
    createResourceWorkloadPanel("記憶體熱點群組", workloads.topMemoryGroups, "目前沒有可列出的程序"),
    element("details", { className: "resource-workload-process-details" }, [
      element("summary", { text: "展開 PID 排行（協助定位實際程序）" }),
      element("div", { className: "resource-workload-process-columns" }, [
        createResourceProcessList("CPU 前幾名", workloads.topCpuProcesses, "CPU 尚在取樣"),
        createResourceProcessList("記憶體前幾名", workloads.topMemoryProcesses, "目前沒有可列出的程序"),
      ]),
    ]),
  );
}

function resourceServiceMemoryDetail(service, host) {
  if (service.memoryLimitBytes > 0) {
    return `${formatResourceBytes(service.memoryBytes)} / ${formatResourceBytes(service.memoryLimitBytes)}`;
  }
  return `${formatResourceBytes(service.memoryBytes)} / 主機 ${formatResourceBytes(host?.totalBytes)}`;
}

function createResourceServiceCard(service, host) {
  const systemd = service.systemd;
  const memoryBytes = service.memoryBytes || 0;
  const memoryBase = service.memoryLimitBytes > 0 ? service.memoryLimitBytes : host?.totalBytes;
  const memoryPercent = memoryBase > 0 ? Math.min(100, (memoryBytes / memoryBase) * 100) : 0;
  const processes = service.topProcesses || [];
  const processList = processes.length
    ? element("ol", { className: "resource-process-list", "aria-label": `${service.label} 前幾名程序` }, processes.map((process) =>
      element("li", {}, [
        element("div", { className: "resource-process-topline" }, [
          element("strong", { text: `${process.name} · ${process.pid}` }),
          element("span", { text: formatResourceBytes(process.rssBytes) }),
        ]),
        element("code", { text: process.commandLine }),
        element("span", { className: "resource-process-cpu", text: process.cpuPercent === null ? "CPU —" : `CPU ${process.cpuPercent.toFixed(1)}%` }),
      ]),
    ))
    : element("p", { className: "resource-empty-copy", text: service.status === "unavailable" ? "找不到這個 service 的 cgroup" : "目前沒有可列出的程序" });

  const systemdState = systemd
    ? `${systemd.activeState || "unknown"} / ${systemd.subState || "unknown"}${systemd.result && systemd.result !== "success" ? ` · ${systemd.result}` : ""}`
    : "systemd 狀態不可用";
  const restartText = systemd ? `重啟 ${systemd.restarts || 0} 次` : "重啟 —";
  const card = element("article", {
    className: `resource-service-card is-${service.status || "unavailable"}`,
    dataset: { resourceService: service.id },
  });
  card.append(
    element("header", { className: "resource-service-heading" }, [
      element("div", {}, [
        element("h4", { text: service.label }),
        element("span", { className: "resource-service-unit", text: service.unit }),
      ]),
      element("span", { className: "resource-status-badge", text: resourceStatusText(service.status), dataset: { status: service.status || "unavailable" } }),
    ]),
    element("div", { className: "resource-service-metrics" }, [
      resourceMetric("目前記憶體", formatResourceBytes(memoryBytes), resourceServiceMemoryDetail(service, host)),
      resourceMetric("峰值", formatResourceBytes(service.memoryPeakBytes)),
      resourceMetric("程序", service.processCount === null ? "—" : String(service.processCount)),
      resourceMetric("Tasks", service.tasks === null ? "—" : String(service.tasks)),
    ]),
    element("progress", {
      className: "resource-memory-track",
      value: memoryPercent,
      max: 100,
      "aria-label": `${service.label} 記憶體占比`,
      "aria-valuetext": `${resourcePercent(memoryPercent)} · ${resourceServiceMemoryDetail(service, host)}`,
    }),
    element("div", { className: "resource-service-meta" }, [
      element("span", { text: systemdState }),
      element("span", { text: restartText }),
      element("span", { text: service.cpuPercent === null ? "CPU —" : `CPU ${service.cpuPercent.toFixed(1)}%` }),
    ]),
    element("details", { className: "resource-process-details" }, [
      element("summary", { text: "前幾名程序" }),
      processList,
    ]),
  );
  return card;
}

function renderResourceServices(services, host) {
  ui.resourceServices.replaceChildren();
  if (!services?.length) {
    ui.resourceServices.append(element("div", { className: "resource-loading is-error", text: "沒有 service 資料" }));
    return;
  }
  for (const service of services) ui.resourceServices.append(createResourceServiceCard(service, host));
}

function renderResourceAlerts(alerts, error = "") {
  ui.resourceAlerts.replaceChildren();
  if (error) {
    ui.resourceAlerts.append(element("p", { className: "resource-alert is-warning", text: error }));
    return;
  }
  if (!alerts?.length) {
    ui.resourceAlerts.append(element("p", { className: "resource-alert is-healthy", text: "目前沒有 OOM 或 service 重啟警報" }));
    return;
  }
  for (const alert of alerts) {
    ui.resourceAlerts.append(element("p", {
      className: `resource-alert is-${alert.level || "warning"}`,
      text: alert.message,
    }));
  }
}

function renderResources() {
  const data = appState.resources;
  const status = data?.status || "unavailable";
  resourceStatusBadge(ui.resourceStatusBadge, status);
  ui.openResourceMonitor.setAttribute("aria-label", `開啟系統資源監控，目前狀態：${resourceStatusText(status)}`);
  ui.openResourceMonitor.title = `系統資源：${resourceStatusText(status)}`;
  ui.resourceButtonDot.className = `resource-button-dot is-${status}`;
  ui.resourceReadAt.textContent = data?.readAt ? `更新於 ${formatDate(data.readAt, true)}` : "尚未更新";
  if (data?.error) {
    renderResourceHost(null);
    renderResourceOverview(null, []);
    renderResourceWorkloads(null, null, data.error);
    renderResourceServices([], null);
    renderResourceAlerts([], data.error);
    return;
  }
  renderResourceHost(data?.host);
  renderResourceOverview(data?.host, data?.services || []);
  renderResourceWorkloads(data?.host?.workloads, data?.host);
  renderResourceServices(data?.services || [], data?.host);
  renderResourceAlerts(data?.alerts || []);
}

async function loadResources({ force = false, announce = false } = {}) {
  if (appState.loadingResources) return;
  if (!force && document.visibilityState !== "visible") return;
  appState.loadingResources = true;
  ui.refreshResources.disabled = true;
  if (force) ui.refreshResources.textContent = "更新中";
  try {
    appState.resources = await requestJson("/api/resources");
    renderResources();
    if (announce) toast("系統資源已更新");
  } catch (error) {
    appState.resources = { error: `資源讀取失敗：${error.message}` };
    renderResources();
  } finally {
    appState.loadingResources = false;
    ui.refreshResources.disabled = false;
    ui.refreshResources.textContent = "更新";
  }
}

function renderAttachments() {
  ui.attachmentList.replaceChildren();
  for (const attachment of appState.attachments) {
    const remove = element("button", {
      type: "button",
      className: "attachment-remove",
      text: "移除",
      "aria-label": `移除圖片 ${attachment.file.name}`,
      on: {
        click: () => {
          URL.revokeObjectURL(attachment.previewUrl);
          appState.attachments = appState.attachments.filter((item) => item.id !== attachment.id);
          renderAttachments();
          saveComposerDraft();
        },
      },
    });
    ui.attachmentList.append(
      element("div", { className: "attachment-item" }, [
        element("img", {
          src: attachment.previewUrl,
          alt: "",
          className: "attachment-thumb",
        }),
        element("div", { className: "attachment-copy" }, [
          element("strong", { text: attachment.file.name }),
          element("span", {
            text: attachment.status === "uploading"
              ? "上傳到本機中"
              : attachment.status === "error"
                ? "上傳失敗，送出時會重試"
                : `${formatBytes(attachment.file.size)} · ${attachment.uploaded ? "已存於本機" : "等待建立排程"}`,
          }),
        ]),
        remove,
      ]),
    );
  }
}

function jobDialogAttachmentItemsFor(job) {
  return (job.attachments || []).map((attachment) => ({
    id: attachment.id,
    file: null,
    previewUrl: null,
    status: "ready",
    uploaded: attachment,
    existing: true,
  }));
}

function renderJobDialogAttachments(job, editable) {
  const items = appState.jobDialogAttachmentItems;
  const enterOnly = job.deliveryMode === "enter";
  ui.jobDialogAttachments.hidden = enterOnly || (!editable && !items.length);
  ui.jobDialogAttachmentInput.disabled = enterOnly || !editable;
  ui.jobDialogAttachmentList.replaceChildren();
  for (const attachment of items) {
    const name = attachment.file?.name || attachment.uploaded?.name || "圖片";
    const remove = attachment.existing ? null : element("button", {
      type: "button",
      className: "attachment-remove",
      text: "移除",
      "aria-label": `移除待傳圖片 ${name}`,
      on: {
        click: () => {
          if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
          appState.jobDialogAttachmentItems = items.filter((item) => item.id !== attachment.id);
          appState.jobDialogDirty = true;
          renderJobDialogAttachments(job, editable);
        },
      },
    });
    const thumbnail = attachment.previewUrl
      ? element("img", { src: attachment.previewUrl, alt: "", className: "attachment-thumb" })
      : element("div", { className: "attachment-thumb attachment-placeholder", text: "已存" });
    const status = attachment.status === "uploading"
      ? "上傳到本機中"
      : attachment.status === "error"
        ? "上傳失敗，儲存時會重試"
        : attachment.existing
          ? `${formatBytes(attachment.uploaded?.size || 0)} · 已附加`
          : `${formatBytes(attachment.file.size)} · 等待儲存`;
    ui.jobDialogAttachmentList.append(element("div", { className: "attachment-item" }, [
      thumbnail,
      element("div", { className: "attachment-copy" }, [
        element("strong", { text: name }),
        element("span", { text: status }),
      ]),
      ...(remove ? [remove] : []),
    ]));
  }
}

function addJobDialogAttachmentFiles(files) {
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const extensions = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  const items = appState.jobDialogAttachmentItems;
  let added = 0;
  for (const sourceFile of files) {
    if (items.length >= 5) {
      toast("每個排程最多附加 5 張圖片", "error");
      break;
    }
    if (!allowed.has(sourceFile.type)) {
      toast(`${sourceFile.name || "圖片"} 不是支援的圖片格式`, "error");
      continue;
    }
    if (sourceFile.size > 8 * 1024 * 1024) {
      toast(`${sourceFile.name || "圖片"} 超過 8 MB`, "error");
      continue;
    }
    const file = sourceFile.name
      ? sourceFile
      : new File([sourceFile], `clipboard-${Date.now()}.${extensions[sourceFile.type]}`, { type: sourceFile.type });
    items.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      uploaded: null,
      existing: false,
    });
    added += 1;
  }
  appState.jobDialogDirty = appState.jobDialogDirty || added > 0;
  const job = appState.jobs.find((item) => item.id === appState.activeJobId);
  if (job) renderJobDialogAttachments(job, EDITABLE_STATUSES.has(job.status));
  return added;
}

async function uploadPendingJobDialogAttachments() {
  for (const attachment of appState.jobDialogAttachmentItems) {
    if (attachment.uploaded) continue;
    attachment.status = "uploading";
    const job = appState.jobs.find((item) => item.id === appState.activeJobId);
    renderJobDialogAttachments(job, true);
    try {
      const data = await readFileAsBase64(attachment.file);
      const response = await requestJson("/api/attachments", {
        method: "POST",
        body: JSON.stringify({ name: attachment.file.name, data }),
      });
      attachment.uploaded = response.attachment;
      attachment.status = "ready";
    } catch (error) {
      attachment.status = "error";
      if (job) renderJobDialogAttachments(job, true);
      throw error;
    }
  }
  return appState.jobDialogAttachmentItems.map((item) => item.uploaded).filter(Boolean);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result).split(",", 2)[1] || ""));
    reader.addEventListener("error", () => reject(reader.error || new Error("圖片讀取失敗")));
    reader.readAsDataURL(file);
  });
}

async function uploadPendingAttachments() {
  const uploaded = [];
  for (const attachment of appState.attachments) {
    if (attachment.uploaded) {
      uploaded.push(attachment.uploaded);
      continue;
    }
    attachment.status = "uploading";
    renderAttachments();
    try {
      const data = await readFileAsBase64(attachment.file);
      const response = await requestJson("/api/attachments", {
        method: "POST",
        body: JSON.stringify({ name: attachment.file.name, data }),
      });
      attachment.uploaded = response.attachment;
      attachment.status = "ready";
      saveComposerDraft();
      uploaded.push(response.attachment);
    } catch (error) {
      attachment.status = "error";
      renderAttachments();
      throw error;
    }
  }
  renderAttachments();
  return uploaded;
}

function clearComposer() {
  deleteComposerDraft();
  for (const attachment of appState.attachments) URL.revokeObjectURL(attachment.previewUrl);
  appState.attachments = [];
  appState.selected = null;
  ui.scheduleForm.reset();
  ui.message.value = "";
  ui.attachmentInput.value = "";
  setDateOffset(305);
  updateDeliveryModeUI();
  updateMessageCount();
  renderAttachments();
  renderTarget();
  renderRoutes();
}

function preserveFocus(container) {
  const active = document.activeElement;
  const key = container.contains(active) ? active?.dataset?.focusKey : null;
  if (!key) return;
  queueMicrotask(() => {
    const replacement = [...container.querySelectorAll("[data-focus-key]")].find(
      (item) => item.dataset.focusKey === key,
    );
    replacement?.focus({ preventScroll: true });
  });
}

function routeSkeleton() {
  const wrapper = element("div", { className: "route-skeleton", "aria-label": "讀取 pane 清單" });
  for (let index = 0; index < 5; index += 1) {
    wrapper.append(element("div", { className: "skeleton-line" }));
  }
  return wrapper;
}

function flattenTopology() {
  const rows = [];
  for (const session of appState.topology?.sessions || []) {
    for (const workspace of session.workspaces || []) {
      for (const pane of workspace.panes || []) {
        const tab = (workspace.tabs || []).find((item) => item.tab_id === pane.tab_id);
        rows.push({
          session,
          sessionName: session.name,
          workspace,
          workspaceLabel: workspace.label || workspace.workspace_id,
          tab,
          pane,
          fingerprint: paneFingerprint(pane),
        });
      }
    }
  }
  return rows;
}

function reconcileSelection() {
  if (!appState.selected) return;
  const current = flattenTopology().find(
    (item) =>
      item.sessionName === appState.selected.sessionName &&
      item.pane.pane_id === appState.selected.pane.pane_id,
  );
  if (!current || !sameFingerprint(current.fingerprint, appState.selected.fingerprint)) {
    saveComposerDraft();
    appState.selected = null;
    renderTarget();
    toast("原本選取的 pane 或 agent session 已變更，請重新選擇", "error");
    return;
  }
  appState.selected = current;
  renderTarget();
}

function rowIsSelected(row) {
  return Boolean(
    appState.selected &&
    appState.selected.sessionName === row.sessionName &&
    appState.selected.pane.pane_id === row.pane.pane_id &&
    sameFingerprint(appState.selected.fingerprint, row.fingerprint),
  );
}

async function repairPaneSession(row, { manual = false } = {}) {
  const key = sessionRepairKey(row.sessionName, row.pane.pane_id);
  const current = appState.sessionRepairs.get(key);
  if (current?.status === "repairing") return false;
  if (!canRepairPane(row)) {
    if (manual) toast("這個 agent 尚未支援從 GUI 修復 session", "error");
    return false;
  }

  appState.sessionRepairs.set(key, { status: "repairing", reason: null });
  renderRoutes();
  try {
    const data = await requestJson(
      `/api/panes/${encodeURIComponent(row.pane.pane_id)}/repair-session`,
      {
        method: "POST",
        body: JSON.stringify({ sessionName: row.sessionName }),
      },
    );
    row.pane.agent_session = data.fingerprint;
    row.fingerprint = paneFingerprint(row.pane);
    appState.sessionRepairs.set(key, { status: "repaired", reason: null });
    renderRoutes();
    if (manual) toast("已驗證並補登原本的 agent session");
    return true;
  } catch (error) {
    appState.sessionRepairs.set(key, {
      status: "failed",
      reason: error.message,
    });
    renderRoutes();
    if (manual) toast(error.message, "error");
    return false;
  }
}

async function selectPaneRow(row) {
  if (!row.fingerprint) {
    const repaired = await repairPaneSession(row, { manual: true });
    if (!repaired) return;
  }
  saveComposerDraft();
  appState.selected = row;
  loadComposerDraft(row);
  renderRoutes();
  renderTarget();
  if (window.matchMedia("(max-width: 760px)").matches) {
    document.querySelector("#composer-title").scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }
}

function handleSpatialKey(event) {
  if (!/^Arrow(Left|Right|Up|Down)$/.test(event.key) && !["Home", "End"].includes(event.key)) {
    return;
  }
  const panes = [...event.currentTarget.parentElement.querySelectorAll(".space-pane")];
  if (!panes.length) return;
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    panes[event.key === "Home" ? 0 : panes.length - 1].focus();
    return;
  }

  const current = event.currentTarget;
  const cx = Number(current.dataset.centerX);
  const cy = Number(current.dataset.centerY);
  const candidates = panes
    .filter((pane) => pane !== current)
    .map((pane) => {
      const dx = Number(pane.dataset.centerX) - cx;
      const dy = Number(pane.dataset.centerY) - cy;
      const valid = {
        ArrowLeft: dx < -0.5,
        ArrowRight: dx > 0.5,
        ArrowUp: dy < -0.5,
        ArrowDown: dy > 0.5,
      }[event.key];
      const primary = event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? Math.abs(dx)
        : Math.abs(dy);
      const cross = event.key === "ArrowLeft" || event.key === "ArrowRight"
        ? Math.abs(dy)
        : Math.abs(dx);
      return { pane, valid, score: primary + cross * 2.4 };
    })
    .filter((item) => item.valid)
    .sort((left, right) => left.score - right.score);
  if (!candidates.length) return;
  event.preventDefault();
  candidates[0].pane.focus();
}

function paneHasHerdrFocus(sessionName, paneId) {
  return appState.herdrFocus.get(sessionName) === paneId;
}

function updateFocusMarkers() {
  for (const choice of document.querySelectorAll(".pane-choice[data-route-session][data-route-pane]")) {
    const focused = paneHasHerdrFocus(choice.dataset.routeSession, choice.dataset.routePane);
    choice.classList.toggle("is-herdr-focused", focused);
    if (focused) choice.setAttribute("aria-current", "true");
    else choice.removeAttribute("aria-current");
  }
}

async function loadFocusState() {
  if (document.visibilityState !== "visible") return;
  try {
    const data = await requestJson("/api/focus");
    appState.herdrFocus = new Map(
      (data.sessions || []).map((session) => [session.name, session.focusedPaneId]),
    );
    updateFocusMarkers();
  } catch {
    // Focus is a live enhancement; keep the pane browser usable if this read fails.
  }
}

function createPaneChoice(row, { spatial = false, filterMatch = true } = {}) {
  const { pane, fingerprint, sessionName, tab } = row;
  const herdrFocused = paneHasHerdrFocus(sessionName, pane.pane_id);
  const key = previewKey(sessionName, pane.pane_id);
  const preview = element("div", {
    className: "pane-preview",
    dataset: {
      previewKey: key,
      previewSession: sessionName,
      previewPane: pane.pane_id,
      previewCompact: String(spatial),
    },
    "aria-hidden": "true",
  });
  renderPreviewNode(preview, key, spatial);

  const selected = rowIsSelected(row);
  const repair = repairStateFor(row);
  const repairable = !fingerprint && canRepairPane(row);
  const repairing = repair?.status === "repairing";
  const classes = [
    "pane-choice",
    spatial ? "space-pane" : "pane-option",
    fingerprint ? "" : "is-unsupported",
    filterMatch ? "" : "is-filtered-out",
    herdrFocused ? "is-herdr-focused" : "",
    repairing ? "is-repairing" : "",
  ].filter(Boolean).join(" ");
  const children = [
    element("div", { className: "pane-title-row" }, [
      element("span", {
        className: "pane-title",
        text: paneDisplayName(pane, fingerprint),
      }),
      element("span", { className: "pane-badges" }, [
        agentLabel(pane.agent),
        statusLabel(pane.agent_status),
      ]),
    ]),
    preview,
    element("div", { className: "pane-meta pane-location" }, [
      element("span", { className: "pane-id", text: pane.pane_id }),
      element("span", {
        className: "pane-agent",
        text: spatial
          ? tab?.label || pane.tab_id || "tab"
          : tab?.label || pane.tab_id || "tab",
      }),
    ]),
  ];
  if (!spatial) {
    children.push(
      element("div", { className: "pane-meta pane-path-row" }, [
        element("span", {
          className: "pane-path",
          text: pane.cwd || "未知路徑",
          title: pane.cwd || "未知路徑",
        }),
      ]),
    );
  }
  if (!fingerprint) {
    const repairText = repairing
      ? "驗證 session…"
      : repair?.status === "failed"
        ? "無法自動修復 · 點擊重試"
        : repairable
          ? "修復 session"
          : "沒有可驗證的 session";
    children.push(
      element("span", {
        className: `session-repair-state ${repair?.status === "failed" ? "is-error" : ""}`.trim(),
        text: repairText,
        title: repair?.reason || repairText,
      }),
    );
  }

  return element(
    "button",
    {
      className: classes,
      type: "button",
      "aria-disabled": String(!fingerprint && (!repairable || repairing)),
      "aria-busy": String(repairing),
      "aria-pressed": String(selected),
      dataset: {
        focusKey: `pane:${sessionName}:${pane.pane_id}`,
        filterMatch: String(filterMatch),
        routeSession: sessionName,
        routePane: pane.pane_id,
      },
      ...(herdrFocused ? { "aria-current": "true" } : {}),
      "aria-label": fingerprint
        ? `選擇 ${paneDisplayName(pane, fingerprint)}，pane ${pane.pane_id}，${agentName(pane.agent)}，狀態 ${STATUS_TEXT[pane.agent_status] || pane.agent_status || "unknown"}${herdrFocused ? "，目前 Herdr focus" : ""}`
        : repairable
          ? `${pane.pane_id} 沒有可驗證的 agent session，點擊修復`
          : `${pane.pane_id} 沒有可驗證的 agent session`,
      on: {
        click: () => void selectPaneRow(row),
        ...(spatial ? { keydown: handleSpatialKey } : {}),
      },
    },
    children,
  );
}

async function autoRepairMissingSessions() {
  const rows = flattenTopology().filter((row) => {
    if (row.fingerprint || !canRepairPane(row)) return false;
    const attemptKey = [
      row.sessionName,
      row.pane.pane_id,
      row.pane.terminal_id || "terminal",
      row.pane.revision ?? "revision",
    ].join("\u001f");
    if (appState.autoRepairAttempts.has(attemptKey)) return false;
    appState.autoRepairAttempts.add(attemptKey);
    return true;
  });
  let index = 0;
  const workers = Array.from({ length: Math.min(2, rows.length) }, async () => {
    while (index < rows.length) {
      const row = rows[index];
      index += 1;
      await repairPaneSession(row);
    }
  });
  await Promise.all(workers);
}

function renderLayoutNode(node, key) {
  preserveFocus(node);
  node.replaceChildren();
  const entry = appState.paneLayouts.get(key);
  if (!entry || entry.status === "loading") {
    node.className = "pane-space is-loading";
    node.append(element("span", { className: "space-message", text: "讀取真實 pane 配置…" }));
    return;
  }

  const rows = flattenTopology().filter(
    (row) => row.sessionName === node.dataset.layoutSession && row.pane.tab_id === node.dataset.layoutTab,
  );
  const filter = ui.paneFilter.value.trim().toLocaleLowerCase();
  if (entry.status === "error") {
    node.className = "pane-space is-fallback";
    node.append(element("span", { className: "space-message", text: "配置圖無法讀取，已改用清單" }));
    for (const row of rows.filter((item) => paneMatchesFilters(item, filter))) {
      node.append(createPaneChoice(row));
    }
    return;
  }

  const area = entry.layout.area;
  const rowsByPane = new Map(rows.map((row) => [row.pane.pane_id, row]));
  const topologyIds = [...rowsByPane.keys()].sort();
  const layoutIds = entry.layout.panes.map((pane) => pane.paneId).sort();
  if (JSON.stringify(topologyIds) !== JSON.stringify(layoutIds)) {
    node.className = "pane-space is-fallback";
    node.append(element("span", { className: "space-message", text: "配置與 pane 清單不同步，已安全改用清單" }));
    for (const row of rows.filter((item) => paneMatchesFilters(item, filter))) {
      node.append(createPaneChoice(row));
    }
    return;
  }

  const tooDense = entry.layout.panes.length > 12 || entry.layout.panes.some((pane) =>
    pane.rect.width / area.width < 0.09 || pane.rect.height / area.height < 0.12
  );
  if (tooDense) {
    node.className = "pane-space is-fallback";
    node.append(element("span", { className: "space-message", text: "Pane 太密集，為避免選錯已改用清單" }));
    for (const row of rows.filter((item) => paneMatchesFilters(item, filter))) {
      node.append(createPaneChoice(row));
    }
    return;
  }

  node.className = "pane-space is-ready";
  node.style.setProperty("--layout-ratio", String(area.width / area.height));
  const ordered = [...entry.layout.panes].sort(
    (left, right) => left.rect.y - right.rect.y || left.rect.x - right.rect.x,
  );
  for (const paneLayout of ordered) {
    const row = rowsByPane.get(paneLayout.paneId);
    const left = Math.max(0, ((paneLayout.rect.x - area.x) / area.width) * 100);
    const top = Math.max(0, ((paneLayout.rect.y - area.y) / area.height) * 100);
    const width = Math.min(100 - left, (paneLayout.rect.width / area.width) * 100);
    const height = Math.min(100 - top, (paneLayout.rect.height / area.height) * 100);
    const choice = createPaneChoice(row, {
      spatial: true,
      filterMatch: paneMatchesFilters(row, filter),
    });
    choice.style.setProperty("--pane-x", String(left));
    choice.style.setProperty("--pane-y", String(top));
    choice.style.setProperty("--pane-width", String(width));
    choice.style.setProperty("--pane-height", String(height));
    choice.dataset.centerX = String(left + width / 2);
    choice.dataset.centerY = String(top + height / 2);
    node.append(choice);
  }
}

function updateLayoutNodes(key) {
  for (const node of document.querySelectorAll("[data-layout-key]")) {
    if (node.dataset.layoutKey === key) renderLayoutNode(node, key);
  }
  observeRoutePreviews();
}

async function loadPaneLayout(sessionName, tabId, paneId, { force = false } = {}) {
  const key = layoutKey(sessionName, tabId);
  const current = appState.paneLayouts.get(key);
  if (current?.promise) return current.promise;
  if (!force && current?.status === "ready" && Date.now() - current.loadedAt < LAYOUT_STALE_MS) {
    return current;
  }

  const promise = (async () => {
    try {
      const params = new URLSearchParams({ session: sessionName, pane: paneId });
      const data = await requestJson(`/api/pane-layout?${params}`);
      const changed = JSON.stringify(current?.layout) !== JSON.stringify(data.layout);
      const next = { status: "ready", layout: data.layout, loadedAt: Date.now() };
      appState.paneLayouts.set(key, next);
      if (changed || current?.status !== "ready") updateLayoutNodes(key);
      return next;
    } catch (error) {
      const next = { status: "error", error: error.message, loadedAt: Date.now() };
      appState.paneLayouts.set(key, next);
      updateLayoutNodes(key);
      return next;
    }
  })();
  appState.paneLayouts.set(key, { ...current, status: current?.layout ? current.status : "loading", promise });
  updateLayoutNodes(key);
  return promise;
}

function observeRouteLayouts() {
  layoutObserver?.disconnect();
  visibleLayoutKeys.clear();
  const nodes = [...ui.routeList.querySelectorAll(".pane-space[data-layout-key]")];
  if (!("IntersectionObserver" in window)) {
    for (const node of nodes.slice(0, 4)) {
      visibleLayoutKeys.add(node.dataset.layoutKey);
      void loadPaneLayout(node.dataset.layoutSession, node.dataset.layoutTab, node.dataset.layoutAnchor);
    }
    return;
  }
  layoutObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const node = entry.target;
        if (entry.isIntersecting) {
          visibleLayoutKeys.add(node.dataset.layoutKey);
          void loadPaneLayout(node.dataset.layoutSession, node.dataset.layoutTab, node.dataset.layoutAnchor);
        } else {
          visibleLayoutKeys.delete(node.dataset.layoutKey);
        }
      }
    },
    { root: ui.routeList, rootMargin: "220px 0px" },
  );
  for (const node of nodes) layoutObserver.observe(node);
}

function refreshVisibleLayouts() {
  if (document.visibilityState !== "visible") return;
  for (const node of ui.routeList.querySelectorAll(".pane-space[data-layout-key]")) {
    if (!visibleLayoutKeys.has(node.dataset.layoutKey)) continue;
    void loadPaneLayout(
      node.dataset.layoutSession,
      node.dataset.layoutTab,
      node.dataset.layoutAnchor,
      { force: true },
    );
  }
}

function workspaceKeys() {
  return (appState.topology?.sessions || []).flatMap((session) =>
    (session.workspaces || []).map(
      (workspace) => `${session.name}:${workspace.workspace_id}`,
    ),
  );
}

function updateWorkspaceToggle() {
  const keys = workspaceKeys();
  const allCollapsed = keys.length > 0 && keys.every((key) => appState.collapsedWorkspaces.has(key));
  ui.toggleAllWorkspaces.textContent = allCollapsed ? "全部展開" : "全部收合";
  ui.toggleAllWorkspaces.disabled = !keys.length;
  ui.toggleAllWorkspaces.setAttribute("aria-label", `${allCollapsed ? "展開" : "收合"}所有 workspace`);
}

function renderRoutes() {
  preserveFocus(ui.routeList);
  ui.routeList.replaceChildren();
  if (appState.loadingTopology && !appState.topology) {
    ui.routeList.append(routeSkeleton());
    return;
  }

  const filter = ui.paneFilter.value.trim().toLocaleLowerCase();
  const filterActive = Boolean(filter) || appState.agentFilter !== "all";
  const sessions = appState.topology?.sessions || [];
  updateWorkspaceToggle();
  if (!sessions.length) {
    ui.routeList.append(
      element("div", { className: "empty-state" }, [
        element("strong", { text: "沒有執行中的 Herdr session" }),
        element("p", { text: "啟動 Herdr 後再重新整理。" }),
      ]),
    );
    return;
  }

  let visiblePaneCount = 0;
  for (const session of sessions) {
    for (const workspace of session.workspaces || []) {
      const workspaceKey = `${session.name}:${workspace.workspace_id}`;
      const rows = (workspace.panes || []).map((pane) => ({
        session,
        sessionName: session.name,
        workspace,
        workspaceLabel: workspace.label || workspace.workspace_id,
        tab: (workspace.tabs || []).find((item) => item.tab_id === pane.tab_id),
        pane,
        fingerprint: paneFingerprint(pane),
      }));
      const matchingRows = rows.filter((row) => paneMatchesFilters(row, filter));
      if (filterActive && !matchingRows.length) continue;

      visiblePaneCount += matchingRows.length;
      const group = element("section", { className: "workspace-group" });
      const collapsed = appState.collapsedWorkspaces.has(workspaceKey) && !filterActive;
      const summary = element(
        "button",
        {
          className: "workspace-summary",
          type: "button",
          dataset: { focusKey: `workspace:${workspaceKey}` },
          "aria-expanded": String(!collapsed),
          on: {
            click: () => {
              if (appState.collapsedWorkspaces.has(workspaceKey)) appState.collapsedWorkspaces.delete(workspaceKey);
              else appState.collapsedWorkspaces.add(workspaceKey);
              renderRoutes();
            },
          },
        },
        [
          element("strong", { text: workspace.label || workspace.workspace_id }),
          element("span", {
            text: `${session.name} / ${(workspace.tabs || []).length || 1} tabs / ${rows.length} panes`,
          }),
        ],
      );
      group.append(summary);

      if (!collapsed) {
        if (appState.routeView === "list") {
          for (const row of matchingRows) group.append(createPaneChoice(row));
        } else {
          const tabs = (workspace.tabs || []).length
            ? workspace.tabs
            : [...new Set(rows.map((row) => row.pane.tab_id))].map((tabId) => ({ tab_id: tabId }));
          for (const tab of tabs) {
            const tabRows = rows.filter((row) => row.pane.tab_id === tab.tab_id);
            const tabMatches = tabRows.filter((row) => paneMatchesFilters(row, filter));
            if (filterActive && !tabMatches.length) continue;
            const tabSection = element("section", { className: "tab-space-group" });
            tabSection.append(
              element("div", { className: "tab-space-heading" }, [
                element("strong", { text: tab.label || tab.tab_id }),
                element("span", { text: `${tabRows.length} panes${tab.focused ? " · Herdr focus" : ""}` }),
              ]),
            );
            const key = layoutKey(session.name, tab.tab_id);
            const canvas = element("div", {
              className: "pane-space is-loading",
              role: "group",
              "aria-label": `${tab.label || tab.tab_id}，${tabRows.length} 個 pane，空間配置`,
              dataset: {
                layoutKey: key,
                layoutSession: session.name,
                layoutTab: tab.tab_id,
                layoutAnchor: tabRows[0]?.pane.pane_id,
              },
            });
            renderLayoutNode(canvas, key);
            tabSection.append(canvas);
            group.append(tabSection);
          }
        }
      }
      ui.routeList.append(group);
    }
  }

  if (!visiblePaneCount) {
    ui.routeList.append(
      element("div", { className: "empty-state" }, [
        element("strong", { text: "找不到符合條件的 pane" }),
        element("p", { text: "清除搜尋文字或改選其他 agent。" }),
      ]),
    );
  }
  observeRoutePreviews();
  observeRouteLayouts();
}

function renderTarget() {
  const selected = appState.selected;
  const hasSelection = Boolean(selected);
  ui.composerPanel.classList.toggle("is-empty", !hasSelection);
  ui.composerHeading.hidden = !hasSelection;
  ui.scheduleForm.hidden = !hasSelection;
  ui.composerActionbar.hidden = !hasSelection;
  ui.targetEmpty.hidden = Boolean(selected);
  ui.targetSummary.hidden = !selected;
  ui.scheduleFields.disabled = !selected;
  ui.scheduleSubmit.disabled = !selected;
  ui.sendImmediately.disabled = !selected;
  updateDeliveryModeUI();
  renderQuotaQuickTimes();
  if (!selected) {
    appState.editingAlias = false;
    ui.targetAliasForm.hidden = true;
    ui.openConversationSearch.disabled = true;
    return;
  }

  const pane = selected.pane;
  const alias = aliasForFingerprint(selected.fingerprint);
  ui.targetTitle.textContent = paneDisplayName(pane, selected.fingerprint);
  const aliasAction = alias ? "編輯名稱" : "重新命名";
  ui.editTargetAlias.setAttribute("aria-label", aliasAction);
  ui.editTargetAlias.title = aliasAction;
  ui.editTargetAlias.hidden = appState.editingAlias;
  ui.targetAliasForm.hidden = !appState.editingAlias;
  if (appState.editingAlias && document.activeElement !== ui.targetAliasInput) {
    ui.targetAliasInput.value = alias?.label || paneDisplayName(pane, selected.fingerprint);
  }
  ui.targetStatus.textContent = STATUS_TEXT[pane.agent_status] || pane.agent_status || "unknown";
  ui.targetStatus.dataset.status = pane.agent_status || "unknown";
  ui.targetAgentPill.textContent = agentName(pane.agent);
  ui.targetAgentPill.dataset.agent = pane.agent || "shell";
  ui.targetSession.textContent = selected.sessionName;
  ui.targetPane.textContent = pane.pane_id;
  ui.targetAgent.textContent = pane.agent || "unknown";
  ui.targetFingerprint.textContent = shortFingerprint(selected.fingerprint);
  const searchable = SEARCHABLE_TRANSCRIPT_SOURCES.has(selected.fingerprint?.source);
  ui.openConversationSearch.disabled = !searchable;
  ui.openConversationSearch.title = searchable
    ? "搜尋這段 conversation 的完整可見訊息"
    : "這個 agent transcript 尚未支援搜尋";
  const key = previewKey(selected.sessionName, pane.pane_id);
  ui.targetPreview.dataset.previewKey = key;
  ui.targetPreview.dataset.previewCompact = "true";
  renderPreviewNode(ui.targetPreview, key, true);
  void loadPanePreview(selected.sessionName, pane.pane_id);
}

function resetConversationSearch() {
  appState.conversationSearch.cancelAll();
  Object.assign(appState.conversationSearch, {
    loading: false,
    hits: [],
    nextCursor: null,
    revision: null,
    activeAnchor: null,
    context: [],
    contextLoading: false,
    error: null,
    query: "",
    mode: "selected",
    activeHitKey: null,
  });
}

function conversationHitKey(hit) {
  const fingerprint = hit.fingerprint || appState.selected?.fingerprint;
  return `${fingerprint?.source || ""}:${fingerprint?.value || ""}:${hit.anchor}`;
}

function renderConversationContext() {
  const state = appState.conversationSearch;
  ui.conversationContext.replaceChildren();
  if (state.contextLoading) {
    ui.conversationContextMeta.textContent = "正在讀取前後文";
    ui.conversationContext.append(element("div", {
      className: "conversation-placeholder is-loading",
      text: "讀取前後文…",
    }));
    return;
  }
  if (!state.activeAnchor || !state.context.length) {
    ui.conversationContextMeta.textContent = "選擇一筆命中";
    ui.conversationContext.append(element("div", { className: "conversation-placeholder" }, [
      element("strong", { text: "先從左側選擇搜尋結果" }),
      element("p", { text: "這裡會顯示該訊息前後的完整可見對話。" }),
    ]));
    return;
  }
  const active = state.context.find((message) => message.anchor === state.activeAnchor);
  ui.conversationContextMeta.textContent = active
    ? `已載入訊息 ${active.ordinal + 1} 的前後文`
    : "前後文";
  for (const message of state.context) {
    const body = element("div", { className: "conversation-message-body" });
    renderMarkdown(body, message.text, { highlight: state.query });
    ui.conversationContext.append(element("article", {
      className: `conversation-message ${message.anchor === state.activeAnchor ? "is-active" : ""}`.trim(),
      dataset: { role: message.role },
    }, [
      element("header", {}, [
        element("strong", { text: message.role === "user" ? "User" : "Assistant" }),
        element("span", { text: message.timestamp ? formatDate(message.timestamp, true) : `#${message.ordinal + 1}` }),
      ]),
      body,
    ]));
  }
  requestAnimationFrame(() => {
    ui.conversationContext.querySelector(".conversation-message.is-active")?.scrollIntoView({
      block: "center",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  });
}

function renderConversationSearch() {
  const state = appState.conversationSearch;
  const isGlobal = state.mode === "global";
  ui.conversationResults.replaceChildren();
  ui.conversationSearchSubmit.disabled = state.loading;
  ui.conversationLoadMore.disabled = state.loading;
  ui.conversationResults.setAttribute("aria-busy", String(state.loading));
  ui.conversationSearchStatus.textContent = state.loading
    ? state.hits.length ? "載入更多命中…" : isGlobal ? "搜尋全部歷史 transcript…" : "搜尋這段 conversation…"
    : state.error || (state.revision
      ? state.hits.length ? `已載入 ${state.hits.length} 筆命中` : "找不到符合的可見訊息"
      : "輸入文字開始搜尋");
  ui.conversationSearchStatus.classList.toggle("is-error", Boolean(state.error));
  ui.conversationResultCount.textContent = state.revision
    ? `${state.hits.length}${state.nextCursor ? "+" : ""} 筆`
    : "尚未搜尋";

  if (!state.hits.length) {
    ui.conversationResults.append(element("div", { className: "conversation-placeholder" }, [
      element("strong", { text: state.loading ? "正在建立搜尋結果" : state.error ? "搜尋未完成" : state.revision ? "沒有命中" : "等待搜尋" }),
      element("p", {
        text: state.error || (state.revision
          ? "試試另一個詞，或調整訊息角色。"
          : isGlobal
            ? "首次搜尋會建立或更新本機歷史索引，之後的搜尋會更快。"
            : "搜尋只包含 User 與 Assistant 看得到的文字。"),
      }),
    ]));
  } else {
    for (const hit of state.hits) {
      const active = conversationHitKey(hit) === state.activeHitKey;
      const snippet = element("span", { className: "conversation-hit-snippet" });
      renderMarkdown(snippet, hit.snippet, { highlight: state.query, inlineOnly: true });
      ui.conversationResults.append(element("button", {
        className: `conversation-hit ${active ? "is-active" : ""}`.trim(),
        type: "button",
        dataset: { anchor: hit.anchor, role: hit.role },
        "aria-pressed": String(active),
        on: { click: () => void loadConversationContext(hit) },
      }, [
        element("span", { className: "conversation-hit-meta" }, [
          element("strong", { text: hit.role === "user" ? "User" : "Assistant" }),
          element("span", {
            text: isGlobal
              ? `${hit.timestamp ? formatDate(hit.timestamp, true) : `#${hit.ordinal + 1}`} · ${agentName(hit.agent)} · ${hit.locations?.[0] || "歷史 transcript"}`
              : hit.timestamp ? formatDate(hit.timestamp, true) : `#${hit.ordinal + 1}`,
          }),
        ]),
        snippet,
      ]));
    }
  }
  ui.conversationLoadMore.hidden = !state.nextCursor;
  renderConversationContext();
}

function selectedConversationRequest(extra = {}) {
  const selected = appState.selected;
  if (!selected?.fingerprint) throw new Error("請重新選擇可驗證的 pane");
  return {
    sessionName: selected.sessionName,
    paneId: selected.pane.pane_id,
    expectedFingerprint: selected.fingerprint,
    ...extra,
  };
}

async function runConversationSearch({ append = false } = {}) {
  const query = ui.conversationQuery.value.trim();
  const roles = [
    ui.conversationRoleUser.checked ? "user" : null,
    ui.conversationRoleAssistant.checked ? "assistant" : null,
  ].filter(Boolean);
  if (!query || !roles.length) {
    toast(!query ? "請輸入搜尋文字" : "至少選擇一種訊息角色", "error");
    return;
  }
  const state = appState.conversationSearch;
  const requestId = state.beginSearch({ replace: !append });
  state.error = null;
  if (!append) {
    state.query = query;
    state.hits = [];
    state.nextCursor = null;
    state.revision = null;
    state.activeAnchor = null;
    state.activeHitKey = null;
    state.context = [];
  }
  renderConversationSearch();
  try {
    const payload = await requestJson(state.mode === "global"
      ? "/api/conversation/global-search"
      : "/api/conversation/search", {
      method: "POST",
      body: JSON.stringify(state.mode === "global"
        ? {
          query,
          roles,
          agent: "all",
          limit: 30,
          cursor: append ? state.nextCursor : null,
        }
        : selectedConversationRequest({
          query,
          roles,
          limit: 30,
          cursor: append ? state.nextCursor : null,
        })),
    });
    if (requestId !== state.searchRequestId) return;
    state.hits = append ? [...state.hits, ...payload.hits] : payload.hits;
    state.nextCursor = payload.nextCursor;
    state.revision = payload.revision;
  } catch (error) {
    if (requestId !== state.searchRequestId) return;
    state.error = error.message;
  } finally {
    if (state.finishSearch(requestId)) {
      renderConversationSearch();
    }
  }
}

async function loadConversationContext(hit) {
  const state = appState.conversationSearch;
  const requestId = state.beginContext();
  state.activeAnchor = hit.anchor;
  state.activeHitKey = conversationHitKey(hit);
  state.error = null;
  renderConversationSearch();
  try {
    const payload = await requestJson(state.mode === "global"
      ? "/api/conversation/global-context"
      : "/api/conversation/context", {
      method: "POST",
      body: JSON.stringify(state.mode === "global"
        ? {
          fingerprint: hit.fingerprint,
          anchor: hit.anchor,
          revision: hit.conversationRevision,
          before: 4,
          after: 4,
        }
        : selectedConversationRequest({
          anchor: hit.anchor,
          revision: state.revision,
          before: 4,
          after: 4,
        })),
    });
    if (requestId !== state.contextRequestId) return;
    state.context = payload.messages;
  } catch (error) {
    if (requestId !== state.contextRequestId) return;
    state.error = error.message;
    state.context = [];
  } finally {
    if (state.finishContext(requestId)) {
      renderConversationSearch();
    }
  }
}

function showConversationSearch({ mode, title, agent, subtitle }) {
  resetConversationSearch();
  appState.conversationSearch.mode = mode;
  ui.conversationQuery.value = "";
  ui.conversationRoleUser.checked = true;
  ui.conversationRoleAssistant.checked = true;
  ui.conversationDialogTitle.textContent = title;
  ui.conversationAgent.textContent = agent;
  ui.conversationAgent.dataset.agent = mode === "global" ? "all" : agent.toLowerCase();
  ui.conversationDialogSubtitle.textContent = subtitle;
  renderConversationSearch();
  ui.conversationDialog.showModal();
  queueMicrotask(() => ui.conversationQuery.focus());
}

function openConversationSearch() {
  const selected = appState.selected;
  if (!selected || !SEARCHABLE_TRANSCRIPT_SOURCES.has(selected.fingerprint?.source)) return;
  showConversationSearch({
    mode: "selected",
    title: "搜尋 conversation",
    agent: agentName(selected.pane.agent),
    subtitle: `${paneDisplayName(selected.pane, selected.fingerprint)} · ${selected.pane.pane_id} · ${shortFingerprint(selected.fingerprint)}`,
  });
}

function openGlobalConversationSearch() {
  showConversationSearch({
    mode: "global",
    title: "全域搜尋 conversation",
    agent: "全部 Agent",
    subtitle: "搜尋本機已發現的 Claude、Codex 與 AGY 歷史 transcript",
  });
}

function formatQuotaPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number >= 99.95 ? 100 : number.toFixed(number < 10 ? 1 : 0)}%`;
}

function quotaResetLabel(value) {
  const reset = new Date(value);
  const milliseconds = reset.getTime() - Date.now();
  if (Number.isNaN(reset.getTime())) return "重置時間未知";
  if (milliseconds <= 0) return "正在重置";
  const minutes = Math.ceil(milliseconds / 60_000);
  const relative = minutes < 60
    ? `${minutes} 分鐘後`
    : minutes < 24 * 60
      ? `${Math.floor(minutes / 60)} 小時${minutes % 60 ? ` ${minutes % 60} 分` : ""}後`
      : `${Math.floor(minutes / 1_440)} 天後`;
  const absolute = new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(reset);
  return `${relative} · ${absolute}`;
}

function quotaWindowRow(label, quotaWindow) {
  if (!quotaWindow) {
    return element("div", { className: "quota-window is-missing" }, [
      element("span", { text: label }),
      element("span", { text: "尚無資料" }),
    ]);
  }
  const remaining = Math.max(0, Math.min(100, Number(quotaWindow.remainingPercent) || 0));
  const stateClass = remaining <= 0 ? "is-exhausted" : remaining <= 10 ? "is-low" : "";
  const valueText = `${formatQuotaPercent(remaining)} 可用`;
  return element("div", { className: `quota-window ${stateClass}`.trim() }, [
    element("span", { className: "quota-window-name", text: label }),
    element("strong", { text: valueText }),
    element("span", {
      className: "quota-reset",
      text: quotaResetLabel(quotaWindow.resetsAt),
      dataset: { quotaResetAt: quotaWindow.resetsAt },
    }),
    element("progress", {
      className: "quota-track",
      "aria-label": `${label}可用額度`,
      "aria-valuetext": valueText,
      value: remaining,
      max: 100,
    }),
  ]);
}

function quotaStatusCopy(provider) {
  return {
    "setup-required": provider?.reason || "需要啟用資料 relay",
    waiting: provider?.reason || "等待第一筆資料",
    unavailable: provider?.reason || "目前無法讀取",
  }[provider?.status] || provider?.reason || "目前無法讀取";
}

function providerObservedLabel(provider) {
  if (!provider?.observedAt) return provider?.source || "";
  const observedTime = new Date(provider.observedAt).getTime();
  if (!Number.isFinite(observedTime)) return provider?.source || "";
  const ageMinutes = Math.max(0, Math.floor((Date.now() - observedTime) / 60_000));
  const age = ageMinutes < 1 ? "剛剛更新" : `${ageMinutes} 分前${ageMinutes >= 10 ? "（資料較舊）" : ""}`;
  return `${provider.source || "額度資料"} · ${age}`;
}

function standardQuotaCard(agent, title, provider) {
  const card = element("section", {
    className: `quota-provider quota-${agent} ${provider?.status === "ready" ? "" : "is-unavailable"}`.trim(),
    dataset: { quotaProvider: agent },
  });
  card.append(element("div", { className: "quota-provider-heading" }, [
    agentLabel(agent),
    element("span", { className: "quota-provider-name", text: title }),
    element("span", { className: "quota-source", text: providerObservedLabel(provider) }),
  ]));
  if (provider?.status !== "ready") {
    card.append(element("p", { className: "quota-unavailable", text: quotaStatusCopy(provider) }));
    return card;
  }
  card.append(
    quotaWindowRow("5h", provider.windows?.fiveHour),
    quotaWindowRow("每週", provider.windows?.weekly),
  );
  return card;
}

function agyQuotaCard(provider) {
  const card = element("section", {
    className: `quota-provider quota-agy ${provider?.status === "ready" ? "" : "is-unavailable"}`.trim(),
    dataset: { quotaProvider: "agy" },
  });
  card.append(element("div", { className: "quota-provider-heading" }, [
    agentLabel("agy"),
    element("span", { className: "quota-provider-name", text: "AGY" }),
    element("span", { className: "quota-source", text: providerObservedLabel(provider) }),
  ]));
  if (provider?.status !== "ready") {
    card.append(element("p", { className: "quota-unavailable", text: quotaStatusCopy(provider) }));
    return card;
  }
  for (const group of provider.groups || []) {
    card.append(element("div", { className: "quota-group" }, [
      element("span", { className: "quota-group-name", text: group.label }),
      quotaWindowRow("5h", group.windows?.fiveHour),
      quotaWindowRow("每週", group.windows?.weekly),
    ]));
  }
  return card;
}

function renderQuota() {
  ui.quotaGrid.replaceChildren();
  ui.quotaGrid.setAttribute("aria-busy", "false");
  if (appState.quota?.error) {
    ui.quotaGrid.append(element("div", { className: "quota-loading is-error", text: appState.quota.error }));
    renderQuotaQuickTimes();
    if (ui.jobDialog.open) renderJobDialog({ preserveEdits: true });
    return;
  }
  const providers = appState.quota?.providers || {};
  ui.quotaGrid.append(
    standardQuotaCard("codex", "Codex", providers.codex),
    standardQuotaCard("claude", "Claude", providers.claude),
    agyQuotaCard(providers.agy),
  );
  renderQuotaQuickTimes();
  if (ui.jobDialog.open) renderJobDialog({ preserveEdits: true });
}

async function loadQuota({ force = false, announce = false } = {}) {
  ui.refreshQuota.disabled = true;
  if (force) ui.refreshQuota.textContent = "更新中";
  try {
    appState.quota = await requestJson(`/api/quota${force ? "?refresh=1" : ""}`);
    renderQuota();
    if (announce) toast("額度與重置時間已更新");
  } catch (error) {
    appState.quota = { error: `額度讀取失敗：${error.message}` };
    renderQuota();
  } finally {
    ui.refreshQuota.disabled = false;
    ui.refreshQuota.textContent = "更新額度";
  }
}

function quotaTargetsForAgent(agent) {
  const providers = appState.quota?.providers || {};
  if (agent === "codex") {
    return [{ key: "codex", label: "Codex 額度重置後", reset: providers.codex?.windows?.fiveHour?.resetsAt }];
  }
  if (agent === "claude") {
    return [{ key: "claude", label: "Claude 額度重置後", reset: providers.claude?.windows?.fiveHour?.resetsAt }];
  }
  if (agent === "agy") {
    return (providers.agy?.groups || []).map((group) => ({
      key: `agy-${group.id}`,
      label: `AGY ${group.label} 重置後`,
      reset: group.windows?.fiveHour?.resetsAt,
    }));
  }
  return [];
}

function selectedQuotaTargets() {
  return quotaTargetsForAgent(appState.selected?.pane?.agent);
}

function setDateAfterReset(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    toast("這個額度重置時間已過，請更新額度", "error");
    return;
  }
  date.setMinutes(date.getMinutes() + 2, 0, 0);
  ui.scheduledFor.value = toDateTimeLocal(date);
  ui.scheduledFor.min = toDateTimeLocal(new Date());
  saveComposerDraft();
  toast(`已設定為額度重置後 2 分鐘：${formatDate(date.toISOString())}`);
}

function renderQuotaQuickTimes() {
  ui.quotaQuickTimes.replaceChildren();
  for (const target of selectedQuotaTargets()) {
    ui.quotaQuickTimes.append(element("button", {
      type: "button",
      text: target.label,
      dataset: { quotaAgent: target.key },
      ...(target.reset ? {} : { disabled: "" }),
      title: target.reset ? `${quotaResetLabel(target.reset)}，另加 2 分鐘緩衝` : "尚未取得重置時間",
      on: { click: () => setDateAfterReset(target.reset) },
    }));
  }
}

function setJobDateOffset(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  date.setSeconds(0, 0);
  ui.jobDialogScheduledFor.value = toDateTimeLocal(date);
  ui.jobDialogScheduledFor.min = toDateTimeLocal(new Date());
  appState.jobDialogDirty = true;
}

function setJobDateAfterReset(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    toast("這個額度重置時間已過，請先更新額度", "error");
    return;
  }
  date.setMinutes(date.getMinutes() + 2, 0, 0);
  ui.jobDialogScheduledFor.value = toDateTimeLocal(date);
  ui.jobDialogScheduledFor.min = toDateTimeLocal(new Date());
  appState.jobDialogDirty = true;
  toast(`已改為額度重置後 2 分鐘：${formatDate(date.toISOString())}`);
}

function renderJobQuickTimes(job, editable) {
  ui.jobDialogQuickTime.replaceChildren(element("span", { text: "快速設定" }));
  const quotaButtons = element("span", { className: "quota-quick-times" });
  const agent = job.targetSnapshot?.agent || job.expectedFingerprint?.agent;
  for (const target of quotaTargetsForAgent(agent)) {
    quotaButtons.append(element("button", {
      type: "button",
      text: target.label,
      disabled: editable && target.reset ? null : "",
      dataset: { jobQuotaAgent: target.key },
      title: target.reset ? `${quotaResetLabel(target.reset)}，另加 2 分鐘緩衝` : "尚未取得重置時間",
      on: { click: () => setJobDateAfterReset(target.reset) },
    }));
  }
  ui.jobDialogQuickTime.append(quotaButtons);
  for (const [minutes, label] of [[30, "30 分"], [60, "1 小時"], [120, "2 小時"], [180, "3 小時"], [240, "4 小時"], [305, "5 小時 5 分"]]) {
    ui.jobDialogQuickTime.append(element("button", {
      type: "button",
      text: label,
      disabled: editable ? null : "",
      dataset: { jobOffsetMinutes: minutes },
      on: { click: () => setJobDateOffset(minutes) },
    }));
  }
}

async function saveTargetAlias(label) {
  if (!appState.selected) return;
  const selected = appState.selected;
  try {
    await requestJson("/api/aliases", {
      method: "POST",
      body: JSON.stringify({
        sessionName: selected.sessionName,
        paneId: selected.pane.pane_id,
        expectedFingerprint: selected.fingerprint,
        label,
      }),
    });
    appState.editingAlias = false;
    await loadState();
    renderTarget();
    renderRoutes();
    toast(label.trim() ? "對話名稱已儲存" : "已恢復 agent 提供的名稱");
  } catch (error) {
    toast(error.message, "error");
    await loadTopology();
  }
}

function jobStatusSummary(jobs) {
  const counts = jobs.reduce((result, job) => {
    result[job.status] = (result[job.status] || 0) + 1;
    return result;
  }, {});
  const active = jobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length;
  const sent = counts.sent || 0;
  const failed = counts.failed || 0;
  const detached = counts.detached || 0;
  return `${active} 待執行${detached ? `（${detached} 待重新綁定）` : ""} / ${sent} 已送達 / ${failed} 失敗`;
}

function jobDisplayName(job) {
  return aliasForFingerprint(job.expectedFingerprint)?.label ||
    job.targetSnapshot?.terminalTitle ||
    job.label ||
    job.paneId ||
    "Terminal pane";
}

function jobActionButton(label, action, job, danger = false) {
  return element("button", {
    className: `job-action ${danger ? "is-danger" : ""}`.trim(),
    type: "button",
    text: label,
    dataset: { focusKey: `job:${job.id}:${action}` },
    on: { click: () => void runJobAction(job, action) },
  });
}

function triggerCountdown(value, status) {
  if (status === "paused") return "已暫停，不會觸發";
  if (status === "dispatching") return "正在觸發";
  if (!value) return "沒有下一次觸發時間";
  const milliseconds = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "即將觸發";
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 60) return `${minutes} 分鐘後觸發`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes ? `${hours} 小時 ${remainingMinutes} 分鐘後觸發` : `${hours} 小時後觸發`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days} 天 ${remainingHours} 小時後觸發` : `${days} 天後觸發`;
}

function updateTriggerCountdowns() {
  for (const node of document.querySelectorAll("[data-trigger-at]")) {
    const job = appState.jobs.find((item) => item.id === node.dataset.jobId);
    node.textContent = job ? jobStateExplanation(job) : triggerCountdown(node.dataset.triggerAt, node.dataset.jobStatus);
  }
}

async function saveJobEdits(job, textarea, scheduledForInput) {
  const enterOnly = job.deliveryMode === "enter";
  const message = enterOnly ? "" : textarea.value.trim();
  if (!enterOnly && !message) {
    toast("訊息內容不能空白", "error");
    textarea.focus();
    return;
  }
  const scheduledFor = new Date(scheduledForInput.value);
  const originalTime = new Date(job.scheduledFor);
  const timeChanged = Math.floor(scheduledFor.getTime() / 60_000) !==
    Math.floor(originalTime.getTime() / 60_000);
  if (
    Number.isNaN(scheduledFor.getTime()) ||
    (timeChanged && scheduledFor.getTime() < Date.now() - 5_000)
  ) {
    toast("請設定未來的有效傳送時間", "error");
    scheduledForInput.focus();
    return;
  }
  try {
    const attachments = enterOnly ? [] : await uploadPendingJobDialogAttachments();
    await requestJson(`/api/jobs/${encodeURIComponent(job.id)}/action`, {
      method: "POST",
      body: JSON.stringify({
        action: "edit-job",
        message,
        scheduledFor: timeChanged ? scheduledFor.toISOString() : job.scheduledFor,
        attachments,
      }),
    });
    appState.jobDialogDirty = false;
    ui.jobDialog.close();
    await loadState();
    toast(enterOnly ? "Enter 排程時間已更新" : "訊息與傳送時間已更新");
  } catch (error) {
    toast(error.message, "error");
  }
}

function recurrenceLabel(job) {
  if (job.deliveryMode === "enter") return "只按一次 Enter";
  return {
    once: "只傳一次",
    daily: "每天重複",
    weekly: "每週重複",
  }[job.recurrence] || "自訂重複";
}

function deliveryRuleLabel(job) {
  if (job.deliveryMode === "enter") return "指定時間只送出一次 Enter，不等待 Agent 狀態";
  return job.dispatchMode === "settled"
    ? "到時間後，等 Agent 就緒再傳送"
    : "到時間立即嘗試傳送";
}

function graceLabel(job) {
  if (job.deliveryMode === "enter") return "不等待、不重複";
  if (job.dispatchMode !== "settled") return "不等待";
  const minutes = Number(job.graceMinutes) || 0;
  if (minutes >= 60 && minutes % 60 === 0) return `${minutes / 60} 小時`;
  return `${minutes} 分鐘`;
}

function jobStateExplanation(job) {
  return {
    scheduled: triggerCountdown(job.nextRunAt, job.status),
    deferred: "Agent 尚未就緒，系統正在等待並重試",
    detached: "找不到原本的對話 pane；在左側選好 pane 後開啟這裡重新綁定",
    dispatching: job.deliveryMode === "enter" ? "正在核對對話並送出 Enter" : "正在核對對話並傳送",
    paused: "已暫停，不會自動傳送",
    sent: job.deliveryMode === "enter" ? "Enter 已送達原本的 pane" : "訊息已送達原本的對話",
    failed: job.deliveryMode === "enter" ? "Enter 傳送失敗；開啟查看原因" : "傳送失敗；開啟查看原因",
    canceled: "這個排程已取消",
  }[job.status] || job.lastOutcome || "狀態更新中";
}

function jobActionDescription(job) {
  return job.deliveryMode === "enter"
    ? "到時間對原本的 pane 按一次 Enter"
    : job.message;
}

function summaryItem(label, value) {
  return element("div", {}, [
    element("span", { text: label }),
    element("strong", { text: value }),
  ]);
}

function renderJobDialog({ preserveEdits = false } = {}) {
  const job = appState.jobs.find((item) => item.id === appState.activeJobId);
  if (!job) {
    if (ui.jobDialog.open) ui.jobDialog.close();
    return;
  }
  const editable = EDITABLE_STATUSES.has(job.status);
  const enterOnly = job.deliveryMode === "enter";
  const timeValue = job.nextRunAt || job.lastRunAt || job.scheduledFor;
  ui.jobDialogTitle.textContent = jobDisplayName(job);
  ui.jobDialogStatus.textContent = STATUS_TEXT[job.status] || job.status;
  ui.jobDialogStatus.dataset.status = job.status;
  ui.jobDialogTiming.textContent = `${jobStateExplanation(job)} · ${formatDate(timeValue)}`;
  if (!preserveEdits || !appState.jobDialogDirty) {
    ui.jobDialogMessage.value = enterOnly ? "" : job.message;
    ui.jobDialogScheduledFor.value = toDateTimeLocal(new Date(job.scheduledFor));
  }
  ui.jobDialogMessageField.hidden = enterOnly;
  ui.jobDialogMessage.readOnly = enterOnly || !editable;
  ui.jobDialogMessage.dataset.editable = String(editable);
  ui.jobDialogScheduledFor.disabled = !editable;
  ui.jobDialogScheduledFor.min = toDateTimeLocal(new Date());
  renderJobQuickTimes(job, editable);
  ui.jobDialogSummary.replaceChildren(
    summaryItem("執行方式", recurrenceLabel(job)),
    summaryItem("動作", enterOnly ? "只按一次 Enter" : "傳送接續訊息"),
    summaryItem("傳送條件", deliveryRuleLabel(job)),
    summaryItem("最長等待", graceLabel(job)),
  );
  renderJobDialogAttachments(job, editable);
  ui.jobDialogTechnical.replaceChildren(
    element("dt", { text: "Herdr session" }),
    element("dd", { text: job.sessionName }),
    element("dt", { text: "Pane" }),
    element("dd", { text: job.paneId }),
    element("dt", { text: "對話指紋" }),
    element("dd", { text: job.expectedFingerprint?.value || "無法驗證" }),
  );
  ui.jobDialogActions.replaceChildren();
  ui.jobDialogActions.hidden = !editable;
  if (editable) {
    ui.jobDialogActions.append(element("button", {
      className: "button button-primary",
      type: "button",
      text: "儲存變更",
      dataset: { jobAction: "save-job" },
      on: { click: () => void saveJobEdits(job, ui.jobDialogMessage, ui.jobDialogScheduledFor) },
    }));
    if (job.status === "detached") {
      const selected = appState.selected;
      ui.jobDialogActions.append(element("button", {
        className: "job-action",
        type: "button",
        text: selected
          ? `綁定到 ${paneDisplayName(selected.pane, selected.fingerprint)}`
          : "先在左側選擇 pane 才能綁定",
        disabled: selected ? null : "",
        dataset: { focusKey: `job:${job.id}:rebind` },
        on: { click: () => void rebindJob(job) },
      }));
      ui.jobDialogActions.append(jobActionButton("取消排程", "cancel", job, true));
      return;
    }
    if (job.status === "paused") {
      ui.jobDialogActions.append(jobActionButton("恢復排程", "resume", job));
    } else {
      ui.jobDialogActions.append(jobActionButton("暫停排程", "pause", job));
    }
    ui.jobDialogActions.append(jobActionButton(enterOnly ? "立即按 Enter" : "立刻傳送", "send-now", job));
    ui.jobDialogActions.append(jobActionButton("取消排程", "cancel", job, true));
  }
}

function openJobDialog(job) {
  appState.activeJobId = job.id;
  appState.jobDialogDirty = false;
  appState.jobDialogAttachmentItems = jobDialogAttachmentItemsFor(job);
  renderJobDialog();
  if (!ui.jobDialog.open) ui.jobDialog.showModal();
  const editable = EDITABLE_STATUSES.has(job.status);
  queueMicrotask(() => {
    if (!editable) ui.closeJobDialog.focus();
    else if (job.deliveryMode === "enter") ui.jobDialogScheduledFor.focus();
    else ui.jobDialogMessage.focus();
  });
}

function renderJobs() {
  const libraryMode = appState.jobFilter === "library";
  ui.jobList.hidden = libraryMode;
  ui.libraryPanel.hidden = !libraryMode;
  if (libraryMode) {
    renderLibrary();
    return;
  }
  preserveFocus(ui.jobList);
  ui.jobList.replaceChildren();
  ui.queueSummary.textContent = jobStatusSummary(appState.jobs);
  const visible = appState.jobs.filter((job) =>
    appState.jobFilter === "active"
      ? ACTIVE_STATUSES.has(job.status)
      : !ACTIVE_STATUSES.has(job.status),
  );

  if (!visible.length) {
    ui.jobList.append(
      element("div", { className: "empty-state" }, [
        element("strong", {
          text: appState.jobFilter === "active" ? "目前沒有待執行排程" : "目前沒有歷史紀錄",
        }),
        element("p", {
          text: appState.jobFilter === "active"
            ? "選擇 pane 並建立第一個接續排程。"
            : "送達、取消與失敗的排程會出現在這裡。",
        }),
      ]),
    );
    return;
  }

  for (const job of visible) {
    const timeValue = job.nextRunAt || job.lastRunAt || job.scheduledFor;
    const open = () => openJobDialog(job);
    ui.jobList.append(
      element("article", {
        className: "job-item",
        role: "button",
        "data-status": job.status,
        tabindex: "0",
        "aria-label": `開啟 ${jobDisplayName(job)} 排程`,
        on: {
          click: open,
          keydown: (event) => {
            if (!["Enter", " "].includes(event.key)) return;
            event.preventDefault();
            open();
          },
        },
      }, [
        element("div", { className: "job-topline" }, [
          element("h3", { className: "job-title", text: jobDisplayName(job) }),
          statusLabel(job.status),
        ]),
        element("div", { className: "job-trigger" }, [
          element("span", {
            className: "job-countdown",
            text: jobStateExplanation(job),
            dataset: { triggerAt: job.nextRunAt || "", jobStatus: job.status, jobId: job.id },
          }),
          element("time", { className: "job-time", datetime: timeValue, text: formatDate(timeValue) }),
        ]),
        element("p", { className: "job-message", text: jobActionDescription(job) }),
        ...(job.attachments?.length
          ? [element("span", { className: "job-attachment-count", text: `附 ${job.attachments.length} 張圖片` })]
          : []),
        element("p", { className: "job-friendly-rule", text: `${recurrenceLabel(job)}；${deliveryRuleLabel(job)}` }),
        element("span", { className: "job-open-hint", text: "開啟查看與編輯" }),
      ]),
    );
  }
}

async function loadTopology({ announce = false } = {}) {
  if (appState.loadingTopology) return;
  appState.loadingTopology = true;
  ui.refreshTopology.disabled = true;
  if (!appState.topology) renderRoutes();
  try {
    const topology = await requestJson("/api/topology");
    const changed =
      appState.topology === null ||
      JSON.stringify(topology.sessions || []) !==
      JSON.stringify(appState.topology?.sessions || []);
    appState.topology = topology;
    if (
      !appState.mobileTopologyPrepared &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      for (const session of appState.topology.sessions || []) {
        for (const workspace of session.workspaces || []) {
          appState.collapsedWorkspaces.add(`${session.name}:${workspace.workspace_id}`);
        }
      }
      appState.mobileTopologyPrepared = true;
    }
    if (changed || announce) {
      if (announce) {
        appState.panePreviews.clear();
        appState.paneLayouts.clear();
      }
      reconcileSelection();
      renderRoutes();
    }
    void autoRepairMissingSessions();
    setServiceState("online", "Herdr 已連線");
    if (announce) toast("Pane 清單已重新整理");
  } catch (error) {
    setServiceState("error", "Herdr 連線失敗");
    if (!appState.topology) {
      ui.routeList.replaceChildren(
        element("div", { className: "empty-state" }, [
          element("strong", { text: "無法讀取 Herdr" }),
          element("p", { text: error.message }),
        ]),
      );
    }
    if (announce) toast(error.message, "error");
  } finally {
    appState.loadingTopology = false;
    ui.refreshTopology.disabled = false;
  }
}

async function loadState() {
  try {
    const data = await requestJson("/api/state");
    const jobs = data.jobs || [];
    const aliases = data.aliases || [];
    const messages = data.messages || [];
    if (JSON.stringify(messages) !== JSON.stringify(appState.messages)) {
      appState.messages = messages;
      if (appState.jobFilter === "library") renderLibrary();
    }
    if (JSON.stringify(jobs) !== JSON.stringify(appState.jobs)) {
      appState.jobs = jobs;
      renderJobs();
      if (ui.jobDialog.open) renderJobDialog({ preserveEdits: true });
    }
    if (JSON.stringify(aliases) !== JSON.stringify(appState.aliases)) {
      appState.aliases = aliases;
      renderJobs();
      renderRoutes();
      renderTarget();
      if (ui.jobDialog.open) renderJobDialog({ preserveEdits: true });
    }
  } catch (error) {
    setServiceState("error", "服務資料讀取失敗");
  }
}

function requestConfirmation({ title, copy, acceptLabel = "確認" }) {
  ui.confirmTitle.textContent = title;
  ui.confirmCopy.textContent = copy;
  ui.confirmAccept.textContent = acceptLabel;
  ui.confirmDialog.returnValue = "";
  return new Promise((resolve) => {
    ui.confirmDialog.addEventListener("close", () => {
      resolve(ui.confirmDialog.returnValue === "confirm");
    }, { once: true });
    ui.confirmDialog.showModal();
  });
}

async function rebindJob(job) {
  const selected = appState.selected;
  if (!selected?.fingerprint) {
    toast("先在左側選擇要接手的 pane", "error");
    return;
  }
  const targetName = paneDisplayName(selected.pane, selected.fingerprint);
  const confirmed = await requestConfirmation({
    title: `把排程綁定到「${targetName}」？`,
    copy: "之後會傳送到這個 pane 目前的 agent session。重複排程會從下一個未到的時間繼續；原定時間已過的單次排程會先暫停，由你決定何時傳送。",
    acceptLabel: "確認綁定",
  });
  if (!confirmed) return;
  try {
    await requestJson(`/api/jobs/${encodeURIComponent(job.id)}/action`, {
      method: "POST",
      body: JSON.stringify({
        action: "rebind",
        sessionName: selected.sessionName,
        paneId: selected.pane.pane_id,
        expectedFingerprint: selected.fingerprint,
      }),
    });
    await loadState();
    if (ui.jobDialog.open) renderJobDialog();
    toast(`已綁定到 ${targetName}`);
  } catch (error) {
    toast(error.message, "error");
    await loadTopology();
  }
}

function libraryItemTitle(item) {
  return item.title || item.message.split("\n")[0].slice(0, 60) || "未命名訊息";
}

function resetLibraryForm() {
  appState.libraryEditingId = null;
  ui.libraryName.value = "";
  ui.libraryMessage.value = "";
  ui.librarySave.textContent = "存入常駐訊息";
  ui.libraryCancelEdit.hidden = true;
}

function editLibraryMessage(item) {
  appState.libraryEditingId = item.id;
  ui.libraryName.value = item.title || "";
  ui.libraryMessage.value = item.message;
  ui.librarySave.textContent = "更新這則訊息";
  ui.libraryCancelEdit.hidden = false;
  renderLibrary();
  ui.libraryMessage.focus();
}

function applyLibraryMessage(item) {
  if (!appState.selected) {
    toast("先在左側選擇 pane，再套用常駐訊息", "error");
    return;
  }
  if (currentDeliveryMode() === "enter") {
    const promptOption = [...ui.scheduleForm.elements.deliveryMode].find((option) => option.value === "prompt");
    if (promptOption) promptOption.checked = true;
    updateDeliveryModeUI();
  }
  ui.message.value = item.message;
  updateMessageCount();
  saveComposerDraft();
  ui.message.focus();
  toast(`已套用「${libraryItemTitle(item)}」，設定時間後建立排程`);
}

async function deleteLibraryMessage(item) {
  const confirmed = await requestConfirmation({
    title: `刪除「${libraryItemTitle(item)}」？`,
    copy: "只會刪除常駐訊息，已建立的排程不受影響。",
    acceptLabel: "確認刪除",
  });
  if (!confirmed) return;
  try {
    await requestJson(`/api/messages/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (appState.libraryEditingId === item.id) resetLibraryForm();
    await loadState();
    toast("常駐訊息已刪除");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function saveLibraryMessage(title, message, editingId = null) {
  const body = JSON.stringify({ title, message });
  const saved = editingId
    ? await requestJson(`/api/messages/${encodeURIComponent(editingId)}`, { method: "PUT", body })
    : await requestJson("/api/messages", { method: "POST", body });
  await loadState();
  return saved;
}

function renderLibrary() {
  preserveFocus(ui.libraryList);
  ui.libraryList.replaceChildren();
  if (!appState.messages.length) {
    ui.libraryList.append(element("div", { className: "empty-state" }, [
      element("strong", { text: "還沒有常駐訊息" }),
      element("p", { text: "在上方輸入，或在排程訊息下方按「把這則訊息存成常駐訊息」。" }),
    ]));
    return;
  }
  for (const item of appState.messages) {
    ui.libraryList.append(element("article", {
      className: "library-item",
      "data-editing": String(item.id === appState.libraryEditingId),
    }, [
      element("h4", { className: "library-item-title", text: libraryItemTitle(item) }),
      element("p", { className: "library-item-message", text: item.message }),
      element("div", { className: "library-actions" }, [
        element("button", {
          className: "job-action",
          type: "button",
          text: "套用到排程",
          dataset: { focusKey: `library:${item.id}:apply` },
          on: { click: () => applyLibraryMessage(item) },
        }),
        element("button", {
          className: "job-action",
          type: "button",
          text: "編輯",
          dataset: { focusKey: `library:${item.id}:edit` },
          on: { click: () => editLibraryMessage(item) },
        }),
        element("button", {
          className: "job-action is-danger",
          type: "button",
          text: "刪除",
          dataset: { focusKey: `library:${item.id}:delete` },
          on: { click: () => void deleteLibraryMessage(item) },
        }),
      ]),
    ]));
  }
}

async function runJobAction(job, action) {
  const confirmation = {
    cancel: {
      title: "取消這個排程？",
      copy: "取消後不會再自動傳送，但歷史紀錄仍會保留。",
      acceptLabel: "確認取消",
    },
    "send-now": {
      title: job.deliveryMode === "enter" ? "立即對這個 pane 按一次 Enter？" : "立刻傳送這則訊息？",
      copy: job.deliveryMode === "enter"
        ? "系統只會送出一次 Enter，不會輸入、讀取或拼接任何文字，並會先核對原本的 agent session。"
        : "系統會先核對目前 pane 與原本的 agent session；若選擇等待就緒，Agent 忙碌時仍會延後。",
      acceptLabel: job.deliveryMode === "enter" ? "確認按 Enter" : "確認傳送",
    },
  }[action];
  if (confirmation && !await requestConfirmation(confirmation)) return;

  try {
    await requestJson(`/api/jobs/${encodeURIComponent(job.id)}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    await loadState();
    if (ui.jobDialog.open) renderJobDialog();
    toast({
      cancel: "排程已取消",
      pause: "排程已暫停",
      resume: "排程已恢復",
      "send-now": job.deliveryMode === "enter" ? "已排入立即按 Enter" : "已排入立即傳送",
    }[action] || "操作完成");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function submitSchedule(event, { immediate = false } = {}) {
  event?.preventDefault();
  if (!appState.selected) return;

  const form = new FormData(ui.scheduleForm);
  const deliveryMode = String(form.get("deliveryMode") || "prompt");
  const enterOnly = deliveryMode === "enter";
  const localTime = immediate ? new Date() : new Date(form.get("scheduledFor"));
  if (Number.isNaN(localTime.getTime())) {
    toast("請設定有效的傳送時間", "error");
    return;
  }

  const selected = appState.selected;
  const payload = {
    sessionName: selected.sessionName,
    paneId: selected.pane.pane_id,
    expectedFingerprint: selected.fingerprint,
    label: paneDisplayName(selected.pane, selected.fingerprint),
    deliveryMode,
    message: enterOnly ? "" : form.get("message"),
    scheduledFor: localTime.toISOString(),
    recurrence: enterOnly || immediate ? "once" : form.get("recurrence"),
    dispatchMode: enterOnly ? "exact" : form.get("dispatchMode"),
    graceMinutes: enterOnly ? 1 : Number(form.get("graceMinutes")),
  };

  ui.scheduleSubmit.disabled = true;
  ui.sendImmediately.disabled = true;
  const activeButton = immediate ? ui.sendImmediately : ui.scheduleSubmit;
  activeButton.textContent = immediate
    ? (enterOnly ? "準備按 Enter" : "準備傳送")
    : "建立中";
  try {
    if (!enterOnly && appState.attachments.length) activeButton.textContent = "保存圖片中";
    payload.attachments = enterOnly ? [] : await uploadPendingAttachments();
    activeButton.textContent = immediate
      ? (enterOnly ? "排入 Enter" : "排入傳送")
      : "建立中";
    const created = await requestJson("/api/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (immediate) {
      await requestJson(`/api/jobs/${encodeURIComponent(created.job.id)}/action`, {
        method: "POST",
        body: JSON.stringify({ action: "send-now" }),
      });
    }
    await loadState();
    toast(immediate
      ? (enterOnly ? "已排入立即按 Enter" : "已排入立即傳送")
      : `已安排 ${formatDate(payload.scheduledFor)} ${enterOnly ? "按一次 Enter" : "傳送"}`);
    clearComposer();
  } catch (error) {
    toast(error.message, "error");
    await loadTopology();
  } finally {
    ui.scheduleSubmit.disabled = !appState.selected;
    ui.scheduleSubmit.textContent = "建立排程";
    ui.sendImmediately.disabled = !appState.selected;
    ui.sendImmediately.textContent = currentDeliveryMode() === "enter" ? "立即按 Enter" : "立刻傳送";
  }
}

async function confirmImmediateSend() {
  if (!appState.selected || !ui.scheduleForm.reportValidity()) return;
  const target = paneDisplayName(appState.selected.pane, appState.selected.fingerprint);
  const form = new FormData(ui.scheduleForm);
  const enterOnly = form.get("deliveryMode") === "enter";
  if (enterOnly) {
    const accepted = await requestConfirmation({
      title: `立即對「${target}」按一次 Enter？`,
      copy: "這個動作只會送出一次 Enter，不會輸入、讀取或拼接任何文字，並會先核對原本的 agent session。",
      acceptLabel: "確認按 Enter",
    });
    if (accepted) await submitSchedule(null, { immediate: true });
    return;
  }
  const dispatchMode = form.get("dispatchMode");
  const condition = dispatchMode === "settled"
    ? "如果 Agent 正在工作，系統會等它就緒後再送。"
    : "即使 Agent 正在工作，也會立即嘗試送出。";
  const accepted = await requestConfirmation({
    title: `立刻傳送到「${target}」？`,
    copy: `這則訊息會只傳一次。${condition}送出前仍會核對原本的 agent session。`,
    acceptLabel: "確認立刻傳送",
  });
  if (accepted) await submitSchedule(null, { immediate: true });
}

function setDateOffset(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  date.setSeconds(0, 0);
  ui.scheduledFor.value = toDateTimeLocal(date);
  ui.scheduledFor.min = toDateTimeLocal(new Date());
}

function updateMessageCount() {
  ui.messageCount.textContent = String(ui.message.value.length);
}

function addAttachmentFiles(files, { clipboard = false } = {}) {
  const allowed = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
  const extensions = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  let added = 0;
  for (const sourceFile of files) {
    if (appState.attachments.length >= 5) {
      toast("每個排程最多附加 5 張圖片", "error");
      break;
    }
    if (!allowed.has(sourceFile.type)) {
      toast(`${sourceFile.name || "剪貼簿內容"} 不是支援的圖片格式`, "error");
      continue;
    }
    if (sourceFile.size > 8 * 1024 * 1024) {
      toast(`${sourceFile.name || "剪貼簿圖片"} 超過 8 MB`, "error");
      continue;
    }
    const file = clipboard
      ? new File(
          [sourceFile],
          `clipboard-${new Date().toISOString().replace(/[:.]/g, "-")}-${added + 1}.${extensions[sourceFile.type]}`,
          { type: sourceFile.type },
        )
      : sourceFile;
    appState.attachments.push({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
      uploaded: null,
    });
    added += 1;
  }
  renderAttachments();
  saveComposerDraft();
  return added;
}

function initializeTheme() {
  const requested = new URLSearchParams(window.location.search).get("theme");
  if (["system", "light", "dark"].includes(requested)) {
    document.documentElement.dataset.theme = requested;
    updateThemeLabel(requested);
    return;
  }
  const stored = localStorage.getItem("pane-relay-theme");
  const theme = ["system", "light", "dark"].includes(stored) ? stored : "system";
  document.documentElement.dataset.theme = theme;
  updateThemeLabel(theme);
}

function updateThemeLabel(theme) {
  ui.themeToggle.textContent = `主題：${{ system: "系統", light: "淺色", dark: "深色" }[theme]}`;
}

function cycleTheme() {
  const current = document.documentElement.dataset.theme || "system";
  const next = { system: "light", light: "dark", dark: "system" }[current];
  document.documentElement.dataset.theme = next;
  localStorage.setItem("pane-relay-theme", next);
  updateThemeLabel(next);
}

function placePaneSearchPopover() {
  if (ui.paneSearchPopover.hidden) return;
  const margin = 12;
  const gap = 8;
  const trigger = ui.togglePaneSearch.getBoundingClientRect();
  const popover = ui.paneSearchPopover.getBoundingClientRect();
  const left = Math.max(
    margin,
    Math.min(window.innerWidth - popover.width - margin, trigger.right - popover.width),
  );
  const below = trigger.bottom + gap;
  const above = trigger.top - popover.height - gap;
  const top = below + popover.height <= window.innerHeight - margin
    ? below
    : Math.max(margin, above);
  ui.paneSearchPopover.style.left = `${left}px`;
  ui.paneSearchPopover.style.top = `${top}px`;
}

function setPaneSearchOpen(open) {
  ui.paneSearchPopover.hidden = !open;
  ui.togglePaneSearch.setAttribute("aria-expanded", String(open));
  if (open) {
    queueMicrotask(() => {
      placePaneSearchPopover();
      ui.paneFilter.focus();
    });
  }
}

function quotaPosition() {
  try {
    return JSON.parse(localStorage.getItem("pane-relay-quota-position") || "null");
  } catch {
    return null;
  }
}

function placeQuotaFloat(x, y, { save = false } = {}) {
  const width = ui.quotaOrb.offsetWidth || 56;
  const height = ui.quotaOrb.offsetHeight || 56;
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, Number(x) || 8));
  const top = Math.max(8, Math.min(window.innerHeight - height - 8, Number(y) || 8));
  ui.quotaFloat.style.left = `${left}px`;
  ui.quotaFloat.style.top = `${top}px`;
  ui.quotaFloat.classList.toggle("align-right", left > window.innerWidth / 2);
  ui.quotaFloat.classList.toggle("open-up", top > window.innerHeight / 2);
  if (save) localStorage.setItem("pane-relay-quota-position", JSON.stringify({ x: left, y: top }));
}

function setQuotaOpen(open) {
  ui.quotaPanel.hidden = !open;
  ui.quotaBackdrop.hidden = !open;
  ui.quotaOrb.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("quota-is-open", open);
  localStorage.setItem("pane-relay-quota-open", String(open));
}

function initializeQuotaFloat() {
  const stored = quotaPosition();
  placeQuotaFloat(stored?.x ?? window.innerWidth - 76, stored?.y ?? window.innerHeight - 76);
  setQuotaOpen(localStorage.getItem("pane-relay-quota-open") === "true");
  let drag = null;
  let suppressClick = false;
  ui.quotaOrb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const rect = ui.quotaFloat.getBoundingClientRect();
    drag = {
      pointerId: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    ui.quotaOrb.setPointerCapture(event.pointerId);
  });
  ui.quotaOrb.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    placeQuotaFloat(event.clientX - drag.dx, event.clientY - drag.dy);
  });
  ui.quotaOrb.addEventListener("pointerup", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressClick = drag.moved;
    const rect = ui.quotaFloat.getBoundingClientRect();
    placeQuotaFloat(rect.left, rect.top, { save: true });
    drag = null;
  });
  ui.quotaOrb.addEventListener("click", () => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    setQuotaOpen(ui.quotaPanel.hidden);
  });
  window.addEventListener("resize", () => {
    const rect = ui.quotaFloat.getBoundingClientRect();
    placeQuotaFloat(rect.left, rect.top);
    placePaneSearchPopover();
  });
}

ui.scheduleForm.addEventListener("submit", submitSchedule);
ui.sendImmediately.addEventListener("click", () => void confirmImmediateSend());
ui.scheduleForm.querySelectorAll("input[name='deliveryMode']").forEach((input) => {
  input.addEventListener("change", () => {
    updateDeliveryModeUI();
    saveComposerDraft();
  });
});
ui.message.addEventListener("input", () => {
  updateMessageCount();
  saveComposerDraft();
});
ui.scheduleForm.addEventListener("input", (event) => {
  if (event.target !== ui.message) saveComposerDraft();
});
ui.scheduleForm.addEventListener("change", saveComposerDraft);
ui.message.addEventListener("keydown", (event) => event.stopPropagation());
ui.message.addEventListener("paste", (event) => {
  const files = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!files.length) return;

  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  if (text) {
    ui.message.setRangeText(text, ui.message.selectionStart, ui.message.selectionEnd, "end");
    updateMessageCount();
    saveComposerDraft();
  }
  const added = addAttachmentFiles(files, { clipboard: true });
  if (added) toast(`已從剪貼簿加入 ${added} 張圖片`);
});
ui.attachmentInput.addEventListener("change", () => {
  addAttachmentFiles(ui.attachmentInput.files || []);
  ui.attachmentInput.value = "";
});
ui.paneFilter.addEventListener("input", () => {
  ui.togglePaneSearch.classList.toggle("has-query", Boolean(ui.paneFilter.value.trim()));
  renderRoutes();
});
ui.paneFilter.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  setPaneSearchOpen(false);
  ui.togglePaneSearch.focus();
});
ui.togglePaneSearch.addEventListener("click", () => {
  setPaneSearchOpen(ui.paneSearchPopover.hidden);
});
ui.agentFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-agent-filter]");
  if (!button) return;
  appState.agentFilter = button.dataset.agentFilter;
  ui.agentFilters.querySelectorAll("[data-agent-filter]").forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
  renderRoutes();
});
ui.toggleAllWorkspaces.addEventListener("click", () => {
  const keys = workspaceKeys();
  const allCollapsed = keys.length > 0 && keys.every((key) => appState.collapsedWorkspaces.has(key));
  if (allCollapsed) {
    for (const key of keys) appState.collapsedWorkspaces.delete(key);
  } else {
    for (const key of keys) appState.collapsedWorkspaces.add(key);
  }
  renderRoutes();
});
ui.editTargetAlias.addEventListener("click", () => {
  appState.editingAlias = true;
  renderTarget();
  ui.targetAliasInput.focus();
  ui.targetAliasInput.select();
});
ui.cancelTargetAlias.addEventListener("click", () => {
  appState.editingAlias = false;
  renderTarget();
  ui.editTargetAlias.focus();
});
ui.clearTargetAlias.addEventListener("click", () => void saveTargetAlias(""));
ui.targetAliasForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveTargetAlias(ui.targetAliasInput.value);
});
ui.targetAliasInput.addEventListener("keydown", (event) => event.stopPropagation());
ui.refreshTopology.addEventListener("click", () => void loadTopology({ announce: true }));
ui.refreshQuota.addEventListener("click", () => void loadQuota({ force: true, announce: true }));
ui.openResourceMonitor.addEventListener("click", () => {
  if (!ui.resourceDialog.open) ui.resourceDialog.showModal();
  void loadResources({ force: true });
});
ui.closeResourceMonitor.addEventListener("click", () => ui.resourceDialog.close());
ui.refreshResources.addEventListener("click", () => void loadResources({ force: true, announce: true }));
ui.resourceDialog.addEventListener("click", (event) => {
  if (event.target === ui.resourceDialog) ui.resourceDialog.close();
});
ui.closeQuota.addEventListener("click", () => {
  setQuotaOpen(false);
  ui.quotaOrb.focus();
});
ui.quotaBackdrop.addEventListener("click", () => {
  setQuotaOpen(false);
  ui.quotaOrb.focus();
});
ui.themeToggle.addEventListener("click", cycleTheme);
ui.closeJobDialog.addEventListener("click", () => ui.jobDialog.close());
ui.openConversationSearch.addEventListener("click", openConversationSearch);
ui.openGlobalConversationSearch.addEventListener("click", openGlobalConversationSearch);
ui.closeConversationSearch.addEventListener("click", () => ui.conversationDialog.close());
ui.conversationDialog.addEventListener("click", (event) => {
  if (event.target === ui.conversationDialog) ui.conversationDialog.close();
});
ui.conversationSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runConversationSearch();
});
ui.conversationLoadMore.addEventListener("click", () => void runConversationSearch({ append: true }));
ui.conversationQuery.addEventListener("keydown", (event) => event.stopPropagation());
ui.jobDialog.addEventListener("click", (event) => {
  if (event.target === ui.jobDialog) ui.jobDialog.close();
});
ui.jobDialog.addEventListener("close", () => {
  appState.activeJobId = null;
  appState.jobDialogDirty = false;
  for (const attachment of appState.jobDialogAttachmentItems) {
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }
  appState.jobDialogAttachmentItems = [];
  ui.jobDialogAttachmentList.replaceChildren();
  ui.jobDialogAttachments.hidden = true;
});
ui.jobDialogMessage.addEventListener("keydown", (event) => event.stopPropagation());
ui.jobDialogMessage.addEventListener("paste", (event) => {
  const files = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (!files.length) return;
  event.preventDefault();
  const text = event.clipboardData?.getData("text/plain") || "";
  if (text) {
    ui.jobDialogMessage.setRangeText(
      text,
      ui.jobDialogMessage.selectionStart,
      ui.jobDialogMessage.selectionEnd,
      "end",
    );
  }
  const added = addJobDialogAttachmentFiles(files);
  if (added) toast(`已從剪貼簿加入 ${added} 張圖片`);
});
ui.jobDialogMessage.addEventListener("input", () => {
  appState.jobDialogDirty = true;
});
ui.jobDialogScheduledFor.addEventListener("input", () => {
  appState.jobDialogDirty = true;
});
ui.jobDialogAttachmentInput.addEventListener("change", () => {
  const added = addJobDialogAttachmentFiles(ui.jobDialogAttachmentInput.files || []);
  ui.jobDialogAttachmentInput.value = "";
  if (added) toast(`已加入 ${added} 張待傳圖片`);
});
document.addEventListener("pointerdown", (event) => {
  if (ui.paneSearchPopover.hidden) return;
  if (event.target.closest(".pane-search-control")) return;
  setPaneSearchOpen(false);
});
window.addEventListener("scroll", placePaneSearchPopover, true);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || ui.quotaPanel.hidden) return;
  setQuotaOpen(false);
  ui.quotaOrb.focus();
});
document.querySelectorAll("[data-offset-minutes]").forEach((button) => {
  button.addEventListener("click", () => {
    setDateOffset(Number(button.dataset.offsetMinutes));
    saveComposerDraft();
  });
});

document.querySelectorAll("[data-job-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    appState.jobFilter = button.dataset.jobFilter;
    document.querySelectorAll("[data-job-filter]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderJobs();
  });
});

ui.libraryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = ui.libraryMessage.value.trim();
  if (!message) {
    toast("訊息內容不能空白", "error");
    ui.libraryMessage.focus();
    return;
  }
  const editing = appState.libraryEditingId;
  ui.librarySave.disabled = true;
  try {
    await saveLibraryMessage(ui.libraryName.value.trim(), message, editing);
    resetLibraryForm();
    renderLibrary();
    toast(editing ? "常駐訊息已更新" : "已存入常駐訊息");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    ui.librarySave.disabled = false;
  }
});
ui.libraryCancelEdit.addEventListener("click", () => {
  resetLibraryForm();
  renderLibrary();
});
for (const field of [ui.libraryName, ui.libraryMessage]) {
  field.addEventListener("keydown", (event) => event.stopPropagation());
}
ui.saveToLibrary.addEventListener("click", async () => {
  const message = ui.message.value.trim();
  if (!message) {
    toast("訊息內容是空的，沒有東西可以存", "error");
    return;
  }
  try {
    await saveLibraryMessage("", message);
    toast("已存入常駐訊息；在右側「常駐訊息」分頁管理");
  } catch (error) {
    toast(error.message, "error");
  }
});

document.querySelectorAll("[data-route-view]").forEach((button) => {
  button.setAttribute("aria-pressed", String(button.dataset.routeView === appState.routeView));
  button.addEventListener("click", () => {
    appState.routeView = button.dataset.routeView;
    localStorage.setItem("pane-relay-route-view", appState.routeView);
    document.querySelectorAll("[data-route-view]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    renderRoutes();
  });
});

ui.timezoneLabel.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";
initializeTheme();
initializeQuotaFloat();
renderResources();
updateDeliveryModeUI();
setDateOffset(305);
updateMessageCount();
renderTarget();
renderJobs();
void Promise.all([loadTopology(), loadState(), loadFocusState(), loadQuota(), loadResources()]);

setInterval(() => void loadState(), 4_000);
setInterval(() => void loadTopology(), 20_000);
setInterval(refreshVisiblePreviews, 60_000);
setInterval(refreshVisibleLayouts, 20_000);
setInterval(updateTriggerCountdowns, 15_000);
setInterval(() => void loadFocusState(), 1_000);
setInterval(() => void loadQuota(), 60_000);
setInterval(() => void loadResources(), 15_000);
setInterval(() => {
  for (const node of document.querySelectorAll("[data-quota-reset-at]")) {
    node.textContent = quotaResetLabel(node.dataset.quotaResetAt);
  }
}, 30_000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void loadFocusState();
});

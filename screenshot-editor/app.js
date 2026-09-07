const canvas = document.querySelector("#editor-canvas");
const ctx = canvas.getContext("2d");
const stage = document.querySelector("#canvas-stage");
const image = new Image();
const params = new URLSearchParams(window.location.search);
const sourceFile = params.get("file");

const state = {
  tool: "pen",
  color: "#bd5f18",
  lineWidth: 6,
  drawing: false,
  start: null,
  current: null,
  sourceWidth: 0,
  sourceHeight: 0,
  displayScale: 1,
  history: [],
  historyMarks: [],
  historyIndex: -1,
  marks: 0,
  cropPreview: null,
  cleanSnapshot: null,
};

const el = (selector) => document.querySelector(selector);
const sourceStatus = el("#source-status");
const filePath = el("#file-path");
const emptyState = el("#empty-state");
const stageReadout = el("#stage-readout");
const toast = el("#toast");
let saveQueue = Promise.resolve();

function showToast(message, error = false) {
  toast.textContent = message;
  toast.classList.toggle("is-error", error);
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3600);
}

function setCanvasSize(width, height) {
  canvas.width = width;
  canvas.height = height;
  state.sourceWidth = width;
  state.sourceHeight = height;
  fitCanvas();
}

function fitCanvas() {
  if (!state.sourceWidth) return;
  const availableWidth = Math.max(260, stage.clientWidth - 72);
  const availableHeight = Math.max(220, Math.min(window.innerHeight * .61, 650));
  state.displayScale = Math.min(1, availableWidth / state.sourceWidth, availableHeight / state.sourceHeight);
  canvas.style.width = `${Math.round(state.sourceWidth * state.displayScale)}px`;
  canvas.style.height = `${Math.round(state.sourceHeight * state.displayScale)}px`;
  stageReadout.textContent = `${state.sourceWidth} × ${state.sourceHeight} px`;
}

function drawSource() {
  if (state.cleanSnapshot && state.cleanSnapshot.width === canvas.width && state.cleanSnapshot.height === canvas.height) {
    ctx.putImageData(state.cleanSnapshot.data, 0, 0);
    return;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}

function snapshot() {
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), width: canvas.width, height: canvas.height };
}

function restore(snapshotData) {
  if (!snapshotData) return;
  if (canvas.width !== snapshotData.width || canvas.height !== snapshotData.height) {
    setCanvasSize(snapshotData.width, snapshotData.height);
  }
  ctx.putImageData(snapshotData.data, 0, 0);
}

function updateHistoryButtons() {
  el("#undo").disabled = state.historyIndex <= 0;
  el("#redo").disabled = state.historyIndex >= state.history.length - 1;
  el("#clear").disabled = state.marks === 0;
  el("#save-image").disabled = state.history.length <= 1 || !state.sourceWidth;
  el("#tool-count").textContent = `${state.marks} ${state.marks === 1 ? "mark" : "marks"}`;
}

function pushHistory() {
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.historyMarks = state.historyMarks.slice(0, state.historyIndex + 1);
  state.history.push(snapshot());
  state.historyMarks.push(state.marks);
  state.historyIndex = state.history.length - 1;
  updateHistoryButtons();
}

function undo() {
  if (state.historyIndex <= 0) return;
  state.historyIndex -= 1;
  restore(state.history[state.historyIndex]);
  state.marks = state.historyMarks[state.historyIndex];
  updateHistoryButtons();
  queueSave();
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex += 1;
  restore(state.history[state.historyIndex]);
  state.marks = state.historyMarks[state.historyIndex];
  updateHistoryButtons();
  queueSave();
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) / state.displayScale)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) / state.displayScale)),
  };
}

function styleContext() {
  ctx.strokeStyle = state.color;
  ctx.lineWidth = state.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function drawShape(from, to) {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const width = Math.abs(to.x - from.x);
  const height = Math.abs(to.y - from.y);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  restore(state.history[state.historyIndex]);
  styleContext();
  if (state.tool === "rect") {
    ctx.strokeRect(x, y, width, height);
  } else {
    ctx.beginPath();
    ctx.ellipse(x + width / 2, y + height / 2, Math.max(width / 2, 1), Math.max(height / 2, 1), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawCropPreview(from, to) {
  restore(state.history[state.historyIndex]);
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const width = Math.abs(to.x - from.x);
  const height = Math.abs(to.y - from.y);
  state.cropPreview = { x, y, width, height };
  ctx.save();
  ctx.fillStyle = "rgb(24 33 31 / .44)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(x, y, width, height);
  ctx.strokeStyle = "#fdfdfa";
  ctx.lineWidth = Math.max(2, state.lineWidth / state.displayScale);
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function finishDraw() {
  state.drawing = false;
  canvas.releasePointerCapture?.(state.pointerId);
  if (state.tool === "crop") {
    if (state.cropPreview?.width > 8 && state.cropPreview?.height > 8) {
      el("#crop-note").hidden = false;
      el("#confirm-crop").hidden = false;
    } else {
      state.cropPreview = null;
      restore(state.history[state.historyIndex]);
    }
    return;
  }
  if (state.tool === "rect" || state.tool === "ellipse") drawShape(state.start, state.current);
  state.marks += 1;
  pushHistory();
  updateHistoryButtons();
  queueSave();
}

canvas.addEventListener("pointerdown", (event) => {
  if (!state.sourceWidth) return;
  state.drawing = true;
  state.pointerId = event.pointerId;
  state.start = pointFromEvent(event);
  state.current = state.start;
  canvas.setPointerCapture?.(event.pointerId);
  styleContext();
  if (state.tool === "pen") {
    ctx.beginPath();
    ctx.moveTo(state.start.x, state.start.y);
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (!state.drawing) return;
  state.current = pointFromEvent(event);
  if (state.tool === "pen") {
    ctx.lineTo(state.current.x, state.current.y);
    ctx.stroke();
  } else if (state.tool === "crop") {
    drawCropPreview(state.start, state.current);
  } else {
    drawShape(state.start, state.current);
  }
});

canvas.addEventListener("pointerup", finishDraw);
canvas.addEventListener("pointercancel", finishDraw);

document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    state.tool = button.dataset.tool;
    state.cropPreview = null;
    document.querySelectorAll("[data-tool]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    el("#crop-note").hidden = true;
    el("#confirm-crop").hidden = true;
    restore(state.history[state.historyIndex]);
  });
});

el("#color-input").addEventListener("input", (event) => { state.color = event.target.value; });
el("#line-width").addEventListener("input", (event) => {
  state.lineWidth = Number(event.target.value);
  el("#line-width-value").textContent = `${state.lineWidth} px`;
});
el("#undo").addEventListener("click", undo);
el("#redo").addEventListener("click", redo);
el("#clear").addEventListener("click", () => {
  if (state.marks === 0) return;
  drawSource();
  state.marks = 0;
  pushHistory();
  showToast("已清除所有標記");
  queueSave();
});
el("#confirm-crop").addEventListener("click", () => {
  const crop = state.cropPreview;
  if (!crop) return;
  const cropX = Math.round(crop.x);
  const cropY = Math.round(crop.y);
  const cropWidth = Math.max(1, Math.round(crop.width));
  const cropHeight = Math.max(1, Math.round(crop.height));
  const cropData = ctx.getImageData(cropX, cropY, cropWidth, cropHeight);
  setCanvasSize(cropData.width, cropData.height);
  ctx.putImageData(cropData, 0, 0);
  state.cleanSnapshot = { data: cropData, width: cropData.width, height: cropData.height };
  state.cropPreview = null;
  state.marks += 1;
  el("#crop-note").hidden = true;
  el("#confirm-crop").hidden = true;
  pushHistory();
  showToast("裁切已套用");
  queueSave();
});

async function saveSnapshot(dataUrl, manual = false) {
  const button = el("#save-image");
  button.disabled = true;
  if (manual) button.querySelector("span").textContent = "正在複製…";
  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file: sourceFile, dataUrl }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "儲存失敗");
    el("#save-note").textContent = result.outputPath;
    sourceStatus.textContent = `已自動複製 · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    if (manual) showToast(result.message);
  } catch (error) {
    showToast(error.message || "儲存失敗", true);
  } finally {
    if (manual) button.querySelector("span").textContent = "再次儲存並複製";
    updateHistoryButtons();
  }
}

function queueSave(manual = false) {
  if (!sourceFile || !state.sourceWidth || state.history.length <= 1) return;
  const dataUrl = canvas.toDataURL("image/png");
  saveQueue = saveQueue.then(() => saveSnapshot(dataUrl, manual));
}

el("#save-image").addEventListener("click", () => queueSave(true));

window.addEventListener("keydown", (event) => {
  if (!event.ctrlKey && !event.metaKey) return;
  const key = event.key.toLowerCase();
  if (key === "z") {
    event.preventDefault();
    if (event.shiftKey) redo();
    else undo();
  } else if (key === "y") {
    event.preventDefault();
    redo();
  }
});

el("#close-editor").addEventListener("click", () => {
  window.close();
  window.setTimeout(() => { if (!window.closed) window.history.back(); }, 100);
});
window.addEventListener("resize", fitCanvas);

async function loadImage() {
  if (!sourceFile) throw new Error("缺少截圖路徑");
  const response = await fetch(`/api/image?file=${encodeURIComponent(sourceFile)}`);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "找不到截圖");
  }
  const blob = await response.blob();
  image.src = URL.createObjectURL(blob);
  await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
  setCanvasSize(image.naturalWidth, image.naturalHeight);
  drawSource();
  state.cleanSnapshot = snapshot();
  state.history = [state.cleanSnapshot];
  state.historyMarks = [0];
  state.historyIndex = 0;
  filePath.textContent = sourceFile;
  sourceStatus.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
  updateHistoryButtons();
}

loadImage().catch((error) => {
  canvas.hidden = true;
  emptyState.hidden = false;
  sourceStatus.textContent = "讀取失敗";
  filePath.textContent = error.message || "找不到截圖";
  showToast(error.message || "找不到截圖", true);
});

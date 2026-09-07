import http from "node:http";
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.SCREENSHOT_EDITOR_PORT || 4123);
const HOST = "127.0.0.1";
const EDITOR_DIR = path.dirname(fileURLToPath(import.meta.url));
const PICTURES_DIR = getPicturesDir();
const SCREENSHOT_DIR = path.resolve(PICTURES_DIR, "Screenshots");
const MAX_BODY_BYTES = 32 * 1024 * 1024;

function getPicturesDir() {
  try {
    const configured = execFileSync("xdg-user-dir", ["PICTURES"], { encoding: "utf8" }).trim();
    if (configured) return configured;
  } catch {
    // Fall back to the conventional XDG pictures location.
  }
  return path.join(os.homedir(), "Pictures");
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body),
  });
  response.end(body);
}

function isInsideScreenshotDir(candidate) {
  return candidate === SCREENSHOT_DIR || candidate.startsWith(`${SCREENSHOT_DIR}${path.sep}`);
}

function resolveScreenshotPath(rawPath) {
  if (typeof rawPath !== "string" || rawPath.length === 0) {
    throw new Error("缺少截圖路徑");
  }
  const resolved = path.resolve(rawPath);
  if (!isInsideScreenshotDir(resolved)) {
    throw new Error("只能編輯 Pictures/Screenshots 裡的圖片");
  }
  const extension = path.extname(resolved).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
    throw new Error("目前只支援 PNG、JPG 與 WebP");
  }
  return resolved;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[extension] || "application/octet-stream";
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error("圖片太大，請先縮小後再儲存");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function copyToClipboard(buffer) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (copied) => {
      if (settled) return;
      settled = true;
      resolve(copied);
    };
    const process = spawn("wl-copy", ["--type", "image/png"], { stdio: ["pipe", "ignore", "ignore"] });
    process.once("error", () => finish(false));
    process.once("close", (code) => finish(code === 0));
    process.stdin.end(buffer);
  });
}

async function saveEditedImage(input) {
  const sourcePath = resolveScreenshotPath(input?.file);
  const dataUrl = input?.dataUrl;
  const match = typeof dataUrl === "string" && dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("編輯結果不是有效的 PNG");

  await fs.access(sourcePath);
  const buffer = Buffer.from(match[1], "base64");
  const sourceName = path.basename(sourcePath, path.extname(sourcePath));
  const outputPath = path.join(path.dirname(sourcePath), `${sourceName} - annotated.png`);
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, buffer, { mode: 0o600 });
  await fs.rename(temporaryPath, outputPath);
  const copied = await copyToClipboard(buffer);
  return { outputPath, copied };
}

async function serveStatic(request, response, pathname) {
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(EDITOR_DIR, requested);
  if (!filePath.startsWith(`${EDITOR_DIR}${path.sep}`)) return json(response, 404, { error: "找不到頁面" });
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
  };
  if (!types[extension]) return json(response, 404, { error: "找不到頁面" });
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { "content-type": types[extension], "cache-control": "no-store" });
    response.end(content);
  } catch {
    json(response, 404, { error: "找不到頁面" });
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${HOST}:${PORT}`);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return json(response, 200, { ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/image") {
      const filePath = resolveScreenshotPath(url.searchParams.get("file"));
      const content = await fs.readFile(filePath);
      response.writeHead(200, { "content-type": contentTypeFor(filePath), "cache-control": "no-store" });
      return response.end(content);
    }
    if (request.method === "POST" && url.pathname === "/api/save") {
      const result = await saveEditedImage(JSON.parse(await readRequestBody(request)));
      return json(response, 200, {
        ok: true,
        outputPath: result.outputPath,
        copied: result.copied,
        message: result.copied ? "已儲存，並複製編輯後圖片" : "已儲存；目前無法寫入剪貼簿",
      });
    }
    if (request.method === "GET") return serveStatic(request, response, url.pathname);
    return json(response, 405, { error: "不支援的請求" });
  } catch (error) {
    return json(response, 400, { error: error instanceof Error ? error.message : "操作失敗" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Screenshot editor listening at http://${HOST}:${PORT}`);
});

# Pane Relay

> Languages: English first, followed by 繁體中文。

> Return to the [Herdr Control Center overview](../README.md), or open the [mobile access guide](mobile-access.md).

Pane Relay is a local web GUI for scheduling a continuation prompt to a specific Herdr pane. Every job stores the Herdr session, pane ID, and the current `agent_session` fingerprint. It refuses delivery if the pane no longer contains the same conversation.

## Requirements

- Node.js 20 or newer
- Herdr available in `PATH`, or `HERDR_BIN` set to the full binary path
- A persistent Herdr session with a recognized agent in the target pane

## Start

```bash
npm start
```

Open <http://localhost:4317>.

The browser can be closed after a job is scheduled, but the Node.js service must remain running. Jobs and delivery events are stored in `data/state.json` with owner-only file permissions.

Pane cards load a short plain-text tail only while they are near the visible route list. Preview text is kept in memory, never written to `state.json`, and refreshed at most once per minute in the browser.

Expanded workspaces default to a real spatial view generated from Herdr's pane rectangles. The relative top, bottom, left, right, and pane sizes match the current tab layout. Use the `空間 / 清單` switch when a linear list is easier; dense or inconsistent layouts automatically fall back to the safe list view.

When Herdr recognizes Codex or AGY but has no `agent_session`, Pane Relay attempts one fail-closed repair. Codex is repairable only when the live command contains an explicit `codex resume <UUID>`; AGY is repairable only when its live process holds exactly one Antigravity `presence/<UUID>.lock`. The pane tile shows the repair state and can be clicked to retry. Ambiguous evidence is never registered as a session.

The composer supports up to five PNG, JPEG, WebP, or GIF attachments of 8 MB each. Images are stored with owner-only permissions under `data/attachments`, and the scheduled prompt tells the original agent session which local paths to inspect. Herdr's prompt interface is text-only, so this local-path handoff is used instead of terminal clipboard image injection.

The queue editor can change an active job's message and scheduled time under the same per-job lock used by delivery and cancellation. It can append images without removing existing attachments, offers ordinary time shortcuts and the bound Agent's quota-reset shortcut, and closes immediately after a successful save. Pane aliases are bound to the conversation fingerprint, so changing a pane name also updates existing queue records for that conversation.

The center composer intentionally stays empty until a pane is selected. It shows only the instruction to choose a pane; the message form, attachment controls, quick times, and action buttons remain hidden rather than appearing as unusable disabled controls.

The header's global search can search older Claude, Codex, and AGY conversations without a selected pane. It uses the persistent normalized index at `~/.cache/herdr-control-center/conversation-index.json`, incrementally updates changed transcript sources, and returns constrained historical context. The selected-pane search continues to revalidate the live Herdr fingerprint before reading its transcript.

## Keep it running with systemd

This is the recommended long-term form: a small user-level background service on the same machine as Herdr, with `http://localhost:4317` as its control surface. It is not intended to be a conventional cloud-hosted web app because cloud infrastructure cannot directly access the local Herdr socket or live terminal panes.

Install the permanent user service and desktop shortcut with:

```bash
bash scripts/install-user-service.sh
```

This enables `pane-relay.service` for future user logins and creates `Pane Relay.desktop`. Clicking the shortcut starts the service if necessary, waits briefly for it to answer, then opens the local URL in the default browser.

The following creates a transient user service that restarts after failures:

```bash
systemd-run --user \
  --unit=pane-relay \
  --property=Restart=on-failure \
  --property=WorkingDirectory="$(pwd)" \
  --setenv=HERDR_BIN="$(command -v herdr)" \
  "$(command -v node)" \
  "$(pwd)/src/server.js"
```

Inspect it with:

```bash
systemctl --user status pane-relay
journalctl --user -u pane-relay
```

Stop it with:

```bash
systemctl --user stop pane-relay
```

After installation, normal control is:

```bash
systemctl --user start pane-relay
systemctl --user restart pane-relay
systemctl --user status pane-relay
```

## Delivery behavior

- `Agent 就緒後傳送` waits until Herdr reports `idle` or `done`, retrying until the configured deadline.
- `準時送出` attempts delivery at the selected time after fingerprint verification, regardless of the current agent state.
- Delivery uses `herdr --session <name> agent prompt <pane-id> <message> --wait` and is marked sent only after Herdr reports an observed agent lifecycle transition.
- Claude Code may finish converting a pasted local image path into an attachment chip after the prompt's encoded Enter has already arrived. Only when Herdr returns the structured `agent_prompt_stalled` error for a job with attachments, Pane Relay revalidates the conversation fingerprint and unchanged `state_change_seq`, sends one logical Enter through `herdr agent send-keys`, and then requires a lifecycle transition before recording success.
- Raw pane input and shell execution are never used; the image fallback remains on Herdr's agent surface.
- The browser submits the fingerprint captured at pane selection. The server returns HTTP 409 if the pane occupant changes before the schedule is created.
- A missing pane, replaced agent, changed conversation fingerprint, or ambiguous session-repair candidate fails closed.
- Active queue messages can be edited under the same per-job lock used by delivery and cancellation.
- Queue records show a continuously updated time-to-trigger label.
- After a schedule is created, the selected target, message, attachments, and form state are cleared from the composer.

Herdr 0.8.0 does not provide an atomic compare-and-send prompt command. Pane Relay verifies the fingerprint immediately before invoking `agent prompt`, which minimizes but cannot mathematically eliminate a process replacement in that brief interval.

If the original agent process exits completely, the conversation must first be restored using that agent's own resume mechanism. Pane Relay does not guess or start a replacement conversation.

## Development

```bash
npm run dev
npm test
npm run check
```

Optional environment variables:

- `HOST`: bind address, defaults to `127.0.0.1`
- `PORT`: web port, defaults to `4317`
- `HERDR_BIN`: Herdr executable, defaults to `herdr`
- `STATE_PATH`: JSON state location, defaults to `data/state.json`

Do not expose `HOST=0.0.0.0` directly. Pane previews can contain private terminal output, and Pane Relay currently has no network authentication. For access from another device, keep the service on loopback and use an authenticated SSH tunnel or private-network proxy.

## 繁體中文

> 回到 [Herdr Control Center 總覽](../README.md)，或開啟[手機存取指南](mobile-access.md)。

Pane Relay 是本機 Web GUI，可把接續 prompt 排程到指定的 Herdr pane。每筆 job 都保存 Herdr session、pane ID 與目前的 `agent_session` fingerprint；如果 pane 已不是同一段對話，系統會拒絕投遞。

### 需求

- Node.js 20 或更新版本
- `herdr` 已在 `PATH`，或設定 `HERDR_BIN` 為完整 binary 路徑
- 同一台機器上有持久 Herdr session，且目標 pane 有可辨識的 Agent

### 啟動

```bash
npm start
```

開啟 <http://localhost:4317>。

排程建立後可以關閉瀏覽器，但 Node.js service 必須繼續執行。Job 與 delivery event 以 owner-only 權限保存於 `data/state.json`。

Pane 卡片只有在接近可見 route list 時才讀取短的純文字尾端；預覽只留在記憶體，不寫入 `state.json`，瀏覽器最多每分鐘更新一次。展開 workspace 時預設使用 Herdr 真實 pane rectangle 顯示空間布局；布局過密或不一致時自動退回安全的清單模式。

Herdr 辨識 Codex 或 AGY、但沒有 `agent_session` 時，Pane Relay 會嘗試一次 fail-closed repair。Codex 只有在 live command 明確包含 `codex resume <UUID>` 時可修復；AGY 只有在 live process 正好持有一個 Antigravity `presence/<UUID>.lock` 時可修復。證據不明確時絕不註冊 session。

Composer 最多支援五張 PNG、JPEG、WebP 或 GIF 圖片，每張 8 MB。圖片以 owner-only 權限保存在 `data/attachments`，排程 prompt 會告訴原 Agent session 檢查本機路徑。因為 Herdr prompt interface 是純文字，這是取代 terminal clipboard image injection 的安全交接方式。

### 佇列編輯與空狀態

佇列編輯器可在與 delivery/cancellation 相同的 per-job lock 下修改 active job 的訊息與排程時間。可以保留既有附件並追加圖片，使用一般快速時間或該 job 綁定 Agent 的額度重置後快速時間；成功儲存後編輯畫面會立即關閉。Pane alias 綁定 conversation fingerprint，因此改名也會同步更新同一段對話的既有佇列紀錄。

尚未選 pane 時，中間 composer 只顯示「先從左側選擇 pane」提示；訊息表單、附件控制、快速時間與 action button 都會隱藏，不會顯示看似不能按的 disabled 控制項。

Header 的「全域搜尋」不需要先選 pane，就能搜尋較早的 Claude、Codex 與 AGY 對話。它使用 `~/.cache/herdr-control-center/conversation-index.json` 的持久化 normalized index，增量更新變更的 transcript source，並回傳受限的歷史前後文；選定 pane 的搜尋仍會在讀取 transcript 前重新驗證 live fingerprint。

### 使用 systemd 持續執行

長期建議使用同一台 Herdr 機器上的 user-level background service，控制入口為 `http://localhost:4317`。它不是傳統 cloud-hosted Web app，因為 cloud infrastructure 無法直接存取本機 Herdr socket 或 live terminal pane。

使用以下指令安裝永久 user service 與桌面捷徑：

```bash
bash scripts/install-user-service.sh
```

它會啟用 `pane-relay.service`，建立 `Pane Relay.desktop`；點擊捷徑時會在必要時啟動 service，等待短時間確認可用，再用預設瀏覽器開啟本機 URL。

若只要建立失敗後自動重啟的暫時 service：

```bash
systemd-run --user \
  --unit=pane-relay \
  --property=Restart=on-failure \
  --property=WorkingDirectory="$(pwd)" \
  --setenv=HERDR_BIN="$(command -v herdr)" \
  "$(command -v node)" \
  "$(pwd)/src/server.js"
```

檢查：

```bash
systemctl --user status pane-relay
journalctl --user -u pane-relay
```

停止：

```bash
systemctl --user stop pane-relay
```

安裝後的日常控制：

```bash
systemctl --user start pane-relay
systemctl --user restart pane-relay
systemctl --user status pane-relay
```

### 投遞行為

- `Agent 就緒後傳送` 會等待 Herdr 回報 `idle` 或 `done`，並在設定的 deadline 前重試。
- `準時送出` 會在指定時間先驗證 fingerprint，再依排程嘗試投遞，不受 Agent 當下狀態影響。
- 投遞使用 `herdr --session <name> agent prompt <pane-id> <message> --wait`，只有觀察到 Agent lifecycle transition 後才標記為 sent。
- 若含附件的 prompt 遇到結構化 `agent_prompt_stalled`，系統會重新驗證 conversation fingerprint 與未變動的 `state_change_seq`，只補送一次 logical Enter，並再次要求 lifecycle transition。
- 不使用 raw pane input 或 shell execution；圖片 fallback 仍走 Herdr Agent surface。
- 如果 pane occupant 在建立排程前改變，server 回傳 HTTP 409。
- pane 遺失、Agent 被替換、conversation fingerprint 改變或 session repair 證據歧義時，都會 fail closed。
- active queue message 可在 delivery/cancellation 使用的同一個 per-job lock 下編輯。
- Queue record 顯示持續更新的距離投遞倒數。
- 建立排程後，composer 會清除選定目標、訊息、附件與表單狀態。

Herdr 0.8.0 沒有 atomic compare-and-send prompt command。Pane Relay 會在呼叫 `agent prompt` 前立即比對 fingerprint，能縮小風險，但無法消除兩個 CLI 操作之間極短時間內 process 被替換的可能性。

如果原 Agent process 完全結束，必須先使用該 Agent 自己的 resume 機制恢復 conversation。Pane Relay 不會猜測或啟動替代 conversation。

### 開發

```bash
npm run dev
npm test
npm run check
```

可選環境變數：

- `HOST`：綁定位址，預設 `127.0.0.1`
- `PORT`：Web port，預設 `4317`
- `HERDR_BIN`：Herdr executable，預設 `herdr`
- `STATE_PATH`：JSON state 路徑，預設 `data/state.json`

不要直接暴露 `HOST=0.0.0.0`。Pane 預覽可能包含私有終端輸出，Pane Relay 目前沒有網路驗證；若要從其他裝置使用，請讓服務維持 loopback，再搭配經驗證的 SSH tunnel 或私有網路 proxy。

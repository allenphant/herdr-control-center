# Pane Relay

> Languages: English first, followed by 繁體中文。Technical identifiers and API commands remain unchanged.

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user: a local Node.js service with a dependency-free web interface. The implementation uses the Node.js standard library, browser-native JavaScript, and CSS so it can run alongside Herdr without a package installation step.

## Users

The primary user is a developer running multiple coding agents inside Herdr. They need to leave an existing conversation open when an agent reaches a rolling usage limit, then have a continuation prompt delivered later without returning to the terminal at the reset time.

## Product Purpose

Pane Relay schedules prompts for a manually selected Herdr pane. Success means the prompt reaches the same live conversation at the requested time, or the system refuses delivery and clearly explains why the original conversation could not be verified.

## Positioning

Jobs bind to a Herdr session, an explicit pane ID, and the occupying agent session fingerprint. The scheduler verifies all three again at dispatch time instead of routing by agent kind or display name.

## Operating Context

The product runs locally beside a persistent Herdr session. The user identifies a workspace, tab, and pane from a live, ephemeral preview of its recent terminal output; verifies the current agent identity and state; writes a continuation prompt; chooses a local date and time; and monitors queued and completed deliveries.

## Capabilities and Constraints

- Discover running Herdr sessions and their workspace, tab, pane, and agent state.
- Read a bounded plain-text tail for visible pane choices without persisting terminal content.
- Render the real Herdr tab geometry from normalized pane rectangles, with a list fallback for dense or inconsistent layouts.
- Schedule one-time, daily, or weekly prompts for an explicit pane.
- Attach up to five locally stored images and pass their verified paths to the original agent session.
- Edit queued message content before dispatch and show a live time-to-trigger label.
- Persist schedules and delivery history across application restarts.
- Verify the expected `agent_session` identity immediately before delivery.
- Safely repair a missing Codex or AGY `agent_session` from unique live-process evidence, with automatic and manual GUI triggers.
- Search the complete visible user/assistant conversation bound to the selected pane across Claude, Codex, and AGY transcripts, with fingerprint revalidation and stable context navigation.
- Render conversation Markdown as safe browser-native DOM, preserving headings, emphasis, lists, quotes, code, tables, and highlighted search terms without executing raw HTML.
- Require the fingerprint captured when the user selected the pane to still match when the schedule is created.
- Deliver only through `herdr agent prompt <pane-id>`, never through raw pane text or shell execution.
- Refuse delivery when the pane is missing, has no recognized agent, or contains a different agent session.
- Default to waiting for a settled `idle` or `done` agent state, with a bounded retry window when the pane is still working.
- The original conversation can continue only while the original agent process/session remains available. Agent-specific resume behavior after process exit is outside this product's confirmed scope.
- Herdr 0.8.0 does not expose an atomic compare-and-send operation. Pane Relay compares the fingerprint immediately before `agent prompt`, but a process replacement in the tiny interval between those two CLI operations cannot be eliminated by this client alone.
- The local service binds to loopback only and does not provide remote authentication.
- Pane previews are loaded on demand, kept only in memory, and rate-limited to three concurrent Herdr reads.
- Image attachment files persist locally with owner-only permissions because Herdr's prompt command accepts text rather than binary clipboard payloads.

## Evidence on Hand

The installed Herdr CLI exposes stable JSON for session, workspace, pane, and agent inspection. Its agent records include `pane_id`, `agent_status`, and an `agent_session` object containing a stable source and value. No external benchmarks, customers, or commercial claims are available and none should be invented.

## Product Principles

- Pane first: the selected terminal location is the delivery target.
- Conversation safe: a stale or replaced occupant is a failed job, never a best-effort send.
- Visible state: every scheduled, deferred, sent, canceled, or failed transition is inspectable.
- Spatial recognition: pane position and recent content are both available before the exact destination is selected.
- Local and reversible: configuration stays on the user's machine and scheduled jobs can be paused or canceled.
- Familiar controls: standard date, time, selection, and list interactions take priority over decorative interface patterns.

## Accessibility & Inclusion

The interface must be keyboard operable, use explicit form labels and status text, preserve visible focus, respect reduced motion, and maintain WCAG AA contrast in light and dark modes.

## 繁體中文

### 平台

Web。

### 技術棧

Pane Relay 是本機 Node.js 服務，搭配不需要安裝套件的 Web 介面。實作使用 Node.js 標準函式庫、瀏覽器原生 JavaScript 與 CSS，因此可以和 Herdr 並行執行。

### 使用者

主要使用者是在 Herdr 中同時執行多個 coding agent 的開發者。當 Agent 遇到週期性額度限制時，他們可以保留現有對話，稍後自動投遞接續訊息，不必在額度重置時回到終端機。

### 產品目的

Pane Relay 讓使用者為手動選定的 Herdr pane 排程 prompt。成功代表訊息在指定時間送達同一段 live conversation；若原本的對話無法驗證，系統必須拒絕投遞並清楚說明原因。

### 定位

每筆 job 綁定 Herdr session、明確 pane ID 與目前佔用該 pane 的 agent-session fingerprint。scheduler 在實際投遞時會再次驗證三者，而不是依 Agent 類型或顯示名稱路由。

### 執行環境

產品在持久 Herdr session 旁邊本機執行。使用者從即時、短暫的終端預覽辨認 workspace、tab 與 pane，再確認 Agent 身分與狀態、撰寫接續 prompt、選擇本機日期時間，並監看排程與已完成投遞。

### 能力與限制

- 探索執行中的 Herdr session，以及 workspace、tab、pane 與 Agent 狀態。
- 讀取有限的純文字尾端作為 pane 選擇提示，不保存終端內容。
- 依 Herdr 真實 pane rectangle 顯示空間布局；過密或不一致時退回清單模式。
- 為明確 pane 建立一次性、每日或每週 prompt 排程。
- 附加最多五張本機圖片，並把驗證過的路徑交給原本的 Agent session。
- 在投遞前編輯佇列訊息，並顯示即時倒數。
- 跨服務重啟保存排程與投遞歷史。
- 在投遞前立即驗證預期的 `agent_session` 身分。
- 依唯一的 live-process 證據安全修復 Codex 或 AGY 的缺失 `agent_session`。
- 搜尋綁定 pane 的完整可見 user/assistant 對話，以及透過 global search 搜尋 Claude、Codex、AGY 的歷史對話。
- 將 conversation Markdown 安全轉成瀏覽器原生 DOM，不執行原始 HTML。
- 要求建立排程時，pane 選取時捕獲的 fingerprint 仍然相符。
- 只能透過 `herdr agent prompt <pane-id>` 投遞，不使用 raw pane text 或 shell execution。
- pane 消失、沒有可辨識 Agent 或換成其他 session 時拒絕投遞。
- 預設等待 Agent 進入 settled 的 `idle` 或 `done` 狀態，並在仍工作時使用有限重試窗口。
- 原對話只有在原 Agent process/session 仍可用時才能繼續；process 結束後的 Agent 專屬 resume 行為不在已確認範圍內。
- 本機服務只綁定 loopback，且不提供遠端驗證。
- pane 預覽按需讀取、只留在記憶體，並限制同時 Herdr read 數量。
- 圖片附件以 owner-only 權限保存，因為 Herdr prompt command 接受文字而非 binary clipboard payload。

### 目前掌握的證據

已安裝的 Herdr CLI 提供 session、workspace、pane 與 Agent 檢查所需的穩定 JSON；Agent record 包含 `pane_id`、`agent_status` 與具備穩定 source/value 的 `agent_session`。目前沒有外部 benchmark、客戶或商業成果聲稱，不應自行捏造。

### 產品原則

- Pane 優先：選定的終端位置就是投遞目標。
- 對話安全：過期或被替換的 occupant 視為失敗，不做 best-effort send。
- 狀態可見：所有排程、deferred、sent、canceled、failed 狀態都能檢視。
- 空間辨識：在選定目的地前，同時提供 pane 位置與最近內容。
- 本機且可逆：設定留在使用者機器上，排程可暫停或取消。
- 熟悉控制：標準日期、時間、選取與清單互動優先於裝飾性介面。

### 無障礙與共融

介面必須可用鍵盤操作，使用明確表單 label 與狀態文字，保留可見 focus，尊重 reduced motion，並在明亮與深色主題維持 WCAG AA 對比度。

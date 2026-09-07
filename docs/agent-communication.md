# Herdr Agent-to-Agent Communication Exploration

> Languages: 繁體中文 first, followed by English. This is a design proposal, not a shipped feature.

This document describes a safe path for adding agent collaboration to Herdr Control Center. It is a design proposal, not a shipped feature.

## 繁體中文

本文件說明在 Herdr Control Center 中加入 Agent 協作的安全路徑。目前仍是設計提案，尚未成為已發布功能。

### 已驗證的 Herdr 基礎能力

以下行為已在 Herdr 0.8.0、protocol 19 驗證：

- `agent.prompt` 可指定單一 Agent 名稱或 pane ID，並等待 settled lifecycle state。
- `agent.wait` 可觀察 `idle`、`working`、`blocked`、`done` 與 `unknown`。
- `agent.read` 可讀取 `visible`、`recent`、`recent-unwrapped` 或 `detection` 的終端輸出。
- `events.subscribe` 與 `events.wait` 可提供 pane 和 Agent 狀態變更。
- Pane record 包含穩定 pane ID 與回報的 agent-session identity。

`agent.prompt --wait` 確認的是 lifecycle settlement，不是收到結構化 assistant reply；成功回應只包含最後的 Agent 狀態。`agent.read` 可以檢查畫面輸出，但 terminal snapshot 不是持久訊息協定：alternate-screen 歷史可能不完整，一般終端文字也無法可靠辨認某一個精確回覆。

### 建議的第一個功能：定向交接

先做一次明確操作，不要直接做自主 Agent 閒聊：

1. 使用者選擇 source pane 與精確的 target pane。
2. Control Center 捕獲 source/target session fingerprint。
3. 使用者檢視或編輯 handoff message。
4. 等待 target Agent ready 後，透過 `agent.prompt` 投遞。
5. Control Center 追蹤 target lifecycle，並引導使用者回到該 pane 檢視答案。

這能提供有用的協作，同時保留使用者控制權，避免依賴不可靠的 terminal scraping。

### 可靠的往返模式

若要自動把答案送回 source Agent，需要明確的 exchange contract。建議使用由 Control Center 管理的本機 mailbox：

```text
.herdr-control-center/exchanges/<exchange-id>/
├── request.json
├── response.md
└── result.json
```

Target prompt 會包含 exchange ID，要求 Agent 將最後的 handoff 寫入 `response.md`。Control Center 監看原子完成的檔案，再次驗證兩個 pane fingerprint，最後才提供送回 source pane 的選項。

預設不應自動轉送回覆；使用者先檢視內容，再選擇 **送回來源 pane**。未來才考慮將自動返回設為可選的 workflow policy。

### 安全規則

- 以 Herdr session 加 pane ID 定址，絕不只依 Agent kind。
- 每次送出前都驗證 source 與 target 的 agent-session fingerprint。
- 先呼叫 `agent.wait` 再呼叫 `agent.prompt`；不要在已有草稿的 pane 裡打字。
- `unknown` 代表尚未解析，不能視為完成。
- 每個 exchange 都要有 hop limit、deadline 與明確 owner。
- 絕不允許兩個 Agent 無限互相回覆。
- 保留 prompt/response audit trail，但預設將 mailbox 內容排除在 Git 之外。
- 將 Agent 回覆轉送到另一段對話前必須取得確認。

### 建議交付階段

#### Phase 1 — 手動交接

- Source pane → target pane selector
- 可編輯的 handoff message
- Target readiness 與 fingerprint checks
- 單向投遞與可見 exchange record

#### Phase 2 — 審閱後往返

- Mailbox response contract
- Response preview 與方便 diff 的 Markdown view
- 確認後送回原始 source pane

#### Phase 3 — 小型工作流

- reviewer → implementer → verifier 的順序鏈
- 平行 fan-out，再由使用者控制 merge
- 每個 Agent 的 budget、deadline 與最大 hop 數

第一版實作應停在 Phase 1，直接使用 Herdr 最強的保證，不要假裝 terminal output 是結構化的 inter-agent bus。

## English
## Verified Herdr primitives

The following behavior was verified with Herdr 0.8.0 and protocol 19:

- `agent.prompt` targets one explicit agent name or pane ID and can wait for a settled lifecycle state.
- `agent.wait` observes `idle`, `working`, `blocked`, `done`, and `unknown`.
- `agent.read` reads terminal output from `visible`, `recent`, `recent-unwrapped`, or `detection` snapshots.
- `events.subscribe` and `events.wait` expose pane and agent-state changes.
- Pane records include stable pane IDs and reported agent-session identity.

`agent.prompt --wait` confirms lifecycle settlement, not receipt of a structured assistant reply. Its success response contains the resulting agent state. `agent.read` can inspect rendered output, but terminal snapshots are not a durable message protocol: alternate-screen history may be incomplete and ordinary terminal text does not identify one exact reply reliably.

## Recommended first feature: directed handoff

Start with one deliberate operation instead of autonomous agent chatter:

1. The user selects a source pane and an exact target pane.
2. Control Center captures the source and target session fingerprints.
3. The user reviews or edits the handoff message.
4. Delivery waits until the target agent is ready, then uses `agent.prompt`.
5. Control Center tracks the target lifecycle and shows its pane as the place to review the answer.

This already provides useful collaboration while keeping the user in control and avoiding unreliable terminal scraping.

## Reliable round-trip mode

Returning an answer automatically to the source agent needs an explicit exchange contract. The recommended contract is a local mailbox owned by Control Center:

```text
.herdr-control-center/exchanges/<exchange-id>/
├── request.json
├── response.md
└── result.json
```

The target prompt includes the exchange ID and asks the agent to write its final handoff to `response.md`. Control Center watches for an atomic completed file, validates both pane fingerprints again, and only then offers to return the response to the source pane.

The response should not be relayed automatically by default. The user first reviews it and chooses **送回來源 pane**. Automatic return can be an opt-in workflow policy later.

## Safety rules

- Address panes by Herdr session plus pane ID, never agent kind alone.
- Verify the source and target agent-session fingerprints before every send.
- Call `agent.wait` before `agent.prompt`; do not type into a pane with an existing draft.
- Treat `unknown` as unresolved, not completed.
- Give every exchange a hop limit, deadline, and explicit owner.
- Never allow two agents to reply to each other indefinitely.
- Keep prompts and responses in an audit trail, but exclude mailbox contents from Git by default.
- Require confirmation before forwarding an agent response into another conversation.

## Suggested delivery phases

### Phase 1 — Manual handoff

- Source pane → target pane selector
- Editable handoff message
- Target readiness and fingerprint checks
- One-way delivery with a visible exchange record

### Phase 2 — Reviewed round trip

- Mailbox response contract
- Response preview and diff-friendly Markdown view
- Confirmed return to the original source pane

### Phase 3 — Small workflows

- Sequential reviewer → implementer → verifier chains
- Parallel fan-out with one user-controlled merge step
- Per-agent budgets, deadlines, and maximum hops

The first implementation should stop at Phase 1. It uses Herdr's strongest guarantees directly and avoids pretending terminal output is a structured inter-agent bus.

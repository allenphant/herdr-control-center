# Cross-Session Data Relay — Backlog Proposal

> Languages: English first, followed by 繁體中文。The relay remains planned and is not implemented.

Status: planned, not implemented

## Product outcome

Turn Herdr Control Center into a user-controlled relay for long-running work that crosses independent Herdr named sessions. The motivating workflow is an infection-control reporting pipeline: one persistent agent validates a newly arrived dataset, the user approves its structured outputs, and another persistent agent consumes only those approved artifacts to update a report.

This feature does not transfer full conversation context between agents and does not automatically move the main task to another agent when a quota limit is reached.

## Primary scenario

```text
New workbook
     |
     v
data-pipeline session / validation agent
     |
     | cleaned data + validation manifest
     v
Control Center approval gate
     |
     v
annual-report session / reporting agent
     |
     | report + change summary
     v
Optional presentation session
```

Each agent remains in its own native conversation, working directory, permissions, and project instructions. Control Center moves explicit tasks and artifacts, not hidden conversational state.

## Phase 1 — MVP

- Let the user create a relay from an exact source Herdr session and pane to an exact target session and pane.
- Capture and revalidate both native agent-session fingerprints before delivery.
- Provide a task composer containing purpose, approved artifact paths, constraints, and completion criteria.
- Wait for the target agent to become settled before sending through `herdr agent prompt`.
- Record queued, waiting, sent, blocked, completed, canceled, expired, and failed states.
- Require a user confirmation before any result is returned to the source agent or forwarded to another session.
- Stop safely when a pane disappears, a fingerprint changes, or the target becomes ambiguous after restore.

## Phase 2 — Nice to have

- Durable exchange mailbox with `request.json`, `response.md`, and `result.json`.
- Artifact preview, validation summary, and approve/reject gate.
- Rebind a restored pane only when the same native agent-session fingerprint has one unique match.
- Event-driven UI backed by one `session.snapshot` plus a socket subscription per running named session.
- Retry and deadline policies with an audit trail.

## Phase 3 — Future

- Bounded validation -> report -> presentation pipelines.
- Parallel fan-out followed by a user-controlled merge step.
- Per-step permission profiles, budgets, deadlines, and hop limits.
- Authenticated relays across different hosts; never expose the current loopback-only service directly.

## Non-goals

- Generic transfer of one vendor's full conversation context into another vendor's agent.
- Automatic cross-agent takeover after quota exhaustion.
- Autonomous agent-to-agent conversation loops.
- Treating terminal screen scraping as a durable reply protocol.
- Sending unapproved sensitive source data to a less-trusted session.

## Acceptance criteria for Phase 1

1. A user can select source and target agents from different running Herdr named sessions.
2. The UI shows session, workspace, tab, pane, cwd, status, and native conversation identity before confirmation.
3. Delivery is refused if either captured fingerprint no longer matches.
4. A busy target is queued and revalidated after it settles; `unknown` never counts as completion.
5. Every transition is persisted without persisting arbitrary pane output.
6. No response is forwarded into another conversation without explicit user confirmation.
7. Automated tests cover changed occupants, stopped sessions, restore/rebind ambiguity, deadlines, and duplicate delivery prevention.

## Architecture topology

```json
{
  "project_title": "Herdr Cross-Session Data Relay",
  "nodes": [
    {
      "id": "source_agent",
      "type": "platform",
      "label": "Source Herdr Agent",
      "description": "Persistent agent conversation that initiates or receives a relay",
      "layer": "business",
      "phase": "mvp",
      "ai_instructions": "Bind by named session, pane id, and native agent-session fingerprint"
    },
    {
      "id": "control_center",
      "type": "core_backend",
      "label": "Control Center Relay",
      "description": "Validates identities, schedules delivery, records transitions, and enforces approval gates",
      "layer": "logic",
      "phase": "mvp",
      "ai_instructions": "Fail closed on ambiguous identity and never infer full conversation transfer"
    },
    {
      "id": "target_agent",
      "type": "platform",
      "label": "Target Herdr Agent",
      "description": "Independent persistent agent in another named session",
      "layer": "business",
      "phase": "mvp",
      "ai_instructions": "Accept only explicit task and approved artifact references"
    },
    {
      "id": "exchange_mailbox",
      "type": "database",
      "label": "Exchange Mailbox",
      "description": "Durable request, response, and result contract",
      "layer": "infra",
      "phase": "nice_to_have",
      "ai_instructions": "Use atomic completion and exclude mailbox content from Git"
    },
    {
      "id": "approval_gate",
      "type": "user_defined",
      "label": "User Approval Gate",
      "description": "Reviews artifacts before forward or return delivery",
      "layer": "business",
      "phase": "mvp",
      "ai_instructions": "Require explicit confirmation for every cross-conversation forward"
    }
  ],
  "edges": [
    {
      "id": "e_source_control",
      "source": "source_agent",
      "target": "control_center",
      "action_label": "1. Create bounded relay task",
      "flow_type": "control",
      "protocol": "Local HTTP API",
      "payload": "{sourceSession, sourcePaneId, sourceFingerprint, task, artifacts}"
    },
    {
      "id": "e_control_target",
      "source": "control_center",
      "target": "target_agent",
      "action_label": "2. Wait, revalidate, and deliver",
      "flow_type": "control",
      "protocol": "Herdr CLI or local socket API",
      "payload": "agent.wait + fingerprint check + agent.prompt"
    },
    {
      "id": "e_target_mailbox",
      "source": "target_agent",
      "target": "exchange_mailbox",
      "action_label": "3. Commit structured result",
      "flow_type": "data",
      "protocol": "Atomic local file contract",
      "payload": "response.md + result.json"
    },
    {
      "id": "e_mailbox_approval",
      "source": "exchange_mailbox",
      "target": "approval_gate",
      "action_label": "4. Preview and approve",
      "flow_type": "control",
      "protocol": "Local web UI",
      "payload": "{exchangeId, summary, artifacts, provenance}"
    },
    {
      "id": "e_approval_source",
      "source": "approval_gate",
      "target": "source_agent",
      "action_label": "5. Confirmed return",
      "flow_type": "control",
      "protocol": "Herdr agent.prompt",
      "payload": "User-approved response and artifact references"
    }
  ]
}
```

## 繁體中文

### 產品結果

把 Herdr Control Center 發展成由使用者控制的 relay，支援跨越彼此獨立的 Herdr named session 的長時間工作。代表情境是感染管制年報流程：一個持久 Agent 驗證新到資料，使用者核准結構化輸出，另一個持久 Agent 只消費核准過的 artifact 來更新報告。

這個功能不會把完整 conversation context 從一個 Agent 搬到另一個 Agent，也不會在 quota limit 時自動把主線任務轉交給其他 Agent。

### 主要情境

```text
新工作簿
   |
   v
data-pipeline session / 驗證 Agent
   |
   | 清理後資料 + validation manifest
   v
Control Center 核准閘門
   |
   v
annual-report session / 報告 Agent
   |
   | 報告 + 變更摘要
   v
可選的簡報 session
```

每個 Agent 保留自己的原生 conversation、工作目錄、權限與 project instructions。Control Center 只搬運明確的任務與 artifact，不搬運隱藏的對話狀態。

### Phase 1 — MVP

- 使用者可從一個精確的 source Herdr session/pane 建立 relay 到精確的 target session/pane。
- 投遞前捕獲並重新驗證兩端的 native agent-session fingerprint。
- 提供包含目的、核准 artifact 路徑、限制與完成條件的 task composer。
- 等待 target Agent settled 後，透過 `herdr agent prompt` 送出。
- 記錄 queued、waiting、sent、blocked、completed、canceled、expired 與 failed 狀態。
- 任何結果返回 source Agent 或轉送到其他 session 前，都要求使用者確認。
- pane 消失、fingerprint 改變或 restore 後 target 身分不明時安全停止。

### Phase 2 — Nice to have

- 使用 `request.json`、`response.md`、`result.json` 的持久 exchange mailbox。
- Artifact preview、validation summary 與 approve/reject gate。
- 只有在同一 native agent-session fingerprint 有唯一匹配時，才重新綁定 restore 後的 pane。
- 每個執行中的 named session 使用一個 `session.snapshot` 加 socket subscription 的事件驅動 UI。
- 具備 audit trail 的 retry 與 deadline policy。

### Phase 3 — Future

- 受界線控制的 validation → report → presentation pipeline。
- 平行 fan-out 後由使用者控制 merge。
- 每一步的 permission profile、budget、deadline 與 hop limit。
- 不同主機之間的 authenticated relay；絕不能直接暴露目前只綁 loopback 的服務。

### 非目標

- 將某一家 Agent vendor 的完整 conversation context 泛用轉移給另一家 Agent。
- quota 用盡後自動接管跨 Agent 任務。
- 自主的 Agent-to-agent 無限對話迴圈。
- 把 terminal screen scraping 當作持久 reply protocol。
- 將未核准的敏感來源資料送到信任程度較低的 session。

### Phase 1 驗收條件

1. 使用者可以從不同的 Herdr named session 選擇 source 與 target Agent。
2. 確認前 UI 顯示 session、workspace、tab、pane、cwd、status 與 native conversation identity。
3. 任一捕獲的 fingerprint 不再相符時，投遞必須拒絕。
4. target 忙碌時進入 queue，settled 後重新驗證；`unknown` 永遠不能算完成。
5. 每次狀態轉移都要持久化，但不能持久化任意 pane output。
6. 沒有使用者明確確認，不得把 response 送入另一段對話。
7. 自動化測試涵蓋 occupant 變更、session 停止、restore/rebind 歧義、deadline 與重複投遞防護。

下面的 JSON topology 是機器可讀的架構資料，節點名稱與 payload 欄位維持英文以供工具使用。

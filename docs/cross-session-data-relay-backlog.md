# Cross-Session Data Relay — Backlog Proposal

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

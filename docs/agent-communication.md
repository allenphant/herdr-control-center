# Herdr Agent-to-Agent Communication Exploration

This document describes a safe path for adding agent collaboration to Herdr Control Center. It is a design proposal, not a shipped feature.

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

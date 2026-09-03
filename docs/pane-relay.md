# Pane Relay

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

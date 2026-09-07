# Herdr Control Center

Herdr Control Center combines **Pane Relay**, a local web console for returning scheduled messages to an exact Herdr pane and conversation, with a practical mobile-access guide for controlling the same persistent workspace from another device.

The web console does not route by agent name alone. Every delivery is bound to the selected Herdr session, pane ID, and current agent-session fingerprint. If the pane no longer contains the same conversation, delivery is refused.

## What is included

- Spatial Herdr workspace, tab, and pane browser with live terminal previews
- Current-conversation and global history search across Claude, Codex, and AGY with role filters, highlighted matches, pagination, and surrounding context
- Exact-pane continuation scheduling and immediate delivery with confirmation
- Conversation fingerprint verification and fail-closed session repair
- Message editing, image attachments, delivery countdowns, recurring schedules, and queue record editing
- Codex, Claude, and AGY quota summaries with reset-time shortcuts
- Queue editor support for changing scheduled messages/times, appending images, closing after save, and syncing pane aliases
- Optional desktop screenshot editor for marking and copying annotated PNGs without overwriting originals
- A user-level `systemd` service and desktop shortcut
- Mobile and remote access through Herdr, SSH, Tailscale, and Termius

## Requirements

- Linux with a running Herdr session
- Node.js 20 or newer
- `herdr` available in `PATH`
- For global search, local Claude, Codex, or AGY transcript history under the provider's standard home directory

## Start Pane Relay

```bash
git clone https://github.com/allenphant/herdr-control-center.git
cd herdr-control-center
npm start
```

Open <http://localhost:4317>.

For a persistent background service and desktop shortcut:

```bash
bash scripts/install-user-service.sh
```

The installer creates and enables `pane-relay.service`, then adds a **Pane Relay** launcher to the desktop and application menu.

The Pane Relay service is the persistent deployment for the control center. It runs `src/server.js` as a user-level systemd service on the same machine as Herdr; the browser may close while scheduled jobs continue running.

## Global history search

Use **全域搜尋** in the header to search older conversations without selecting a pane first. The search covers visible user and assistant messages from:

- Claude: `~/.claude/projects/`
- Codex: `~/.codex/sessions/`
- AGY: `~/.gemini/antigravity-cli/brain/`

The first search after a service restart may build or update the local index. The persistent index is stored at `~/.cache/herdr-control-center/conversation-index.json`; subsequent searches reuse it and update only changed transcript sources. The index contains normalized visible conversation text and source signatures, so it should be treated as private local data. The browser receives constrained conversation fingerprints and context, never native transcript paths.

## Optional screenshot editor

The screenshot editor is a separate local desktop workflow; it is not started by `pane-relay.service` or `scripts/install-user-service.sh`. Start its watcher separately:

```bash
bash scripts/screenshot-editor-watcher.sh
```

The watcher monitors the XDG `Pictures/Screenshots` directory, starts a loopback editor at `http://127.0.0.1:4123` when needed, and opens a notification after a new screenshot arrives. The editor supports pen, rectangle, ellipse, crop, undo/redo, and saving a new ` - annotated.png` file while preserving the original. `inotifywait` is required for watching; `notify-send` provides the notification path, `google-chrome` or `xdg-open` opens the editor, and `wl-copy` enables copying the annotated PNG to the clipboard.

## Demo

<p align="center">
  <img src="docs/demo/pane-relay-desktop.png" alt="Pane Relay desktop control center" width="1200" />
</p>

<p align="center">
  <img src="docs/demo/herdr-mobile.jpg" alt="Herdr mobile workflow" width="420" />
</p>

## Documentation

- [Pane Relay setup, delivery guarantees, and development](docs/pane-relay.md)
- [Mobile and cross-device Herdr access](docs/mobile-access.md)
- [Agent-to-agent communication exploration](docs/agent-communication.md)
- [Cross-session data relay backlog proposal](docs/cross-session-data-relay-backlog.md)
- [Conversation search contract, architecture, and backlog](docs/conversation-search-backlog.md)
- [Sample Herdr configuration](config.toml.example)

## Security model

Pane Relay binds to `127.0.0.1` by default and has no built-in network authentication. Do not expose it directly with `HOST=0.0.0.0`. For another device, use an authenticated SSH tunnel or a private-network proxy. Pane previews and uploaded images may contain private project information.

Pane Relay runtime state and uploaded attachments live under `data/` by default and are intentionally excluded from Git. The global conversation index lives under `~/.cache/herdr-control-center/`; provider quota readers may also use their local statusline or usage caches. The screenshot editor writes annotated images under the user's `Pictures/Screenshots` directory and never overwrites the source image. All of these locations may contain private project or conversation information.

## Development

```bash
npm run dev
npm test
npm run check
```

## License

[MIT](LICENSE)

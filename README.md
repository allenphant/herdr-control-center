# Herdr Control Center

Herdr Control Center combines **Pane Relay**, a local web console for returning scheduled messages to an exact Herdr pane and conversation, with a practical mobile-access guide for controlling the same persistent workspace from another device.

The web console does not route by agent name alone. Every delivery is bound to the selected Herdr session, pane ID, and current agent-session fingerprint. If the pane no longer contains the same conversation, delivery is refused.

## What is included

- Spatial Herdr workspace, tab, and pane browser with live terminal previews
- Exact-pane continuation scheduling and immediate delivery with confirmation
- Conversation fingerprint verification and fail-closed session repair
- Message editing, image attachments, delivery countdowns, and recurring schedules
- Codex, Claude, and AGY quota summaries with reset-time shortcuts
- A user-level `systemd` service and desktop shortcut
- Mobile and remote access through Herdr, SSH, Tailscale, and Termius

## Requirements

- Linux with a running Herdr session
- Node.js 20 or newer
- `herdr` available in `PATH`

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
- [Sample Herdr configuration](config.toml.example)

## Security model

Pane Relay binds to `127.0.0.1` by default and has no built-in network authentication. Do not expose it directly with `HOST=0.0.0.0`. For another device, use an authenticated SSH tunnel or a private-network proxy. Pane previews and uploaded images may contain private project information.

Runtime state, quota snapshots, and uploaded attachments live under `data/` and are intentionally excluded from Git.

## Development

```bash
npm run dev
npm test
npm run check
```

## License

[MIT](LICENSE)

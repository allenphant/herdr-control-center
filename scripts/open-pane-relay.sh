#!/usr/bin/env bash
set -euo pipefail

systemctl --user start pane-relay.service

for _attempt in $(seq 1 25); do
  if curl -fsS http://127.0.0.1:4317/api/health >/dev/null 2>&1; then
    xdg-open http://127.0.0.1:4317 >/dev/null 2>&1 &
    exit 0
  fi
  sleep 0.2
done

xdg-open http://127.0.0.1:4317 >/dev/null 2>&1 &

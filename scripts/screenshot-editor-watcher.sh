#!/usr/bin/env bash
set -u

PIC_DIR="$(xdg-user-dir PICTURES 2>/dev/null || printf '%s/Pictures' "$HOME")"
SCREENSHOT_DIR="$PIC_DIR/Screenshots"
EDITOR_DIR="/home/cdc/CCdevelopment/herdr-control-center/screenshot-editor"
EDITOR_URL="http://127.0.0.1:4123"
NOTICE_SCRIPT="$EDITOR_DIR/notify.py"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp}"
LOG_FILE="$RUNTIME_DIR/screenshot-editor.log"

mkdir -p "$SCREENSHOT_DIR"

if ! curl -fsS --max-time 1 "$EDITOR_URL/api/health" >/dev/null 2>&1; then
  nohup node "$EDITOR_DIR/server.mjs" >>"$LOG_FILE" 2>&1 &
  for _ in {1..20}; do
    curl -fsS --max-time 1 "$EDITOR_URL/api/health" >/dev/null 2>&1 && break
    sleep 0.1
  done
fi

notify_for_capture() {
  local file="$1"
  GDK_BACKEND=x11 python3 "$NOTICE_SCRIPT" "$file" >/dev/null 2>&1 &
}

inotifywait -m "$SCREENSHOT_DIR" -e create -e moved_to --format '%w%f' 2>/dev/null |
while IFS= read -r file; do
  case "$file" in
    *" - annotated.png") continue ;;
    *.png|*.jpg|*.jpeg|*.webp) ;;
    *) continue ;;
  esac
  [[ -f "$file" ]] || continue
  ( sleep 0.45; notify_for_capture "$file" ) &
done

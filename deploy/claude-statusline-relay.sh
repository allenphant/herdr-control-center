#!/usr/bin/env bash

# Mirror Claude Code's official statusline JSON for Pane Relay, then preserve
# the user's previous statusline command. Every failure is intentionally open.
set +e

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)
snapshot_path="$project_root/data/claude-quota.json"
upstream_path="$project_root/data/claude-statusline-upstream.json"
payload=$(cat)

if [ -n "$project_root" ] && [ -n "$payload" ]; then
  mkdir -p "$project_root/data" 2>/dev/null
  temp_path=$(mktemp "$project_root/data/.claude-quota.XXXXXX" 2>/dev/null)
  if [ -n "$temp_path" ]; then
    printf '%s\n' "$payload" > "$temp_path" 2>/dev/null
    chmod 600 "$temp_path" 2>/dev/null
    mv "$temp_path" "$snapshot_path" 2>/dev/null
  fi
fi

upstream=$(jq -r '.command // empty' "$upstream_path" 2>/dev/null)
if [ -n "$upstream" ]; then
  printf '%s' "$payload" | bash -lc "$upstream"
else
  printf '%s' "$payload" | jq -r '
    .model.display_name as $model |
    .rate_limits.five_hour.used_percentage as $used |
    if $used == null then "[\($model)]"
    else "[\($model)] · 5h \(100 - $used | floor)% left"
    end
  ' 2>/dev/null
fi

exit 0

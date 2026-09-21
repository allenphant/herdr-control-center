#!/usr/bin/env bash

# Mirror Antigravity CLI's official status-line JSON (which carries the
# `quota` buckets) for Pane Relay, then preserve the user's previous
# status-line command. Every failure is intentionally open.
set +e

project_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)
snapshot_path="$project_root/data/agy-quota.json"
upstream_path="$project_root/data/agy-statusline-upstream.json"
payload=$(cat)

if [ -n "$project_root" ] && [ -n "$payload" ]; then
  mkdir -p "$project_root/data" 2>/dev/null
  temp_path=$(mktemp "$project_root/data/.agy-quota.XXXXXX" 2>/dev/null)
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
    (.model.display_name // "AGY") as $model |
    (.quota["gemini-5h"].remaining_fraction // .quota["3p-5h"].remaining_fraction) as $left |
    if $left == null then "[\($model)]"
    else "[\($model)] · 5h \($left * 100 | floor)% left"
    end
  ' 2>/dev/null
fi

exit 0

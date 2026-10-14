#!/usr/bin/env bash
# Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
# Runs a Cloudflare quick tunnel and records every new playtest link, so a restart is never silent.
# Current link -> $LINK_FILE; every change -> $LINK_FILE.history; macOS also shows a notification.
# Usage: deploy/tunnel.sh [http://127.0.0.1:8787]
set -uo pipefail
TARGET="${1:-http://127.0.0.1:8787}"
LINK_FILE="${HAIL_LINK_FILE:-$(cd "$(dirname "$0")/.." && pwd)/outputs/playtest-link.txt}"
mkdir -p "$(dirname "$LINK_FILE")"
cloudflared tunnel --no-autoupdate --url "$TARGET" 2>&1 | while IFS= read -r line; do
  printf '%s\n' "$line"
  url=$(printf '%s' "$line" | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)
  [ -z "$url" ] && continue
  stamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  printf '%s/index.html\n' "$url" > "$LINK_FILE"
  printf '%s %s/index.html\n' "$stamp" "$url" >> "$LINK_FILE.history"
  echo "PLAYTEST LINK CHANGED: $url/index.html"
  if command -v osascript >/dev/null; then
    osascript -e "display notification \"$url/index.html\" with title \"Hail playtest link changed\" sound name \"Glass\"" >/dev/null 2>&1 || true
  fi
done

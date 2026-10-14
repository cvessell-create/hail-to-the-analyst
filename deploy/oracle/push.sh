#!/usr/bin/env bash
# Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
# Run on the host Mac: copies setup.sh and the verified public-domain myth cache to the VM, then runs setup.
# Usage: deploy/oracle/push.sh ubuntu@<vm-public-ip>
set -euo pipefail
TARGET="${1:?usage: push.sh ubuntu@<vm-ip>}"
KEY="${HAIL_SSH_KEY:-$HOME/.ssh/hail_oracle}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FRAMEWORK="${FRAMEWORK_DIR:-$HERE/../../../VessellFramework_Local_Rebuild}"
SSH=(ssh -i "$KEY" -o StrictHostKeyChecking=accept-new)
"${SSH[@]}" "$TARGET" 'rm -rf /tmp/hail-myth-cache && mkdir -p /tmp/hail-myth-cache'
if compgen -G "$FRAMEWORK/data/myth_corpus/cache/*.txt" >/dev/null; then
  scp -i "$KEY" "$FRAMEWORK"/data/myth_corpus/cache/*.txt "$TARGET:/tmp/hail-myth-cache/"
fi
scp -i "$KEY" "$HERE/setup.sh" "$TARGET:/tmp/hail-setup.sh"
"${SSH[@]}" "$TARGET" 'bash /tmp/hail-setup.sh'

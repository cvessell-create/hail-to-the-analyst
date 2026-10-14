#!/usr/bin/env bash
# Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
# Run on the host Mac: prints the VM's current playtest link and its change history.
# Usage: deploy/oracle/link.sh ubuntu@<vm-public-ip>
set -euo pipefail
ssh -i "${HAIL_SSH_KEY:-$HOME/.ssh/hail_oracle}" "${1:?usage: link.sh ubuntu@<vm-ip>}" \
  'cat /opt/hail/link.txt; echo "--- history (UTC) ---"; tail -n 10 /opt/hail/link.txt.history 2>/dev/null || true'

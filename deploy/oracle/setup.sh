#!/usr/bin/env bash
# Copyright 2026 Christopher R. Vessell. SPDX-License-Identifier: Apache-2.0
# One-shot beta host for an Oracle Always Free Ampere A1 VM (Ubuntu 24.04, arm64).
# Clones both public repos, verifies the pinned SI model, and runs the game server,
# SI chat, Ollama and a Cloudflare quick tunnel as systemd services.
# No secrets, Hugging Face tokens or the host Mac's outputs/ are copied.
# Usage (on the VM): bash setup.sh   Re-run to update to the latest pushed commits.
set -euo pipefail
GAME_BRANCH="${GAME_BRANCH:-fix/hosted-movement}"
SI_BRANCH="${SI_BRANCH:-repair/repo-and-state-law-docs}"
APP=/opt/hail
GGUF=qwen2.5-0.5b-instruct-q4_k_m.gguf
GGUF_SHA256=74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db

sudo apt-get update -y
sudo apt-get install -y git curl ca-certificates software-properties-common
if ! command -v python3.13 >/dev/null; then
  sudo add-apt-repository -y ppa:deadsnakes/ppa && sudo apt-get update -y
  sudo apt-get install -y python3.13 python3.13-venv
fi
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v ollama >/dev/null || curl -fsSL https://ollama.com/install.sh | sh
if ! command -v cloudflared >/dev/null; then
  curl -fsSL -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i /tmp/cloudflared.deb
fi

id hail >/dev/null 2>&1 || sudo useradd --system --create-home --home-dir "$APP" --shell /usr/sbin/nologin hail
clone() { # repo dir branch
  if [ -d "$APP/$2/.git" ]; then sudo -u hail git -C "$APP/$2" fetch -q origin "$3" && sudo -u hail git -C "$APP/$2" reset -q --hard "origin/$3"
  else sudo -u hail git clone -q --branch "$3" "https://github.com/cvessell-create/$1.git" "$APP/$2"; fi
}
clone hail-to-the-analyst game "$GAME_BRANCH"
clone VessellFramework_Local_Rebuild framework "$SI_BRANCH"

FW="$APP/framework"
[ -x "$FW/.venv/bin/python3.13" ] || sudo -u hail python3.13 -m venv "$FW/.venv"
# Public-domain folklore cache copied from the host Mac by push.sh; load() re-checks lock.json hashes.
if [ -d /tmp/hail-myth-cache ]; then
  sudo -u hail mkdir -p "$FW/data/myth_corpus/cache"
  sudo cp /tmp/hail-myth-cache/*.txt "$FW/data/myth_corpus/cache/" && sudo chown -R hail: "$FW/data/myth_corpus/cache"
fi
sudo -u hail "$FW/.venv/bin/pip" install -q -e "$FW"
MODEL_DIR="$FW/models/Qwen--Qwen2.5-0.5B-Instruct-GGUF"
sudo -u hail mkdir -p "$MODEL_DIR"
if [ ! -f "$MODEL_DIR/$GGUF" ]; then
  sudo -u hail curl -fsSL -o "$MODEL_DIR/$GGUF" "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/$GGUF"
fi
echo "$GGUF_SHA256  $MODEL_DIR/$GGUF" | sha256sum -c -

sudo mkdir -p /etc/systemd/system/ollama.service.d
printf '[Service]\nEnvironment=OLLAMA_KEEP_ALIVE=24h\nEnvironment=OLLAMA_HOST=127.0.0.1:11434\n' | sudo tee /etc/systemd/system/ollama.service.d/hail.conf >/dev/null
sudo systemctl daemon-reload && sudo systemctl enable --now ollama && sudo systemctl restart ollama
for _ in $(seq 30); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null && break; sleep 1; done
(cd "$FW" && sudo -u hail .venv/bin/python -m vessell.si_chat setup)

unit() { # name description workdir env exec
  sudo tee "/etc/systemd/system/$1.service" >/dev/null <<EOF
[Unit]
Description=$2
After=network-online.target ollama.service
Wants=network-online.target
[Service]
User=hail
WorkingDirectory=$3
Environment=$4
ExecStart=$5
Restart=always
RestartSec=5
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
EOF
}
unit hail-si "Vessell SI chat" "$FW" "PYTHONUNBUFFERED=1" "$FW/.venv/bin/python -m vessell.si_chat serve"
unit hail-game "Hail to the Analyst game server (public mode)" "$APP/game" "HAIL_PUBLIC=1 PORT=8787" "/usr/bin/node server/index.js"
unit hail-tunnel "Cloudflare quick tunnel to the game" "$APP" "HAIL_LINK_FILE=$APP/link.txt" "/bin/bash $APP/game/deploy/tunnel.sh http://127.0.0.1:8787"
sudo systemctl daemon-reload
sudo systemctl enable hail-si hail-game hail-tunnel
sudo systemctl restart hail-si hail-game hail-tunnel

sleep 2; for _ in $(seq 60); do [ -s "$APP/link.txt" ] && break; sleep 2; done
echo "Playtest link: $(cat "$APP/link.txt" 2>/dev/null || echo 'not ready; check: sudo journalctl -u hail-tunnel')"
echo "The link changes whenever hail-tunnel restarts; every change is logged in $APP/link.txt.history (check with link.sh)."

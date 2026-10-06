#!/usr/bin/env bash
# Reaplica o hostname casa.danilolopes.dev no Caddyfile vivo da VPS.
# Use de novo depois de um rsync do repositório vps-mini, que repõe esse arquivo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=deploy/remote.sh
source "$ROOT/deploy/remote.sh"

if [[ ! -f deploy/vps.env ]]; then
  echo "Falta deploy/vps.env. Copie: cp deploy/env.example deploy/vps.env" >&2
  exit 1
fi

snippet="$(mktemp)"
trap 'rm -f "$snippet"' EXIT
python3 deploy/vps_files.py render-snippet "$snippet"

vps "test -f /opt/vps-mini/Caddyfile"
vps "mkdir -p $REMOTE_DIR && chmod 700 $REMOTE_DIR"
enviar "$ROOT/deploy/caddy_splice.py" "$REMOTE_DIR/caddy_splice.py"
enviar "$snippet" "$REMOTE_DIR/caddy.snippet"
vps "chmod 600 $REMOTE_DIR/caddy.snippet"
recarregar_caddy apply
echo "Caddy encaminha casa.danilolopes.dev para o painel."

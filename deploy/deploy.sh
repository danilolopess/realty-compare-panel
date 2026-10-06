#!/usr/bin/env bash
# Sobe o painel em /opt/realty-compare. Não altera o git do vps-mini.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=deploy/remote.sh
source "$ROOT/deploy/remote.sh"

if [[ ! -f .env ]]; then
  echo "Falta o .env na raiz do painel, com VITE_LLM_API_KEY." >&2
  exit 1
fi
if [[ ! -f deploy/vps.env ]]; then
  echo "Falta deploy/vps.env. Copie: cp deploy/env.example deploy/vps.env" >&2
  exit 1
fi

python3 - <<'PY'
import pathlib
import sys
ok = False
for linha in pathlib.Path(".env").read_text().splitlines():
    if linha.startswith("VITE_LLM_API_KEY="):
        ok = bool(linha.split("=", 1)[1].strip().strip('"').strip("'"))
if not ok:
    sys.exit("VITE_LLM_API_KEY ausente no .env")
PY

python3 deploy/vps_files.py ensure-password
pre="$(mktemp)"
trap 'rm -f "$pre"' EXIT
python3 deploy/vps_files.py render-snippet "$pre"
rm -f "$pre"
trap - EXIT

echo "Conferindo a rede do Caddy na VPS..."
vps "docker network inspect vps-mini_default >/dev/null"
vps "test -f /opt/vps-mini/Caddyfile"

echo "Construindo a imagem neste WSL..."
DOCKER_BUILDKIT=1 docker build \
  --platform linux/amd64 \
  --secret id=appenv,src="$ROOT/.env" \
  -f deploy/Dockerfile \
  -t "$IMAGE" \
  "$ROOT"

echo "Enviando a imagem para a VPS..."
docker save "$IMAGE" | sudo ssh "$HOST" docker load

echo "Publicando o Compose em $REMOTE_DIR..."
vps "mkdir -p $REMOTE_DIR && chmod 700 $REMOTE_DIR"

env_remoto="$(mktemp)"
trap 'rm -f "$env_remoto"' EXIT
python3 deploy/vps_files.py write-remote-env "$env_remoto"
enviar "$ROOT/deploy/compose.yaml" "$REMOTE_DIR/compose.yaml"
enviar "$ROOT/deploy/caddy_splice.py" "$REMOTE_DIR/caddy_splice.py"
enviar "$ROOT/docker/init.sql" "$REMOTE_DIR/init.sql"
enviar "$env_remoto" "$REMOTE_DIR/.env"
rm -f "$env_remoto"
trap - EXIT
vps "chmod 600 $REMOTE_DIR/.env"

echo "Subindo Postgres, PostgREST e o site..."
vps "cd $REMOTE_DIR && docker compose pull db postgrest && docker compose up -d"

bash "$ROOT/deploy/caddy-apply.sh"
echo "Pronto. Confira com: curl -sI https://casa.danilolopes.dev"

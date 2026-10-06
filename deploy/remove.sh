#!/usr/bin/env bash
# Tira casa.danilolopes.dev do ar e apaga contêineres, volume e imagem deste app.
# Não mexe nos volumes vps-mini_* nem no Postgres do chat/n8n/newsletter.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=deploy/remote.sh
source "$ROOT/deploy/remote.sh"

vps "test -f /opt/vps-mini/Caddyfile"
vps "mkdir -p $REMOTE_DIR"
enviar "$ROOT/deploy/caddy_splice.py" "$REMOTE_DIR/caddy_splice.py"
recarregar_caddy remove
echo "Hostname removido do Caddy."

if vps "test -f $REMOTE_DIR/compose.yaml"; then
  vps "cd $REMOTE_DIR && docker compose down -v --remove-orphans"
fi

vps "docker rmi $IMAGE || true"
vps 'for imagem in postgres:16-alpine postgrest/postgrest:v16.4; do
  if [ -z "$(docker ps -aq --filter ancestor="$imagem")" ]; then
    docker rmi "$imagem" || true
  fi
done'
vps "rm -rf $REMOTE_DIR"

if docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker rmi "$IMAGE" || true
fi

echo "Painel removido da VPS. Troque a chave VITE_LLM_API_KEY no provedor: ela estava no JavaScript do site."

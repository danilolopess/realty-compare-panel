# Funções compartilhadas pelos scripts de deploy. Não execute este arquivo sozinho.
HOST="${VPS_HOST:-racknerd-4351839}"
REMOTE_DIR=/opt/realty-compare
IMAGE=realty-compare-web:latest

vps() {
  sudo ssh "$HOST" "$@"
}

enviar() {
  sudo rsync -a -e "sudo ssh" "$1" "${HOST}:$2"
}

recarregar_caddy() {
  local modo="$1"
  vps bash -s -- "$modo" <<'EOF'
set -euo pipefail
modo="$1"
bak=/opt/vps-mini/Caddyfile.realty-compare.bak
caddy=/opt/vps-mini/Caddyfile
cp "$caddy" "$bak"
python3 /opt/realty-compare/caddy_splice.py "$modo" "$caddy" /opt/realty-compare/caddy.snippet
cd /opt/vps-mini
restaurar() {
  cp "$bak" "$caddy"
  docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile || true
  rm -f "$bak"
}
if ! docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile; then
  echo "Caddy rejeitou a configuração. Caddyfile anterior restaurado." >&2
  restaurar
  exit 1
fi
if ! docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile; then
  echo "caddy reload falhou. Caddyfile anterior restaurado." >&2
  restaurar
  exit 1
fi
rm -f "$bak"
EOF
}

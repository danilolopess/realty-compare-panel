#!/usr/bin/env bash
# Dump completo do Postgres local (schema + dados) em backup/imoveis-AAAAMMDD-HHMMSS.sql
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

DB_NAME=imoveis
DB_USER=user
DB_PASSWORD=pass
CONTAINER_NAME="$(basename "$ROOT" | tr '[:upper:]' '[:lower:]')-db-1"

if docker info >/dev/null 2>&1; then
  DOCKER=(docker)
elif command -v docker.exe >/dev/null 2>&1 && docker.exe info >/dev/null 2>&1; then
  # No WSL sem integração, o comando `docker` é um atalho quebrado.
  # O cliente do Docker Desktop no Windows enxerga os containers.
  DOCKER=(docker.exe)
else
  echo "Não foi possível consultar o Docker." >&2
  echo "Abra o Docker Desktop. No WSL, ative a integração desta distro ou deixe o docker.exe no PATH." >&2
  exit 1
fi

run_in_db() {
  local cid=""
  cid="$("${DOCKER[@]}" compose ps --status running -q db 2>/dev/null || true)"
  cid="${cid//$'\r'/}"
  cid="${cid%%$'\n'*}"
  if [[ -n "$cid" ]]; then
    "${DOCKER[@]}" compose exec -T -e PGPASSWORD="$DB_PASSWORD" db "$@"
    return
  fi
  if "${DOCKER[@]}" ps --format '{{.Names}}' | tr -d '\r' | grep -qx "$CONTAINER_NAME"; then
    "${DOCKER[@]}" exec -i -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER_NAME" "$@"
    return
  fi
  echo "O container do banco não está no ar. Suba com: docker compose up -d" >&2
  exit 1
}

run_in_db pg_isready -q -U "$DB_USER" -d "$DB_NAME"

mkdir -p "$ROOT/backup"
stamp="$(date +%Y%m%d-%H%M%S)"
out="$ROOT/backup/imoveis-${stamp}.sql"
partial="${out}.partial"
trap 'rm -f "$partial"' EXIT

run_in_db pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner > "$partial"

mv "$partial" "$out"
trap - EXIT
echo "$out"

#!/usr/bin/env bash
# Restaura um dump SQL por cima do Postgres local.
# Uso: ./import-db.sh [arquivo.sql] [--yes]
# Sem arquivo, usa o .sql mais recente em backup/.
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

yes=0
file=""
for arg in "$@"; do
  case "$arg" in
    --yes) yes=1 ;;
    -*)
      echo "Opção desconhecida: $arg" >&2
      echo "Uso: ./import-db.sh [arquivo.sql] [--yes]" >&2
      exit 1
      ;;
    *)
      if [[ -n "$file" ]]; then
        echo "Informe apenas um arquivo." >&2
        exit 1
      fi
      file="$arg"
      ;;
  esac
done

if [[ -z "$file" ]]; then
  file="$(ls -1t "$ROOT"/backup/*.sql 2>/dev/null | head -n 1 || true)"
  if [[ -z "$file" ]]; then
    echo "Nenhum backup em backup/. Informe o arquivo: ./import-db.sh caminho/do/dump.sql" >&2
    exit 1
  fi
fi

if [[ ! -f "$file" ]]; then
  echo "Arquivo não encontrado: $file" >&2
  exit 1
fi

run_in_db pg_isready -q -U "$DB_USER" -d "$DB_NAME"

if [[ "$yes" -ne 1 ]]; then
  read -r -p "Isso substitui os dados atuais do banco com '$file'. Continuar? [s/N] " resp
  if [[ ! "$resp" =~ ^[sS]$ ]]; then
    echo "Cancelado."
    exit 1
  fi
fi

run_in_db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 < "$file"

echo "Importação concluída: $file"

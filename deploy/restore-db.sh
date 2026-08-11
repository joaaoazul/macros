#!/usr/bin/env bash
#
# Restaura um backup criado pelo backup-db.sh.
#
#   ./deploy/restore-db.sh --latest              # ensaio: restaura para uma base
#                                                # temporária, conta as linhas e apaga-a
#   ./deploy/restore-db.sh --file <ficheiro>     # o mesmo, para um ficheiro à escolha
#   ./deploy/restore-db.sh --latest --force      # restauro a sério, por cima da produção
#
# O modo de ensaio é o que interessa correr de vez em quando: um backup que
# nunca foi restaurado não é um backup. Não toca na base de produção.

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

env_value() {
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -1
}

cfg() {
  local name="$1" fallback="${2-}"
  local from_env="${!name-}"
  if [ -n "$from_env" ]; then printf '%s' "$from_env"; return; fi
  local from_file
  from_file="$(env_value "$name")"
  printf '%s' "${from_file:-$fallback}"
}

DB_NAME="$(cfg POSTGRES_DB macros)"
DB_USER="$(cfg POSTGRES_USER macros)"
DB_PASSWORD="$(cfg DB_PASSWORD)"
DB_SERVICE="$(cfg DB_SERVICE db)"
BACKUP_DIR="$(cfg BACKUP_DIR "$ROOT/backups")"
PASSPHRASE="$(cfg BACKUP_PASSPHRASE)"
DIRECT="$(cfg BACKUP_DB_DIRECT)"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERRO: $*" >&2; exit 1; }

FILE=""
FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --latest) FILE="$(ls -1t "$BACKUP_DIR"/macros-*.sql.gz* 2>/dev/null | head -1 || true)" ;;
    --file) shift; FILE="${1-}" ;;
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) die "opção desconhecida: $1" ;;
  esac
  shift
done

[ -n "$FILE" ] || die "nenhum backup indicado (usa --latest ou --file)"
[ -f "$FILE" ] || die "não existe: $FILE"

# psql/createdb/dropdb, no contentor ou em directo.
pg() {
  local cmd="$1"; shift
  if [ "$DIRECT" = "1" ]; then
    PGPASSWORD="$DB_PASSWORD" "$cmd" -U "$DB_USER" "$@"
  else
    docker compose -f "$ROOT/docker-compose.yml" exec -T \
      -e PGPASSWORD="$DB_PASSWORD" "$DB_SERVICE" "$cmd" -U "$DB_USER" "$@"
  fi
}

# Desfaz cifra e compressão, na ordem inversa do backup.
decode() {
  if [[ "$FILE" == *.enc ]]; then
    [ -n "$PASSPHRASE" ] || die "o backup está cifrado e BACKUP_PASSPHRASE não está definida"
    export PASSPHRASE
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:PASSPHRASE -in "$FILE" | gunzip
  else
    gunzip -c "$FILE"
  fi
}

if [ "$FORCE" = "1" ]; then
  TARGET="$DB_NAME"
  log "ATENÇÃO: isto substitui a base de dados '$TARGET' por '$FILE'."
  read -r -p "Escreve o nome da base de dados para confirmar: " typed
  [ "$typed" = "$TARGET" ] || die "confirmação não bate certo — nada foi alterado."
  log "a restaurar por cima de '$TARGET'…"
  if ! decode | pg psql -v ON_ERROR_STOP=1 -d "$TARGET" >/dev/null; then
    die "o backup não restaurou — ficheiro corrompido/incompleto ou passphrase errada"
  fi
  log "restaurado."
  exit 0
fi

# --- Ensaio -------------------------------------------------------------------
TARGET="${DB_NAME}_restore_check_$$"
log "ensaio de restauro de '$FILE' para a base temporária '$TARGET'…"

drop_target() { pg dropdb --if-exists "$TARGET" >/dev/null 2>&1 || true; }
trap drop_target EXIT

pg createdb "$TARGET"
if ! decode | pg psql -v ON_ERROR_STOP=1 -d "$TARGET" >/dev/null; then
  die "o backup não restaurou — ficheiro corrompido/incompleto ou passphrase errada"
fi

# Conta as linhas por tabela. Não se fixam nomes: se um dia houver tabelas
# novas, aparecem aqui sem ninguém ter de mexer no script.
COUNTS="$(pg psql -At -d "$TARGET" -c "
  SELECT relname || '=' || n_live_tup
  FROM pg_stat_user_tables
  WHERE n_live_tup > 0
  ORDER BY n_live_tup DESC
  LIMIT 12;
")"

TABLES="$(pg psql -At -d "$TARGET" -c "
  SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
")"
USERS="$(pg psql -At -d "$TARGET" -c "SELECT count(*) FROM users;" 2>/dev/null || echo 0)"

log "tabelas restauradas: $(echo "$TABLES" | tr -d '[:space:]')"
log "contas de utilizador: $(echo "$USERS" | tr -d '[:space:]')"
[ -n "$COUNTS" ] && log "linhas por tabela:" && printf '    %s\n' $COUNTS

[ "$(echo "$TABLES" | tr -d '[:space:]')" -ge 20 ] || die "poucas tabelas — o backup parece incompleto"
[ "$(echo "$USERS" | tr -d '[:space:]')" -ge 1 ] || die "nenhum utilizador restaurado — o backup parece vazio"

log "ensaio OK — o backup restaura e tem conteúdo. A base temporária foi apagada."

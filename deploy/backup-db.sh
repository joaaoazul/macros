#!/usr/bin/env bash
#
# Backup da base de dados: pg_dump → gzip → cifra → Backblaze B2.
#
# Pensado para correr no VPS por um timer systemd (ver macros-backup.timer).
# Configuração no .env do projeto — ver docs/BACKUPS.md.
#
#   BACKUP_DIR              onde ficam as cópias locais (por omissão ./backups)
#   BACKUP_KEEP_LOCAL       quantas cópias locais manter (por omissão 7)
#   BACKUP_PASSPHRASE       se definida, cifra o dump antes de sair da máquina
#   BACKUP_REMOTE           destino rclone, ex.: b2:macros-backups/db
#   BACKUP_KEEP_REMOTE_DAYS apaga no remoto o que for mais velho (por omissão 90)
#   BACKUP_DB_DIRECT=1      usa o pg_dump local em vez do contentor (testes)

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

# O .env tem valores com espaços e < > (EMAIL_FROM), por isso não se faz source
# dele — lê-se chave a chave, sem o shell interpretar nada.
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
KEEP_LOCAL="$(cfg BACKUP_KEEP_LOCAL 7)"
KEEP_REMOTE_DAYS="$(cfg BACKUP_KEEP_REMOTE_DAYS 90)"
PASSPHRASE="$(cfg BACKUP_PASSPHRASE)"
REMOTE="$(cfg BACKUP_REMOTE)"
DIRECT="$(cfg BACKUP_DB_DIRECT)"

log() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
die() { log "ERRO: $*" >&2; exit 1; }

# Um backup que deixa de correr sem ninguém dar por isso é a maneira mais comum
# de ficar sem backups. Se houver ntfy configurado, qualquer falha avisa.
NTFY="$(cfg ALERT_NTFY_URL)"
on_error() {
  local line="$1"
  [ -n "$NTFY" ] && curl -fsS -m 10 -H "Title: Macros: backup falhou" \
    -d "O backup da base de dados falhou (linha $line) em $(hostname)." "$NTFY" >/dev/null 2>&1 || true
}
trap 'on_error "$LINENO"' ERR

STAMP="$(date -u '+%Y%m%d-%H%M%SZ')"
NAME="macros-$STAMP.sql.gz"
[ -n "$PASSPHRASE" ] && NAME="$NAME.enc"
DEST="$BACKUP_DIR/$NAME"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Escreve para um ficheiro temporário e só no fim renomeia: um backup
# interrompido nunca fica com nome de backup bom.
TMP="$(mktemp "$BACKUP_DIR/.in-progress.XXXXXX")"
cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

dump() {
  if [ "$DIRECT" = "1" ]; then
    PGPASSWORD="$DB_PASSWORD" pg_dump --no-owner --no-privileges -U "$DB_USER" -d "$DB_NAME"
  else
    docker compose -f "$ROOT/docker-compose.yml" exec -T \
      -e PGPASSWORD="$DB_PASSWORD" "$DB_SERVICE" \
      pg_dump --no-owner --no-privileges -U "$DB_USER" -d "$DB_NAME"
  fi
}

log "a copiar a base de dados '$DB_NAME'…"

# pipefail está ligado: se o pg_dump falhar a meio, o pipe todo falha e o
# ficheiro parcial é apagado pelo trap em vez de ser dado como bom.
if [ -n "$PASSPHRASE" ]; then
  # pela variável de ambiente, não por argumento: senão a passphrase ficava
  # visível a quem corresse `ps` na máquina
  export PASSPHRASE
  dump | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass env:PASSPHRASE > "$TMP"
else
  dump | gzip -9 > "$TMP"
fi

SIZE="$(du -h "$TMP" | cut -f1)"
[ -s "$TMP" ] || die "o dump saiu vazio"

# Verificação imediata: sem cifra dá para testar o gzip aqui mesmo. Com cifra a
# verificação a sério é o restore-db.sh --verify, que decifra e restaura.
if [ -z "$PASSPHRASE" ]; then
  gzip -t "$TMP" || die "o gzip saiu corrompido"
fi

mv "$TMP" "$DEST"
chmod 600 "$DEST"
trap - EXIT
log "cópia local: $DEST ($SIZE)"

if [ -n "$REMOTE" ]; then
  command -v rclone >/dev/null || die "rclone não está instalado (ver docs/BACKUPS.md)"
  log "a enviar para $REMOTE…"
  rclone copyto "$DEST" "$REMOTE/$NAME"
  if [ "$KEEP_REMOTE_DAYS" -gt 0 ] 2>/dev/null; then
    rclone delete --min-age "${KEEP_REMOTE_DAYS}d" "$REMOTE" || log "aviso: não deu para limpar o remoto"
  fi
  log "enviado."
else
  log "aviso: BACKUP_REMOTE não definido — a cópia fica só nesta máquina."
fi

# Limpeza local: mantém as N mais recentes.
if [ "$KEEP_LOCAL" -gt 0 ] 2>/dev/null; then
  mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/macros-*.sql.gz* 2>/dev/null | tail -n "+$((KEEP_LOCAL + 1))")
  if [ "${#OLD[@]}" -gt 0 ]; then
    rm -f "${OLD[@]}"
    log "apagadas ${#OLD[@]} cópias locais antigas."
  fi
fi

log "feito."

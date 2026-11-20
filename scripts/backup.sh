#!/usr/bin/env bash
# Daily backup (RNF-05): dumps the app DB and the Evolution DB (WhatsApp sessions) + uploaded media.
# Cron (host):  30 3 * * * /opt/lovefit-bot/scripts/backup.sh >> /opt/lovefit-bot/backup.log 2>&1
# Off-site copy: set RCLONE_REMOTE (e.g. "gdrive:lovefit-backups") in .env and install rclone on the host.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
BACKUP_DIR="${BACKUP_DIR:-$DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-$(grep -E '^RCLONE_REMOTE=' .env 2>/dev/null | cut -d= -f2- || true)}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DC="docker compose -p lovefit-bot"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
echo "[$(date -Is)] backup start"

$DC exec -T postgres pg_dump -U lovefit -d lovefit -Fc > "$BACKUP_DIR/lovefit-$STAMP.dump"
$DC exec -T postgres pg_dump -U lovefit -d evolution -Fc > "$BACKUP_DIR/evolution-$STAMP.dump"
$DC exec -T app tar -C /app/data -czf - media > "$BACKUP_DIR/media-$STAMP.tar.gz"

for f in "$BACKUP_DIR"/*-"$STAMP".*; do
  [ -s "$f" ] || { echo "ERRO: arquivo vazio $f"; exit 1; }
done
chmod 600 "$BACKUP_DIR"/*-"$STAMP".*

find "$BACKUP_DIR" -type f -mtime +"$KEEP_DAYS" -delete

if [ -n "$RCLONE_REMOTE" ]; then
  rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "*-$STAMP.*"
  echo "copied to $RCLONE_REMOTE"
else
  echo "AVISO: RCLONE_REMOTE não definido — o backup ficou só nesta máquina."
fi
echo "[$(date -Is)] backup ok: $(ls -1 "$BACKUP_DIR"/*-"$STAMP".* | xargs -n1 basename | tr '\n' ' ')"

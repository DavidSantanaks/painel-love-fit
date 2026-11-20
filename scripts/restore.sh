#!/usr/bin/env bash
# Restores a backup made by backup.sh.  Usage: scripts/restore.sh 20261120-033000
# Stops the app and Evolution, restores both databases and media, then starts everything again.
set -euo pipefail

STAMP="${1:?informe o carimbo do backup, ex.: 20261120-033000}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"
BACKUP_DIR="${BACKUP_DIR:-$DIR/backups}"
DC="docker compose -p lovefit-bot"

for f in lovefit-$STAMP.dump evolution-$STAMP.dump media-$STAMP.tar.gz; do
  [ -s "$BACKUP_DIR/$f" ] || { echo "Arquivo não encontrado: $BACKUP_DIR/$f"; exit 1; }
done

read -r -p "Isto SUBSTITUI os dados atuais pelo backup $STAMP. Digite RESTAURAR para continuar: " ok
[ "$ok" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

$DC stop app evolution-api
$DC exec -T postgres pg_restore -U lovefit -d lovefit --clean --if-exists --no-owner < "$BACKUP_DIR/lovefit-$STAMP.dump"
$DC exec -T postgres pg_restore -U lovefit -d evolution --clean --if-exists --no-owner < "$BACKUP_DIR/evolution-$STAMP.dump"
$DC start app
sleep 5
$DC exec -T app sh -c 'rm -rf /app/data/media/* && tar -C /app/data -xzf -' < "$BACKUP_DIR/media-$STAMP.tar.gz"
$DC start evolution-api
echo "Restauração concluída. Confira o painel e o status das instâncias."

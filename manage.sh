#!/usr/bin/env bash
# Atalhos de operação do LOVE FIT Bot v2 (o painel cobre QR Code, instâncias e conversas).
set -euo pipefail
cd "$(dirname "$0")"
DC="docker compose -p lovefit-bot"

check_env() {
  [ -f .env ] || { echo "Falta o .env (cp .env.example .env e preencha)."; exit 1; }
  for v in AUTHENTICATION_API_KEY POSTGRES_PASSWORD WEBHOOK_TOKEN SESSION_SECRET; do
    val="$(grep -E "^$v=" .env | cut -d= -f2-)"
    [ -n "$val" ] || { echo "Preencha $v no .env"; exit 1; }
  done
  if grep -qE '^COMPOSE_PROFILES=.*tunnel' .env && [ -z "$(grep -E '^TUNNEL_TOKEN=' .env | cut -d= -f2-)" ]; then
    echo "COMPOSE_PROFILES=tunnel mas TUNNEL_TOKEN está vazio."; exit 1
  fi
}

case "${1:-help}" in
  up)      check_env; $DC up -d --build; $DC ps ;;
  start)   $DC start ;;
  stop)    $DC stop ;;
  restart) $DC restart app ;;
  status)  $DC ps; echo; docker stats --no-stream $($DC ps -q) ;;
  logs)    $DC logs -f --tail=200 "${2:-app}" ;;
  update)  git pull --ff-only && check_env && $DC up -d --build ;;
  backup)  ./scripts/backup.sh ;;
  admin)   shift; $DC exec app npm run create-admin -- "$@" ;;
  *) echo "uso: ./manage.sh {up|start|stop|restart|status|logs [serviço]|update|backup|admin --email x --name y}" ;;
esac

# Tasks — LOVE FIT Bot v2

## Fase 1 — Motor e testes
- [x] Normalização de texto e telefone E.164 + variante do 9 (`src/engine/normalize.ts`) — testes
- [x] Render de variáveis, saudação, horários (`render.ts`)
- [x] Motor puro: fallback, gatilhos, pausa, reativação, comandos, handoff, fora do expediente (`engine.ts`) — testes
- [x] Validação RF-22 (`validate.ts`) — testes
- [x] Seed com as telas da §9 (`seed-content.ts`)

## Fase 2 — Webhook e envio
- [x] Parser do webhook Evolution v2, grupos/broadcast/reações, @lid (`webhook-parse.ts`) — testes
- [x] Sender único com blacklist, retentativa limitada, eco (`sender.ts`) — testes
- [x] Pipeline: idempotência, eco, blacklist, anti-flood, lock, estado, fila, aviso com cooldown (`pipeline.ts`) — testes
- [x] Implementações Prisma/Redis/Evolution (`deps.ts`, `evolution.ts`), worker FIFO por contato, purge diário

## Fase 3 — Painel
- [x] Login com bcrypt, sessão em banco, limite de tentativas, papéis, CSRF por origem
- [x] Visão geral (métricas RF-28 + alertas)
- [x] Telas: lista, editor com pré-visualização WhatsApp, upload de mídia, auditoria
- [x] Conversas: fila, pausar/reativar, envio manual (bloqueado para blacklist)
- [x] WhatsApp: criar, QR Code, reiniciar, webhook, desconectar, horários
- [x] Blacklist: adicionar, colar lista, remover
- [x] Configurações + números de aviso (recusa blacklist) + teste de aviso
- [x] Simulador, log e auditoria

## Fase 4 — Entrega
- [x] Dockerfile, docker-compose (`lovefit-bot`), `.env.example`, entrypoint com migração e seed
- [x] Scripts: `create-admin`, `import-blacklist`, `create-franchise`, `purge`, `backup.sh`, `restore.sh`, `manage.sh`
- [x] Teste de ponta a ponta em Docker (stack local, Evolution real gerando QR, webhook simulado, backup e restauração)
- [ ] Revisar textos `[EDITAR]` no painel (equipe)
- [ ] Deploy na VPS (manual, guia em PDF)

## Critérios de aceite (§11)
| Critério | Como foi verificado |
|---|---|
| Troca de preço vale no próximo cliente | teste `pipeline` "price changed…" + leitura do banco a cada mensagem |
| Recepção responde → bot mudo 1 h; `menu` reativa | testes `engine` e `pipeline` (RF-03/05) |
| Blacklist nunca recebe nada; painel recusa como aviso | testes `pipeline` (resposta, aviso, manual) + API `/notify` testada |
| Pedido de atendente → fila + WhatsApp da equipe | teste `pipeline` (RF-16) + E2E (fila criada na hora) |
| Painel em `https://painellovefit…` sem porta nova | compose: só `127.0.0.1:3000` + cloudflared (verificar no deploy) |
| 2 mensagens em menos de 5 s → 1 resposta | teste `pipeline` + E2E (worker ordenado por contato) |
| Restart do `app` não reativa pausa | estado no Postgres; teste `pipeline` |
| QR Code pelo painel | E2E: instância criada e QR gerado pela Evolution v2.3.7 |
| `docker compose up -d` em máquina limpa | E2E: migração + seed automáticos |

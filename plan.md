# Plan — LOVE FIT Bot v2

Derivado de `lovefit-spec/spec.md` e `constitution.md`.

## Arquitetura

```
Evolution API ──POST /api/webhooks/evolution?token=…──▶ app (Next.js, Node)
                                                         │ valida token, recusa cf-connecting-ip
                                                         │ parse (webhook-parse.ts) → LPUSH Redis
                                                         ▼
                                worker (instrumentation.ts) — BRPOP FIFO, ordenado por contato
                                filtros: instância → idade → idempotência → eco → @lid → blacklist → anti-flood
                                motor puro (engine.ts) → estado (Postgres) → fila de atendimento
                                sender.ts (ÚNICO ponto de envio, consulta a blacklist) → Evolution sendText/sendMedia
Painel (App Router) ── rotas /api/panel/* (sessão + papel + same-origin) ── Prisma
cloudflared ── https://painellovefit.tavernahub.com.br → http://app:3000
```

## Modelo de dados

Arquivo `prisma/schema.prisma`. Todas as tabelas de negócio têm `franchiseId`.

| Tabela | Uso |
|---|---|
| Franchise | unidade de isolamento; `isTemplate` = LOVE FIT base |
| User / Session | login, papéis, bloqueio por tentativas |
| Instance | número de WhatsApp (nome global na Evolution), unidade, horários (JSON) |
| Node / NodeMessage / Option | telas, mensagens (texto/imagem/PDF), opções com gatilhos e ações |
| Media | arquivos no volume `app_media` |
| Settings | pausa, anti-flood, digitando, reativação, comandos, cooldown de aviso, retenção, fora do expediente |
| BlacklistEntry / NotifyNumber | E.164 normalizado, único por franquia |
| Contact | estado da conversa (status, pausedUntil, tela atual), sem texto |
| HandoffRequest | fila "pediu atendente" |
| MessageLog | metadados (RNF-07) |
| AuditLog | quem editou o quê e quando (RF-24) |

Redis: idempotência (`seen`, 24 h), eco (`echo`, 24 h), anti-flood, lock por contato, fila de entrada, limite de login por IP.

## Contratos

- `POST /api/webhooks/evolution?token=` — Evolution v2, evento `messages.upsert` → `{ ok, queued | ignored }`.
- `GET /api/health`.
- `POST /api/auth/login|logout`.
- `/api/panel/nodes[/:id]` (POST/PUT/DELETE, valida RF-22), `/media[/:id]`, `/settings` (PUT), `/notify[/:id]`, `/notify-test`,
  `/blacklist[/:id]` (admin), `/instances[/:id]` + `/instances/:id/action` {status|qr|restart|webhook|logout} (admin),
  `/contacts/:id` {pause|activate|send}, `/handoffs/:id`, `/simulate`, `/franchise` (platform admin).

## Compose (`lovefit-bot`)

`postgres:15.10-alpine` (bancos `lovefit` + `evolution`), `redis:7.4.2-alpine` (AOF), `evoapicloud/evolution-api:v2.3.7`
(sem porta publicada e sem histórico de mensagens), `app` (porta só em `127.0.0.1`), `cloudflared:2025.11.1` (profile `tunnel`).
Rede `gym-network`, `restart: always`, logs rotacionados.

## Testes

Vitest: normalização, render, motor (pausa, reativação, handoff, fallback, pureza), validação RF-22, parser do webhook,
pipeline com fakes em memória (critérios de aceite da seção 11).

## Backup

`scripts/backup.sh`: `pg_dump -Fc` dos dois bancos + tar da mídia, retenção de 14 dias, cópia opcional com `rclone` (`RCLONE_REMOTE`).
`scripts/restore.sh` testado.

## Conflitos com o spec, e como foram resolvidos

- §5 fala em "sem domínio, túnel SSH", mas §5.1 e a pergunta 5 decidem pelo Cloudflare Tunnel. Fica o **Cloudflare Tunnel**, e a porta `127.0.0.1` permite também o túnel SSH.
- `legacy/` estava vazia: o seed segue o fluxo da §9, e textos sem fonte estão marcados `[EDITAR]`.

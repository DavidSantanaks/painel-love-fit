# CLAUDE.md — LOVE FIT Bot v2

Chatbot de WhatsApp da academia LOVE FIT (várias franquias, hoje Atalaia e Jardim Santana).
Substitui o bot atual (Evolution API + n8n) por um app próprio com painel.

## Fonte da verdade
1. `constitution.md` — princípios inegociáveis.
2. `spec.md` — o que construir (requisitos RF/RNF, decisões, critérios de aceite).
3. `plan.md` e `tasks.md` — a serem gerados a partir do spec (ver `prompt-claude-code.md`).
4. `legacy/` — arquivos do bot antigo, só para extrair textos, preços e fluxo. Não copiar código antigo.

Se algo do pedido conflitar com o spec, pare e pergunte. Não invente requisitos.

## Stack decidida
TypeScript, Next.js (painel + API + webhook num único container), Prisma + PostgreSQL 15, Redis 7, Zod, Vitest.
Evolution API v2.3.7 (versão fixa) como gateway do WhatsApp. Cloudflare Tunnel (`cloudflared`) para publicar o painel.

## Regras
- **Nunca** colocar segredos, IPs, telefones reais ou a API key no código, no seed ou em arquivos versionados. Tudo em `.env` (versionar só `.env.example`).
- Imagens Docker com **versão fixa**, nunca `latest`.
- Projeto Compose isolado (`-p lovefit-bot`), rede própria. A VPS tem outro projeto (`taverna-livekit`, com Caddy e LiveKit): **não mexer nele**, não usar suas portas, não subir outro Caddy.
- Só o painel publica porta, e em `127.0.0.1`. Evolution, Postgres e Redis ficam só na rede interna.
- O motor de conversa é **função pura** (estado + mensagem → respostas + novo estado), com testes antes da UI.
- Todo envio passa por **um único ponto** que consulta a blacklist (RF-13).
- Tudo filtrado por `franchise_id` desde a primeira migração.
- Guardar só metadados das mensagens, nunca o texto dos clientes (RNF-07).
- Textos, preços e horários vêm do banco (painel), nunca fixos no código. O seed pode trazê-los do `legacy/`.
- Visual do painel: consultar https://www.tasteskill.dev/ , https://transitions.dev/ e https://reactbits.dev/ .
- Não fazer deploy, não acessar a VPS e não rodar nada fora do projeto. O deploy é manual, seguindo `deploy-vps.md`.

## Idioma
Código e commits em inglês; textos do painel e mensagens do bot em português do Brasil.

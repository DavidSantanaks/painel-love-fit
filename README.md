# LOVE FIT Bot v2

Chatbot de WhatsApp da LOVE FIT com painel web. Substitui o bot antigo (Evolution API + n8n).

- **Motor de conversa**: função pura (`src/engine/engine.ts`), testada sem WhatsApp.
- **Painel**: telas e menus, conversas e fila de atendimento, WhatsApp (QR Code), blacklist, configurações, simulador, log e auditoria.
- **Stack**: Next.js 15 (painel + API + webhook + worker em um container), Prisma + PostgreSQL 15, Redis 7, Evolution API v2.3.7, Cloudflare Tunnel.

Especificação em `lovefit-spec/` (constitution, spec, deploy). Plano e tarefas em `plan.md` e `tasks.md`.
Próximos passos e ideias: `roadmap.md`.
Configuração do Cloudflare (túnel, DNS, Access): `Cloudflare-LoveFit-Config.pdf`.

## Subir

```bash
cp .env.example .env      # preencha (openssl rand -hex 32 para cada segredo)
chmod 600 .env
./manage.sh up            # = docker compose -p lovefit-bot up -d --build
```

O container `app` aplica as migrações e roda o seed sozinho, na primeira vez, com as telas do bot atual.
Sem túnel (ksserver / teste local): deixe `COMPOSE_PROFILES=` vazio no `.env`.

## Comandos de operação

| O quê | Comando |
|---|---|
| Criar admin (senha gerada e mostrada uma vez) | `docker compose -p lovefit-bot exec app npm run create-admin -- --email voce@exemplo.com --name "Seu Nome"` |
| Criar usuário da recepção | `… create-admin -- --email recepcao@exemplo.com --name "Recepção" --role RECEPTION` |
| Importar blacklist (arquivo fora do repo) | `docker compose -p lovefit-bot exec -T app npm run import-blacklist -- --label "Família" < numeros.txt` |
| Importar telas de um arquivo (substitui todas) | `docker compose -p lovefit-bot exec -T app npm run import-content -- --replace < lovefit-content.private.json` |
| Nova franquia (cópia das telas da LOVE FIT) | `docker compose -p lovefit-bot exec app npm run create-franchise -- --name "LOVE FIT Centro" --slug centro` |
| Backup (bancos + mídia) | `./scripts/backup.sh` (cron diário, ver o guia de deploy) |
| Restaurar | `./scripts/restore.sh AAAAMMDD-HHMMSS` |
| Logs / status | `./manage.sh logs app` · `./manage.sh status` |
| Atualizar | `./manage.sh update` |

Papéis: `PLATFORM_ADMIN` (todas as franquias), `ADMIN` (a própria franquia, inclusive WhatsApp e blacklist), `RECEPTION` (telas, conversas, configurações, simulador).

## Antes do go-live

1. As telas usam os textos exatos do bot antigo (n8n). Só a chave Pix e o favorecido de cada unidade ficam como **[EDITAR]** no repositório: em produção eles vêm do arquivo privado `lovefit-content.private.json` (fora do git) com `import-content`, ou são digitados no painel.
2. Importe a blacklist do n8n **vivo** (6 números, não o JSON antigo da pasta).
3. Cadastre os números de aviso da equipe e use "Enviar teste" em Configurações.
4. Cadastre o horário de cada unidade (Configurações → Horário de funcionamento).
5. Faça um backup e uma restauração de teste.

## Desenvolvimento

```bash
npm install
npm test            # Vitest: motor, normalização, validação, webhook, pipeline (critérios de aceite)
npm run typecheck
```

## Decisões de comportamento (não explícitas no spec)

- **Ordem de busca de gatilhos**: primeiro a tela atual, depois o menu principal, depois as outras telas. Assim, `11`, `21` e `22` funcionam de qualquer lugar, como no bot antigo. Gatilhos de palavra (não numéricos, com 3 ou mais letras) também casam dentro de uma frase ("quero saber os **valores**").
- **Mensagem sem texto** (foto sem legenda, figurinha): o bot não responde, para não mandar o menu para quem envia um comprovante.
- **Mensagens antigas** (mais de 10 min, quando o WhatsApp reconecta): ignoradas.
- **Contato `@lid` sem telefone**: por padrão, o bot não responde (não dá para conferir a blacklist). Pode ser ligado em Configurações.
- **Timeout no envio** não é repetido, porque a mensagem pode ter saído e repetir a duplicaria. Erros de conexão são repetidos até 3 vezes.
- **Envio manual pelo painel** pausa o bot com aquele contato (é uma resposta humana).
- Adicionar à blacklist um número que está nos avisos **remove** esse número dos avisos.

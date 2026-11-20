# Prompt para colar no Claude Code

Abra o Claude Code na pasta do projeto (onde estão CLAUDE.md, constitution.md, spec.md e legacy/) e cole:

---

Leia `CLAUDE.md`, `constitution.md` e `spec.md` por inteiro, e depois os arquivos em `legacy/` só para entender o fluxo e extrair textos e preços.

Siga o fluxo de spec-driven development, em etapas, parando para minha aprovação entre elas:

**Etapa 1 — Plano.** Gere `plan.md` com: arquitetura final, modelo de dados Prisma (tabelas, relações, índices, tudo com `franchise_id`), contratos da API (webhook da Evolution e rotas do painel), estrutura de pastas, `docker-compose.yml` do projeto `lovefit-bot` (postgres, redis, evolution-api, app, cloudflared), `.env.example`, estratégia de testes e estratégia de backup. Liste qualquer dúvida ou conflito com o spec. Pare e espere minha aprovação.

**Etapa 2 — Tarefas.** Gere `tasks.md` com tarefas pequenas, ordenadas e com critério de pronto cada uma: primeiro o motor de conversa e os testes, depois webhook e envio, depois painel. Pare e espere minha aprovação.

**Etapa 3 — Implementação.** Execute as tarefas em ordem, uma fase por vez. A cada fase: rode os testes, mostre o resultado e espere eu mandar seguir. Faça commits pequenos.

**Etapa 4 — Entrega.** Seed com as telas atuais (extraídas de `legacy/`), scripts `create-admin` e `import-blacklist`, script de backup diário do banco, README curto de operação e checagem de todos os critérios de aceite da seção 11 do spec.

Não faça deploy nem acesse nenhum servidor. Não coloque segredos nem telefones no repositório.

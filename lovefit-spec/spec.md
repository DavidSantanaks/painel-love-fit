# Spec — Bot WhatsApp LOVE FIT v2 (rascunho v0.1)

Status: rascunho v0.7 para revisão. Itens marcados com **[?]** são perguntas abertas (seção 10).

## 1. Problema

O bot atual depende de n8n com dois nós de código JavaScript onde ficam textos, preços, regex, blacklist e estado. Para mudar um preço é preciso abrir o n8n e editar código. A API key está duplicada em três lugares, o n8n usa `latest` e o estado fica em memória. É muita peça para uma tarefa simples.

## 2. Objetivo

Trocar `n8n + código` por **um app próprio** com:

- um **motor de conversa** que recebe os webhooks da Evolution API e responde;
- um **painel web** onde a equipe monta menus e mensagens, conecta o WhatsApp e acompanha atendimentos.

Resultado esperado: a recepção edita textos pelo painel e vê a mudança valendo na hora, sem tocar em código.

## 3. Fora de escopo (v1)

- Painel multi-franquia completo (cadastro de franquias, cobrança, onboarding). Na v1 existe **uma** franquia (LOVE FIT), mas o modelo de dados já separa tudo por franquia (seção 6.0).
- Editor visual drag-and-drop de fluxo.
- Integração com sistema de academia (catraca, financeiro, cobrança).
- IA / LLM para respostas livres.
- Áudio, vídeo, enquetes e botões interativos (imagem e PDF **entram** na v1).
- Campanhas e disparos em massa (risco de ban).

## 4. Usuários

| Usuário | O que faz |
|---|---|
| **Admin** (dono / você) | Tudo: usuários, instâncias, blacklist, configurações |
| **Recepção** | Edita menus e mensagens, vê conversas, pausa e reativa o bot |
| **Cliente final** | Conversa pelo WhatsApp, só vê o bot |

## 5. Arquitetura

```
Cliente WhatsApp
      │
      ▼
Evolution API (instâncias atalaia | santana | academia)
      │  webhook POST /api/webhooks/evolution?token=…
      ▼
App (TypeScript)
  ├─ API de webhook   → filtros → motor de conversa → envio
  ├─ API do painel    → CRUD de menus, config, conversas
  └─ Painel web (React)
      │
      ├─ PostgreSQL  (menus, config, contatos, estado, log)
      └─ Redis       (anti-flood, locks, fila de envio)
```

**Hospedagem:** o funcionamento fica **igual ao de hoje no ksserver**: um `docker compose up -d` numa máquina Ubuntu com Docker, sem domínio e sem proxy reverso. O mesmo compose roda no ksserver ou numa VPS (Hostinger), sem mudar nada além do `.env`. Consequências:

- **Sem domínio e sem HTTPS na v1.** O painel é acessado por `http://IP-OU-HOSTNAME:PORTA`. Domínio e HTTPS (Cloudflare Tunnel ou Caddy) ficam como evolução futura, sem mexer no app.
- **Containers:** `postgres`, `redis`, `evolution-api`, `app`. Mesmos nomes de rede e de container do padrão atual (`gym-network`), `restart: always`, versões fixas.
- **Só o painel publica porta** (ex.: 3000). Evolution (8080), Postgres e Redis ficam só na rede interna do Docker; o webhook continua usando o nome do container, como hoje.
- **Acesso ao painel por túnel SSH (decisão).** O app publica a porta do painel **só em `127.0.0.1`** da VPS (ex.: `127.0.0.1:3000`), então nada fica exposto na internet e não há login em HTTP puro. Para configurar, a equipe técnica abre o túnel (`ssh -L 3000:localhost:3000 usuario@IP-DA-VPS`) e acessa `http://localhost:3000` no próprio navegador. O túnel criptografa tudo. No ksserver (rede local/NetBird) o painel pode ficar acessível direto pelo IP.
- **Quem usa o painel precisa de acesso SSH** à VPS (de preferência com chave e usuário sem privilégios de root). Se a recepção precisar entrar sem SSH no futuro, as saídas são NetBird na VPS ou domínio com HTTPS (fora da v1).
- O `deploy.sh` e o `manage.sh` mantêm a ideia atual (subir, parar, status, logs, QR Code), mas boa parte vira tela do painel. Docker já instalado, então o script só valida o `.env`, sobe o compose e cria as instâncias.
- Backup: dump diário do banco do app para uma pasta fora do volume do Docker (e cópia para outro lugar), porque menus e sessão do WhatsApp vivem lá. O `n8n` sai. O Postgres pode ter dois bancos (um da Evolution, um do app).

### 5.1 Ambiente alvo (VPS Hostinger, já em uso)

Dados informados pelo painel da Hostinger:

| Item | Valor |
|---|---|
| Plano | KVM 2 (2 vCPU, 8 GB RAM, 100 GB de disco, 8 TB de banda) |
| SO | Ubuntu 26.04 LTS |
| Região | Brasil, Campinas |
| Acesso | SSH com usuário `root` |
| Backup da Hostinger | semanal |
| Já rodando | projeto Docker `taverna-livekit` (containers `caddy` e `livekit`, ~55 MB de RAM no total) |

Consequências para o spec:

- **Convivência com o Taverna.** A VPS já tem um Caddy no ar (provavelmente com as portas 80 e 443 e o domínio do Taverna). O bot **não sobe outro Caddy** e **não mexe** no projeto `taverna-livekit`. Ele roda como projeto Compose separado (`lovefit-bot`), com rede própria, sem publicar portas que possam colidir com o LiveKit ou com o Caddy. A única porta publicada é a do painel, em `127.0.0.1`.
- **Recursos:** 8 GB e 2 vCPU sobram para Evolution, Postgres, Redis e o app. Estimativa de uso do bot: 1 a 2 GB de RAM, a confirmar com `docker stats` no primeiro deploy.
- **Subdomínio do painel (decisão):** o domínio `tavernahub.com.br` já tem o registro `lk` apontando para a VPS, usado pelo LiveKit do Taverna. O painel do bot usa **outro subdomínio** (definido: `painellovefit.tavernahub.com.br`). Caminho escolhido: **Cloudflare Tunnel** (DNS de `tavernahub.com.br` confirmado no Cloudflare) num container `cloudflared` do projeto `lovefit-bot`, independente do Caddy do Taverna. Com o túnel não se cria registro A com o IP da VPS; o Cloudflare cria um CNAME para o túnel e o painel continua escutando só em `127.0.0.1`/rede interna. Proteção extra recomendada: Cloudflare Access (login por e-mail) na frente do painel, além do login do app. Alternativa descartada: pendurar o subdomínio no Caddy existente (acopla os dois projetos).
- **SSH como `root` é um risco:** o plano inclui criar um usuário comum com chave, desligar login por senha e, se possível, `PermitRootLogin no`. O `root` só entra para a configuração inicial.
- **Backup:** o snapshot semanal da Hostinger não basta (uma semana de menus e conversas perdida). O dump diário do banco do app (RNF-05) é obrigatório, e os dumps devem sair da VPS (outro serviço ou máquina).
- **IP da VPS e credenciais não entram no repositório nem no spec.**

Stack (decisão: a mais rápida de construir e fácil de manter): TypeScript com **Next.js** (painel + API + webhook num único projeto e um único container), **Prisma** + PostgreSQL, Redis para anti-flood e fila, Zod para validação, Vitest para testes do motor. Detalhes no `plan.md`.

## 6. Modelo de conteúdo (o que o painel edita)

### 6.0 Franquias (preparação para o futuro)

Vão existir mais franquias da LOVE FIT. A v1 atende só uma, mas o modelo nasce preparado:

- **Franquia** é a unidade de isolamento. Tudo pertence a uma franquia: instâncias de WhatsApp, telas e opções, configurações, blacklist, contatos, conversas, números de aviso e usuários do painel.
- **Instâncias** (números de WhatsApp) pertencem a uma franquia. Dentro de uma franquia, todas as instâncias usam as mesmas telas (decisão sobre Atalaia e Jardim Santana).
- **Papéis:** Admin da plataforma (você) enxerga todas as franquias; Admin e Recepção da franquia só enxergam a própria.
- Toda consulta e todo envio filtra por franquia. Uma blacklist, um preço ou uma conversa de uma franquia nunca aparece em outra.
- Na v1 o painel não tem tela de cadastro de franquias: a primeira é criada pelo seed, e novas entram por comando ou script até haver tela.
- **Franquia nova (decisão):** todas as franquias são LOVE FIT, então uma franquia nova nasce como **cópia das telas e configurações-modelo da LOVE FIT** (a franquia base), e a equipe dela ajusta o que mudar (preços, Pix, horários). A blacklist, os números de aviso, as instâncias e os usuários começam vazios, nunca copiados.

### 6.1 Tela (Node)

Uma "tela" é uma resposta do bot. Campos:

- `id`, `nome` interno (ex.: `menu-principal`, `planos`, `matricula-atalaia`)
- `mensagens[]`: uma ou mais mensagens enviadas em sequência. Cada uma é **texto**, **imagem** (com legenda opcional) ou **documento/PDF** (com nome do arquivo e legenda). Texto e legendas aceitam variáveis (`{{nome}}`, `{{unidade}}`, `{{saudacao}}`)
- `opcoes[]`: lista de opções que o cliente pode escolher
- `acao_ao_entrar` (opcional): ex. pausar bot, chamar recepção
- **Sem escopo por unidade:** as telas são as mesmas para todas as instâncias (decisão). Conteúdo específico de uma unidade (Pix e cadastro de Atalaia ou de Jardim Santana) continua sendo uma tela própria, escolhida pelo cliente no menu, como hoje. A variável `{{unidade}}` vem do nome da instância que recebeu a mensagem.

### 6.2 Opção

- `gatilhos[]`: o que o cliente digita para escolher (`1`, `planos`, `valores`, `preço`). Comparação em texto normalizado (minúsculas, sem acento).
- `destino`: ir para outra tela
- `acao` (opcional): `ir_para_tela` | `chamar_humano` (pausa + aviso) | `pausar(horas)` | `nenhuma`
- `ordem` e rótulo para exibir na lista numerada

### 6.3 Tela padrão (fallback)

Qualquer texto que não casa com nenhum gatilho cai no **menu principal** com saudação usando o nome do contato (`pushName`).

### 6.4 Configurações globais

- Horário de funcionamento por unidade (usado em respostas e na mensagem de "fora do expediente")
- Tempo de pausa automática (padrão 60 min)
- Janela anti-flood (padrão 5 s)
- Atraso e indicador de "digitando" antes de enviar
- Palavras de reativação (`0`, `menu`, `#menu`, `voltar`)
- Comandos da equipe (`#pausa`, `#parar`, `#silenciar`)
- Números de aviso da equipe (recebem o aviso de atendimento; nunca podem estar na blacklist)

### 6.5 Blacklist

Lista de números com os quais o bot **nunca interage**: não responde e **nunca envia** mensagem (dono, sócios, gerente, fornecedores). Editável no painel.

Cada entrada tem: número, rótulo (ex.: "Dono / Pix Atalaia"), observação e data. Regras de casamento (melhoram a regra atual do n8n):

- **Normalização para E.164 brasileiro** ao salvar: só dígitos, adiciona `55` se faltar. `(11) 97634-1183`, `11976341183` e `5511976341183` viram a mesma entrada.
- **Comparação exata** do número normalizado, em vez de "termina com". A regra atual (`endsWith` nos dois sentidos) pode bloquear número errado se alguém cadastrar poucos dígitos.
- **Variante com e sem o 9 extra** gerada automaticamente (ex.: `5531 9xxxx-xxxx` e `5531 xxxx-xxxx`), para não depender de cadastrar duas vezes.
- **Contatos `@lid`:** quando o webhook trouxer um identificador interno no lugar do telefone, o app tenta resolver o número real (campo alternativo do payload) e, se não conseguir, registra no log "contato sem telefone resolvido" para a equipe cadastrar manualmente.
- **Importação em lote:** colar uma lista de números no painel (usado para migrar os números que hoje estão no n8n).
- Duplicados são recusados com aviso.
- **Sem exceções:** os números da blacklist são da família dona do comércio e **nunca recebem nenhuma mensagem do bot**, nem resposta de conversa, nem aviso de atendimento, nem envio manual do painel. Não existe opção para liberar envio a um número bloqueado.

## 7. Requisitos funcionais

### Motor de conversa

- **RF-01** Processar apenas eventos `messages.upsert`; ignorar grupos (`@g.us`) e broadcast.
- **RF-02** Responder sempre pela instância de origem.
- **RF-03** **Auto-pausa:** mensagem `fromMe=true` (recepção respondeu pelo celular) silencia o bot com aquele contato pelo tempo configurado.
- **RF-04** **Comandos da equipe** (`#pausa`, `#parar`, `#silenciar`) enviados do número da loja pausam o bot para o contato.
- **RF-05** **Reativação:** durante a pausa, o cliente reativa o bot com as palavras configuradas.
- **RF-06** **Anti-flood:** mensagens do mesmo número dentro da janela configurada são descartadas.
- **RF-07** **Blacklist (entrada):** mensagem de número listado é descartada sem resposta, sem pausa e sem criar estado, valendo para todas as instâncias. O descarte é registrado no log de forma resumida (instância, motivo), sem texto da mensagem.
- **RF-13** **Blacklist (saída):** toda mensagem enviada passa por um único ponto de envio que consulta a blacklist antes de chamar a Evolution API. Nenhuma tela, ação, aviso ou disparo manual do painel consegue enviar para número bloqueado, mesmo que alguém peça.
- **RF-08** Normalizar o texto (minúsculas, sem acentos, trim) antes de casar gatilhos.
- **RF-09** Enviar com indicador de "digitando" e atraso antes de cada mensagem; mensagens múltiplas de uma tela saem em sequência com intervalo.
- **RF-10** Ações `chamar_humano` e `pausar` pausam o bot e registram o pedido de atendimento para a recepção ver no painel.
- **RF-11** Idempotência: o mesmo `message.id` nunca é processado duas vezes (Evolution pode reenviar webhooks).
- **RF-12** Falha de envio é registrada e tentada de novo com limite (sem loop infinito).
- **RF-14** **Mídia:** o painel permite enviar imagem (JPG/PNG) e PDF, com limite de tamanho. Os arquivos ficam num volume do app e são enviados à Evolution (`sendMedia`) em base64 pela rede interna, então não precisam de URL pública nem de domínio.
- **RF-15** **Eco das próprias mensagens:** a Evolution devolve por webhook as mensagens que o próprio bot enviou (`fromMe=true`). O app guarda o `message.id` de tudo que envia e ignora esses ecos, para que a auto-pausa (RF-03) dispare só quando um humano responder pelo celular.
- **RF-16** **Aviso de atendimento:** quando um cliente pede atendente (ou cai numa ação de chamar humano), o app (a) coloca o contato na fila do painel e (b) envia uma mensagem de WhatsApp para os **números de aviso da equipe** (cadastrados nas configurações, separados da blacklist), com nome, telefone, unidade e o que o cliente pediu. Os dois canais são sempre usados. O painel **recusa** cadastrar como número de aviso qualquer número que esteja na blacklist. Há limite de um aviso por contato a cada X minutos, para não encher o celular da equipe. Se não houver número de aviso cadastrado, só a fila do painel funciona e o painel mostra um alerta.

### Painel

- **RF-20** Login de usuários com papéis Admin e Recepção.
- **RF-21** Editor de telas e opções por formulário, com **pré-visualização** no estilo de conversa do WhatsApp.
- **RF-22** Validação ao salvar: toda opção aponta para tela existente; gatilho não pode se repetir na mesma tela; existe uma tela de menu principal.
- **RF-23** Alterações valem imediatamente após salvar (sem restart).
- **RF-24** **Auditoria de edições (decisão):** toda alteração de tela, opção, configuração, blacklist e instância registra **quem editou e quando**, com o nome da tela ou item alterado. Não há restauração de versões anteriores na v1.
- **RF-25** **Instâncias:** listar status (conectado / desconectado), mostrar QR Code, reiniciar instância e reconfigurar webhook, tudo pelo painel (substitui `manage.sh` e `qrcode.html`).
- **RF-26** **Conversas:** lista de contatos recentes com estado (bot ativo / pausado / aguardando humano), botão para pausar e reativar o bot manualmente, fila de "pediu atendente".
- **RF-27** **Blacklist** e **horários** editáveis.
- **RF-28** **Métricas básicas:** mensagens recebidas e enviadas por dia e por unidade, opções mais escolhidas, atendimentos humanos pedidos, mensagens que caíram no fallback.
- **RF-29** Simulador: caixa de teste no painel que roda o motor sem enviar nada ao WhatsApp.

## 8. Requisitos não funcionais

- **RNF-01** Segurança: API key da Evolution e token do webhook só em `.env`; webhook rejeita chamadas sem o token; painel atrás de login; senhas com hash forte.
- **RNF-02** Resiliência: `restart: always`; estado em Postgres/Redis; webhook responde 200 rápido e processa em segundo plano.
- **RNF-03** Desempenho: resposta ao cliente em menos de 5 s contando o atraso de "digitando".
- **RNF-04** Observabilidade: log estruturado por mensagem (instância, contato, tela, decisão) e tela de log recente no painel.
- **RNF-05** Backup: dump diário do banco do app, guardado fora da VPS, além do snapshot semanal da Hostinger (insuficiente sozinho). Teste de restauração antes do go-live.
- **RNF-06** Versões fixas das imagens (nada de `latest`).
- **RNF-09** Exposição mínima: o painel escuta só em `127.0.0.1` e é acessado por túnel SSH; painel com limite de tentativas de login; webhook aceita só chamadas com o token e vindas da rede interna; firewall da VPS liberando apenas SSH.
- **RNF-07** Privacidade (decisão): o app guarda **só metadados** (número, instância, horário, tela/opção escolhida, ação tomada, resultado do envio), **nunca o texto** das mensagens dos clientes. O histórico das conversas fica no próprio WhatsApp. Retenção dos metadados configurável (padrão 90 dias).
- **RNF-08** Implantação em um comando (`docker compose up -d`), com seed que cria as telas atuais do bot.

## 9. Migração do que existe hoje

Seed inicial com o conteúdo do bot atual:

| Hoje | Vira |
|---|---|
| `1` / planos / valores / preço | tela `planos` (Love Fiel R$70, Love Dupla R$120, Básico…) |
| `11` `12` `13` | telas de regras de cada plano |
| `2` / matrícula / inscrição | tela `matricula` → `21` atalaia / `22` santana |
| `3` / renovar / já sou aluno | tela com ação `pausar(60)` + aviso para recepção |
| `4` / horário | tela `horarios` (lida das configurações) |
| `5` / atendente / humano | ação `chamar_humano` |
| qualquer outra | tela `menu-principal` com saudação |
| `listaIgnorados` | tabela de blacklist |
| `$getWorkflowStaticData` | Postgres + Redis |

Os números da blacklist entram pelo painel (importação em lote), não pelo seed, para não ficar telefone de ninguém no repositório. **Fonte da verdade hoje:** a lista que está dentro do n8n (6 números, um deles repetido), não o `gym-chatbot-workflow.json` da pasta, que está desatualizado (1 número). Antes de desligar o n8n, exportar o workflow vivo e copiar a lista de lá.

## 10. Perguntas abertas

1. ~~Mídia~~ **Resolvido:** imagem e PDF entram na v1 (RF-14). Áudio e vídeo ficam fora.
2. ~~Histórico de versões~~ **Resolvido:** só auditoria de quem editou e quando (RF-24).
3. ~~Menu por unidade~~ **Resolvido:** mesmas telas para todas as instâncias.
4. ~~Instância `academia`~~ **Resolvido:** não é tratada de forma especial. Instâncias são genéricas e pertencem a uma franquia; o painel cria quantas precisar.
5. ~~Onde roda~~ **Resolvido:** VPS Hostinger, Docker Compose, painel em `painellovefit.tavernahub.com.br` via Cloudflare Tunnel (SSH só para administração).
6. ~~Usuários do painel~~ **Resolvido:** no máximo 2 pessoas, quase sempre 1. Login com e-mail e senha forte, limite de tentativas, mais o Cloudflare Access na frente. Sem 2FA próprio na v1. Os papéis Admin e Recepção continuam no modelo, mas sem tela de gestão de usuários na v1 (criados por script).
7. ~~Retenção~~ **Resolvido:** só metadados (RNF-07).
8. ~~Aviso de atendimento~~ **Resolvido:** painel e WhatsApp (RF-16). Os destinatários são números da equipe, separados da blacklist; a família (blacklist) não recebe nada. Os números de aviso são cadastrados no painel, sem bloquear o spec.

## 11. Critérios de aceite da v1

- Recepção troca o preço do plano no painel e o próximo cliente já recebe o novo valor.
- Recepção responde pelo celular e o bot fica mudo por 1 h com aquele contato; cliente digita `menu` e o bot volta.
- Número da blacklist nunca recebe nenhuma mensagem do bot (resposta, aviso ou envio manual), e o painel recusa cadastrá-lo como número de aviso.
- Cliente pede atendente: o contato aparece na fila do painel e o número de aviso recebe o WhatsApp.
- Painel abre em `https://painellovefit.tavernahub.com.br` sem nenhuma porta nova aberta na VPS.
- Duas mensagens em menos de 5 s do mesmo número geram uma só resposta.
- Reiniciar o container `app` no meio de uma pausa não reativa o bot.
- Desconectar e reconectar o WhatsApp pelo QR Code do painel, sem terminal.
- `docker compose up -d` em máquina limpa deixa tudo funcionando com o menu atual.

## 12. Próximos passos do spec kit

1. Fechar as perguntas que sobraram (6 e 7, e confirmar a stack no plano). Nenhuma bloqueia o plano.
2. `plan.md`: stack definitiva, modelo de dados (tabelas), contratos da API, estrutura de pastas.
3. `tasks.md`: tarefas pequenas e ordenadas (motor primeiro, painel depois).
4. Implementar com testes do motor antes da UI.

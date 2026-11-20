# Roadmap — LOVE FIT Bot v2

Situação em 20/11/2026: v1 implantada na VPS Hostinger (`~/painel-love-fit`, projeto Compose `lovefit-bot`),
painel em `https://painellovefit.tavernahub.com.br` com Cloudflare Tunnel + Access. Login do admin ok.
Ainda **não houve a virada**: o bot antigo (n8n) continua respondendo no ksserver.

Fluxo de trabalho: para cada pacote, primeiro atualizar `lovefit-spec/spec.md` com os novos RF/RNF, depois `plan.md`/`tasks.md`,
e só então implementar, com testes antes da UI (constitution §10).

---

## 0. Pendências da implantação (antes de qualquer feature)

- [ ] Preencher os textos `[EDITAR]` nas telas (preço do Básico, regras dos planos, Pix Atalaia/Santana, link do cadastro)
- [ ] Importar a blacklist do n8n **vivo** (6 números)
- [ ] Cadastrar os números de aviso + "Enviar teste"
- [ ] Criar as instâncias `atalaia` e `santana`, com horários; testar com um chip de teste (checklist do passo 11 do PDF)
- [ ] Cron do backup (`/root/painel-love-fit/scripts/backup.sh`), rclone e **teste de restauração**
- [ ] Virada (passo 12) e manter o stack antigo parado por 7 dias
- [ ] Apagar o CNAME `painellovefit` que sobrou na zona `pelaarteatelie.com.br`
- [ ] Usuário `deploy` + `PermitRootLogin no` (passo 2 do PDF)
- [ ] Repositório privado: deploy key na VPS (seção 4 do PDF)

---

## Pacote 1: Operação segura (recomendado primeiro)

Pequeno, não mexe no motor, evita os problemas mais prováveis.

| # | Item | Descrição | Esforço |
|---|---|---|---|
| 1.1 | Alerta de WhatsApp desconectado | O worker checa `connectionState` a cada 2 min; se uma instância cair, avisa os números de aviso (pela outra instância) e mostra um banner. Avisa uma vez por queda e de novo quando volta. | P |
| 1.2 | Alerta de backup | `backup.sh` grava o status (ok/falha, data, tamanho, rclone ok) num arquivo; o painel mostra o "último backup" e alerta se tiver mais de 26 h ou se falhou. | P |
| 1.3 | Gestão de usuários no painel | Tela só para admin: criar usuário (Recepção/Admin), redefinir senha, desativar. Substitui o `create-admin` no dia a dia. Auditar tudo. | M |
| 1.4 | Lembrete de fila parada | Se um pedido de atendente está aberto há mais de X min (configurável), reenvia o aviso uma vez e destaca o pedido no painel. | P |
| 1.5 | Feriados e horários especiais | Exceções por data e unidade (fechado ou horário diferente), usadas em `{{horarios}}`, `{{expediente}}` e no "fora do expediente". | P |

## Pacote 2: Atendimento

| # | Item | Descrição | Esforço |
|---|---|---|---|
| 2.1 | Respostas rápidas | Mensagens prontas editáveis, usadas no envio manual do painel. | P |
| 2.2 | Mensagem ao concluir atendimento | Texto configurável enviado quando a recepção clica em "Concluir e reativar bot". | P |
| 2.3 | Etiquetas de contato | lead / aluno / renovação, com filtro em Conversas. Só metadado (RNF-07). | P |
| 2.4 | Tempo de resposta | Métrica: tempo entre o pedido de atendente e a primeira resposta humana (`fromMe`). | P |

## Pacote 3: Conteúdo

| # | Item | Descrição | Esforço |
|---|---|---|---|
| 3.1 | Histórico de versões das telas | Snapshot a cada salvamento e botão "restaurar esta versão" (amplia o RF-24). | M |
| 3.2 | Promoções com validade | Mensagem ou tela com data de início e fim, que entra e sai sozinha. | P |
| 3.3 | Áudio e vídeo | Novos tipos de mensagem (`sendWhatsAppAudio` / `sendMedia` vídeo), com limite de tamanho. | P |
| 3.4 | Botões e listas interativas | Avaliar com cuidado: há risco de bloqueio em conta não oficial. Fazer só com teste em chip descartável. | M |

## Pacote 4: Gestão e métricas

| # | Item | Descrição | Esforço |
|---|---|---|---|
| 4.1 | Funil de matrícula | planos → matrícula → unidade, por período e por instância. | P |
| 4.2 | Exportar CSV/Excel | Log de metadados, fila e métricas. | P |
| 4.3 | Painel de saúde | Disco, memória, versão, último backup, status das instâncias e do túnel. | P |

## Pacote 5: Expansão

| # | Item | Descrição | Esforço |
|---|---|---|---|
| 5.1 | Tela de franquias | Cadastro pelo painel (hoje é `create-franchise`), clonando a LOVE FIT. | M |
| 5.2 | Integração com o sistema da academia | Vencimento, confirmação de Pix, catraca. Depende de o sistema ter API. | G |
| 5.3 | Respostas com IA | Só para perguntas fora do menu e limitadas ao conteúdo das telas, com fallback para o menu. Exige revisar a constitution (hoje está fora de escopo). | G |

## Pacote 6: Segurança e infra

| # | Item | Descrição | Esforço |
|---|---|---|---|
| 6.1 | 2FA (TOTP) no login do painel | Além do Cloudflare Access. | M |
| 6.2 | Deploy sem queda | Gerar a imagem antes (`docker compose build`) e só depois trocar o container; healthcheck antes de liberar. | P |
| 6.3 | CI no GitHub | Testes + typecheck a cada push (GitHub Actions). | P |

Esforço: P = até meio dia · M = 1 a 2 dias · G = depende de terceiros ou de decisão de produto.

---

## Dívidas técnicas conhecidas

- A fila de entrada usa `BRPOP`: se o app reiniciar no meio do processamento, aquela mensagem se perde. Trocar por `BLMOVE` + lista de processamento.
- O motor recarrega o conteúdo do banco a cada mensagem. Funciona bem no volume atual; se crescer, usar cache com invalidação ao salvar.
- Não há testes de UI/E2E automatizados (só o pipeline com fakes). Avaliar Playwright para os fluxos principais do painel.
- O echo é detectado por id + marcador "enviando"; monitorar no log se aparece alguma "pausa falsa" depois de mensagens do bot.

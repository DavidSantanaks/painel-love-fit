# Passo a passo: colocar o bot na VPS Hostinger

Faça só depois que o Claude Code terminar a implementação e os testes passarem.
Regra de ouro: **não mexa no projeto `taverna-livekit`** (Caddy e LiveKit). O bot roda em um projeto separado.

## 0. Antes de começar (no seu computador)
- Código no GitHub, repositório **privado**.
- Teste com o bot antigo ainda ligado no ksserver. Só troque no passo 10.
- Exporte o workflow vivo do n8n e anote a lista de blacklist (6 números) em um arquivo seu, fora do repositório.

## 1. Entrar na VPS
```bash
ssh root@IP-DA-VPS
```
(O IP está no painel da Hostinger.)

## 2. Criar um usuário comum (não usar root no dia a dia)
```bash
adduser deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```
Em **outro terminal**, teste `ssh deploy@IP-DA-VPS` e `docker ps`. Só depois de funcionar, você pode desligar login por senha e root em `/etc/ssh/sshd_config` (`PasswordAuthentication no`, `PermitRootLogin no`) e rodar `systemctl restart ssh`. Não feche o terminal antigo até confirmar.

Não ative o `ufw` sem checar: o Taverna usa portas do LiveKit. Use o firewall do painel da Hostinger se quiser.

## 3. Ver o que já está rodando
```bash
docker ps
ss -tulpn | grep -E ':(80|443|3000|8080)\b'
```
Anote as portas em uso. O bot só publica a porta do painel em `127.0.0.1`, mas confira se a porta escolhida (3000) está livre.

## 4. Baixar o projeto
```bash
sudo mkdir -p /opt/lovefit-bot && sudo chown deploy:deploy /opt/lovefit-bot
cd /opt/lovefit-bot
git clone https://github.com/SEU-USUARIO/SEU-REPO.git .
```
Repositório privado: use um deploy key (somente leitura) ou um token pessoal.

## 5. Criar o `.env` com segredos novos
```bash
cp .env.example .env
nano .env
```
Gere cada segredo com:
```bash
openssl rand -hex 32
```
Preencha pelo menos: `AUTHENTICATION_API_KEY` (nova, não reaproveite a antiga), `POSTGRES_PASSWORD`, `WEBHOOK_TOKEN`, `SESSION_SECRET`, `TIMEZONE=America/Sao_Paulo`. O `TUNNEL_TOKEN` vem no próximo passo. Depois: `chmod 600 .env`.

## 6. Criar o túnel no Cloudflare
1. Cloudflare → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → tipo **Cloudflared**.
2. Nome: `lovefit-bot`. Copie o **token** e cole em `TUNNEL_TOKEN` no `.env`.
3. Aba **Public Hostname** → **Add**:
   - Subdomain: `painellovefit`
   - Domain: `tavernahub.com.br`
   - Service: tipo `HTTP`, URL `app:3000`
4. Salve. O Cloudflare cria o CNAME sozinho. **Não crie registro DNS à mão** e confirme que não existe um `painellovefit` antigo no DNS.

## 7. Subir os containers
```bash
cd /opt/lovefit-bot
docker compose -p lovefit-bot up -d --build
docker compose -p lovefit-bot ps
docker compose -p lovefit-bot logs -f app
```
Todos devem estar `Up`. Confira que o Taverna continua normal (`docker ps`).

## 8. Criar o admin e abrir o painel
```bash
docker compose -p lovefit-bot exec app npm run create-admin
```
(O nome exato do comando vem do README do projeto.) Abra `https://painellovefit.tavernahub.com.br` e entre.

## 9. Proteger com Cloudflare Access (recomendado)
Zero Trust → **Access** → **Applications** → **Add** → **Self-hosted**:
- Hostname: `painellovefit.tavernahub.com.br`
- Policy: **Allow** → Emails: o seu e-mail (e o de quem mais usa).

Depois disso, o Cloudflare pede um código por e-mail antes de mostrar a tela de login do painel.

## 10. Conectar o WhatsApp e testar
1. No painel, importe a blacklist (colar os números).
2. Cadastre os números de aviso da equipe (nenhum deles pode estar na blacklist).
3. Crie as instâncias (`atalaia`, `santana`) e escaneie o QR Code.
4. **Teste primeiro com um número de teste**, enviando mensagem para o número novo. Verifique: menu, planos, imagem/PDF, "atendente" (fila no painel + WhatsApp para a equipe), pausa ao responder pelo celular, `menu` para reativar, anti-flood, número da blacklist em silêncio.

## 11. Virada (troca do bot antigo pelo novo)
Faça em horário de pouco movimento.
1. No ksserver, pare o bot antigo: `./manage.sh stop` (não apague nada).
2. Na VPS, conecte os números reais pelo QR Code do painel.
3. Teste de ponta a ponta com um celular seu.
4. Mantenha o stack antigo parado, **sem apagar**, por uns 7 dias como plano de volta.

Nunca deixe os dois bots ligados no mesmo número: o cliente receberia resposta dobrada.

## 12. Backup diário
Com o script de backup do projeto, crie o agendamento:
```bash
crontab -e
```
```
30 3 * * * /opt/lovefit-bot/scripts/backup.sh >> /opt/lovefit-bot/backup.log 2>&1
```
Guarde os dumps **fora da VPS** também (rclone para um Drive, por exemplo). Teste uma restauração uma vez antes de confiar.

## 13. Atualizar depois
```bash
cd /opt/lovefit-bot
git pull
docker compose -p lovefit-bot up -d --build
```

## Se algo der errado
| Sintoma | Onde olhar |
|---|---|
| Painel não abre | `docker compose -p lovefit-bot logs cloudflared`; confira o Public Hostname e o `TUNNEL_TOKEN` |
| Bot não responde | `logs app` e `logs evolution-api`; instância conectada? webhook configurado? |
| WhatsApp desconectou | painel → Instâncias → QR Code |
| Voltar ao bot antigo | `docker compose -p lovefit-bot stop` e `./manage.sh start` no ksserver |

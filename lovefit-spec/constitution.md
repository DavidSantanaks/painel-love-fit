# Constitution — Bot WhatsApp LOVE FIT v2

Princípios que valem para qualquer decisão de spec, plano ou código.

1. **Sem n8n.** A lógica do bot vive no app próprio. A Evolution API é só o gateway do WhatsApp.
2. **O painel é a fonte da verdade dos textos.** Nenhuma mensagem, preço ou horário fica fixo no código. Quem edita é a recepção, pelo painel, sem deploy.
3. **Segredos só em variáveis de ambiente.** Nada de API key no código, no workflow ou em scripts. Trocar a chave = mudar um único `.env`.
4. **Estado em banco, não em memória.** Pausas, sessões e anti-flood sobrevivem a restart (Postgres + Redis).
5. **Responde sempre pelo número que recebeu.** Cada instância (`atalaia`, `santana`, `academia`) responde por si.
6. **Humano sempre manda mais que o bot.** Se a recepção responde pelo celular, o bot se cala. O cliente pode reativar com `0`, `menu`, `#menu` ou `voltar`.
7. **Anti-ban primeiro.** Sem rajadas, com indicador de "digitando" e atraso antes de enviar.
8. **Simples de operar.** Um `docker compose up` sobe tudo. Um único repo, um único app além da Evolution.
9. **Pouca infra.** Reaproveitar o Postgres e o Redis que já existem em vez de adicionar serviços.
10. **Testável.** O motor de conversa é uma função pura (estado + mensagem → respostas + novo estado), testável sem WhatsApp.

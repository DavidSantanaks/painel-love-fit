/**
 * Novidades do painel, da mais recente para a mais antiga.
 * A cada entrega, acrescente uma entrada NO TOPO (data em AAAA-MM-DD).
 */
export interface Release {
  date: string;
  title: string;
  items: { tag: "novo" | "melhoria" | "correção"; text: string }[];
}

export const CHANGELOG: Release[] = [
  {
    date: "2026-11-21",
    title: "Feriados e janelas de modal",
    items: [
      { tag: "novo", text: "Feriados e datas especiais por unidade (Configurações → Horário de funcionamento): a unidade fica fechada ou com horário diferente, e quem pedir atendente recebe a mensagem da data." },
      { tag: "novo", text: "Variável {{aviso}} para usar nas telas: mostra o aviso do feriado do dia (vazia nos outros dias)." },
      { tag: "novo", text: "Menu Novidades, para acompanhar o que saiu." },
      { tag: "correção", text: "Janelas (modais) que não fechavam: agora rolam, têm o botão “Fechar” sempre visível e fecham com Esc." },
    ],
  },
  {
    date: "2026-11-20",
    title: "Textos do bot antigo e horários por unidade",
    items: [
      { tag: "melhoria", text: "Textos idênticos aos do bot antigo (n8n) e script de importação do conteúdo." },
      { tag: "melhoria", text: "{{nome}} usa o nome completo do WhatsApp; tela de horários separada por unidade." },
      { tag: "correção", text: "Login: só tentativas que falharam contam no limite por IP." },
    ],
  },
  {
    date: "2026-11-19",
    title: "Primeira versão do painel",
    items: [
      { tag: "novo", text: "Conversas, telas e menus com pré-visualização, simulador, blacklist, números de WhatsApp com QR Code, configurações, log e auditoria." },
    ],
  },
];

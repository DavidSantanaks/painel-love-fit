/**
 * Initial screens (spec §9). Prices and texts follow the current bot as described in the spec.
 * Everything here is editable in the panel — review before go-live (items marked "[EDITAR]").
 * No phone numbers, Pix keys or secrets belong in this file.
 */
import type { NodeAction, OptionAction } from "./types";

export interface SeedOption {
  label: string;
  triggers: string[];
  action: OptionAction;
  target: string | null;
  pauseMinutes?: number;
}

export interface SeedNode {
  key: string;
  title: string;
  isMain?: boolean;
  showOptions?: boolean;
  onEnterAction?: NodeAction;
  pauseMinutes?: number;
  messages: string[];
  options: SeedOption[];
}

const back: SeedOption = { label: "Voltar ao menu", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" };

export const SEED_NODES: SeedNode[] = [
  {
    key: "menu-principal",
    title: "Menu principal",
    isMain: true,
    messages: [
      "{{saudacao}}, {{nome}}! 💪 Bem-vindo(a) à *LOVE FIT {{unidade}}*.\nComo posso te ajudar? Digite o número da opção:",
    ],
    options: [
      { label: "Planos e valores", triggers: ["1", "planos", "plano", "valores", "valor", "preco", "precos"], action: "GO_TO", target: "planos" },
      { label: "Fazer matrícula", triggers: ["2", "matricula", "inscricao", "matricular"], action: "GO_TO", target: "matricula" },
      { label: "Renovar / já sou aluno", triggers: ["3", "renovar", "renovacao", "ja sou aluno"], action: "GO_TO", target: "renovar" },
      { label: "Horário de funcionamento", triggers: ["4", "horario", "horarios"], action: "GO_TO", target: "horarios" },
      { label: "Falar com atendente", triggers: ["5", "atendente", "humano", "atendimento"], action: "CALL_HUMAN", target: "atendente" },
    ],
  },
  {
    key: "planos",
    title: "Planos",
    messages: [
      "📋 *Nossos planos*\n\n❤️ *Love Fiel* — R$ 70,00/mês\n👫 *Love Dupla* — R$ 120,00/mês (duas pessoas)\n🏋️ *Básico* — R$ [EDITAR],00/mês\n\nPara ver as regras de cada plano, digite:",
    ],
    options: [
      { label: "Regras do Love Fiel", triggers: ["11"], action: "GO_TO", target: "regras-love-fiel" },
      { label: "Regras do Love Dupla", triggers: ["12"], action: "GO_TO", target: "regras-love-dupla" },
      { label: "Regras do Básico", triggers: ["13"], action: "GO_TO", target: "regras-basico" },
      { label: "Fazer matrícula", triggers: ["2"], action: "GO_TO", target: "matricula" },
      back,
    ],
  },
  {
    key: "regras-love-fiel",
    title: "Regras — Love Fiel",
    messages: ["❤️ *Love Fiel — regras*\n\n[EDITAR] Descreva aqui as regras do plano (fidelidade, forma de pagamento, acesso)."],
    options: [{ label: "Ver planos", triggers: ["1"], action: "GO_TO", target: "planos" }, back],
  },
  {
    key: "regras-love-dupla",
    title: "Regras — Love Dupla",
    messages: ["👫 *Love Dupla — regras*\n\n[EDITAR] Descreva aqui as regras do plano para duas pessoas."],
    options: [{ label: "Ver planos", triggers: ["1"], action: "GO_TO", target: "planos" }, back],
  },
  {
    key: "regras-basico",
    title: "Regras — Básico",
    messages: ["🏋️ *Básico — regras*\n\n[EDITAR] Descreva aqui as regras do plano Básico."],
    options: [{ label: "Ver planos", triggers: ["1"], action: "GO_TO", target: "planos" }, back],
  },
  {
    key: "matricula",
    title: "Matrícula",
    messages: ["📝 *Matrícula*\n\nEm qual unidade você quer treinar?"],
    options: [
      { label: "Unidade Atalaia", triggers: ["21", "atalaia"], action: "GO_TO", target: "matricula-atalaia" },
      { label: "Unidade Jardim Santana", triggers: ["22", "santana", "jardim santana"], action: "GO_TO", target: "matricula-santana" },
      back,
    ],
  },
  {
    key: "matricula-atalaia",
    title: "Matrícula — Atalaia",
    messages: [
      "✅ *Matrícula — Unidade Atalaia*\n\n1. Faça o Pix do plano escolhido para a chave: [EDITAR chave Pix Atalaia]\n2. Envie o comprovante aqui nesta conversa\n3. Preencha o cadastro: [EDITAR link do cadastro]\n\nAssim que confirmarmos, sua matrícula fica ativa. 💪",
    ],
    options: [back],
  },
  {
    key: "matricula-santana",
    title: "Matrícula — Jardim Santana",
    messages: [
      "✅ *Matrícula — Unidade Jardim Santana*\n\n1. Faça o Pix do plano escolhido para a chave: [EDITAR chave Pix Jardim Santana]\n2. Envie o comprovante aqui nesta conversa\n3. Preencha o cadastro: [EDITAR link do cadastro]\n\nAssim que confirmarmos, sua matrícula fica ativa. 💪",
    ],
    options: [back],
  },
  {
    key: "renovar",
    title: "Renovação",
    showOptions: false,
    onEnterAction: "PAUSE",
    pauseMinutes: 60,
    messages: [
      "🔄 *Renovação*\n\nCerto! Já avisei a recepção e em breve alguém da equipe vai te atender por aqui.\nSe quiser voltar ao menu, digite *menu*.",
    ],
    options: [],
  },
  {
    key: "horarios",
    title: "Horários",
    messages: ["🕒 *Horário de funcionamento — {{unidade}}*\n\n{{horarios}}"],
    options: [back],
  },
  {
    key: "atendente",
    title: "Atendente",
    showOptions: false,
    messages: [
      "🙋 Certo, {{nome}}! Já chamei a recepção e alguém da equipe vai te responder por aqui em instantes.\nSe quiser voltar ao menu, digite *menu*.",
    ],
    options: [],
  },
];

export const SEED_SETTINGS = {
  pauseMinutes: 60,
  floodWindowSeconds: 5,
  typingDelayMs: 1500,
  betweenMessagesMs: 800,
  reactivationWords: ["0", "menu", "#menu", "voltar"],
  staffCommands: ["#pausa", "#parar", "#silenciar"],
  notifyCooldownMinutes: 30,
  retentionDays: 90,
  outOfHoursMessage:
    "⏰ Estamos fora do horário de atendimento agora. Sua mensagem fica registrada e a equipe responde assim que abrir.\n\n{{horarios}}",
};

/**
 * Initial screens (spec §9): exact texts of the old n8n bot ("Processador Lógico LOVE FIT").
 * The texts list their own options, so showOptions is false everywhere.
 * Pix keys and payees are real data and stay OUT of the repo: they are "[EDITAR …]" here and come
 * from a private content file (npm run import-content) or are typed in the panel.
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

export const SEED_NODES: SeedNode[] = [
  {
    key: "menu-principal",
    title: "Menu principal",
    isMain: true,
    showOptions: false,
    messages: [
      "Olá, *{{nome}}*! Somos da *LOVE FIT (academia de musculação)*, tudo bem? 💪❤️\n\nAgradecemos seu contato. No que podemos te ajudar hoje?\n\n*1* - 📋 Conhecer Nossos Planos e Regras\n*2* - ✍️ Fazer Matrícula / Inscrição (via PIX)\n*3* - 🔄 Já sou Aluno (Renovação de Plano)\n*4* - 🕔 Horários de Funcionamento\n*5* - 🧑‍💼 Falar com Atendente\n\n_Digite apenas o número da opção desejada (ex: 1)_",
    ],
    options: [
      { label: "Planos e valores", triggers: ["1", "plano", "planos", "valor", "valores", "preco", "precos"], action: "GO_TO", target: "planos" },
      { label: "Fazer matrícula / inscrição", triggers: ["2", "matricula", "inscricao", "cadastrar", "cadastro", "inscrever", "quero me matricular"], action: "GO_TO", target: "matricula" },
      { label: "Já sou aluno (renovação)", triggers: ["3", "renovacao", "renovar", "ja sou aluno"], action: "GO_TO", target: "renovar" },
      { label: "Horários de funcionamento", triggers: ["4", "horario", "horarios", "funcionamento", "aberto", "fechado"], action: "GO_TO", target: "horarios" },
      { label: "Falar com atendente", triggers: ["5", "atendente", "humano", "recepcao", "suporte", "falar", "duvida"], action: "CALL_HUMAN", target: "atendente" },
    ],
  },
  {
    key: "planos",
    title: "Planos e valores",
    showOptions: false,
    messages: [
      "💪❤️ *PLANOS & VALORES - ACADEMIA LOVE FIT*\n\nConheça nossas opções:\n\n⭐ *1. Plano Love Fiel*\n• Mensalidade: *R$ 70,00*\n• Matrícula: R$ 10,00 no 1º mês\n• Vencimento fixo com super desconto!\n\n👥 *2. Plano Love (Dupla / Casal)*\n• Mensalidade: *R$ 120,00* para 2 pessoas (apenas *R$ 60,00* por pessoa!)\n• Matrícula: R$ 20,00 no 1º mês (R$ 10 por pessoa)\n• Treine junto com seu amor, amigo(a) ou familiar!\n\n🏋️ *3. Plano Básico*\n• Mensalidade: *R$ 90,00*\n• Matrícula: R$ 10,00 no 1º mês\n• Total liberdade para alterar datas e sem fidelidade!\n\n💰💳 *Formas de Pagamento:*\n• Presencialmente na academia: Crédito, Débito, Dinheiro ou PIX.\n• Pelo WhatsApp: *Apenas via PIX*.\n\n──────────────────────\n📌 *O que você deseja fazer agora?*\n\n👉 Digite *11* para ver as Regras do Love Fiel\n👉 Digite *12* para ver as Regras do Plano Love (Dupla)\n👉 Digite *13* para ver as Regras do Plano Básico\n👉 Digite *2* para se inscrever online pelo WhatsApp\n👉 Digite *0* para Voltar ao Menu Principal",
    ],
    options: [
      { label: "Regras do Love Fiel", triggers: ["11", "regras fiel", "regra fiel", "fiel"], action: "GO_TO", target: "regras-love-fiel" },
      { label: "Regras do Plano Love (Dupla)", triggers: ["12", "regras love", "regra love", "dupla", "casal"], action: "GO_TO", target: "regras-love-dupla" },
      { label: "Regras do Plano Básico", triggers: ["13", "regras basico", "regra basico", "basico"], action: "GO_TO", target: "regras-basico" },
      { label: "Fazer inscrição (PIX)", triggers: ["2", "matricula", "inscricao", "cadastrar", "cadastro", "inscrever", "quero me matricular"], action: "GO_TO", target: "matricula" },
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "regras-love-fiel",
    title: "Regras — Love Fiel",
    showOptions: false,
    messages: [
      "📜 *REGRAS DO PLANO LOVE FIEL* (R$ 70,00)\n\n*1. VALOR DO PLANO:*\nO Plano Love Fiel tem o valor de R$ 70,00 mensais.\n\n*2. DATA DE VENCIMENTO:*\nA data de vencimento será definida no dia da inscrição e permanecerá fixa.\n\n*3. IMPOSSIBILIDADE DE ALTERAÇÃO:*\nNão será permitido alterar a data de vencimento deste plano.\n\n*4. ALTERAÇÃO MEDIANTE REMATRÍCULA:*\nCaso seja necessário alterar a data de vencimento, será cobrado o valor de uma rematrícula de R$ 40,00.\n_Essas regras garantem a organização e o compromisso com o plano escolhido._\n\n*5. REATIVAÇÃO DO PLANO:*\nPara reativar o plano após 3 meses de inatividade, uma nova taxa de matrícula de R$ 10,00 será cobrada.\n• O plano possui taxa de matrícula de R$ 10,00 no primeiro mês.\n\n──────────────────────\n📌 *O que deseja fazer agora?*\n\n👉 Digite *2* para Fazer Inscrição no Love Fiel (PIX)\n👉 Digite *1* para Voltar ao Resumo dos Planos\n👉 Digite *12* para ver as Regras do Plano Love (Dupla)\n👉 Digite *13* para ver as Regras do Plano Básico\n👉 Digite *0* para Voltar ao Menu Principal",
    ],
    options: [
      { label: "Inscrição no Love Fiel (PIX)", triggers: ["2", "matricula", "inscricao", "cadastrar", "cadastro", "inscrever", "quero me matricular"], action: "GO_TO", target: "matricula" },
      { label: "Voltar ao resumo dos planos", triggers: ["1", "plano", "planos", "valor", "valores", "preco", "precos"], action: "GO_TO", target: "planos" },
      { label: "Regras do Plano Love (Dupla)", triggers: ["12", "regras love", "regra love", "dupla", "casal"], action: "GO_TO", target: "regras-love-dupla" },
      { label: "Regras do Plano Básico", triggers: ["13", "regras basico", "regra basico", "basico"], action: "GO_TO", target: "regras-basico" },
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "regras-love-dupla",
    title: "Regras — Plano Love (Dupla)",
    showOptions: false,
    messages: [
      "📜 *REGRAS DO PLANO LOVE (DUPLA)* (R$ 120,00)\n\n*1. PAGAMENTO DO PLANO:*\nO valor é de R$ 120,00 por dupla. O pagamento deve ser realizado integralmente, sem possibilidade de parcelamento ou pagamentos separados.\n\n*2. REMATRÍCULA PARA ALUNOS JÁ MATRICULADOS:*\nAlunos já matriculados que desejarem formar uma dupla para aderir ao Plano Love deverão realizar uma rematrícula no valor de R$ 40,00 por pessoa.\n\n*3. ISENÇÃO DE REMATRÍCULA PARA NOVOS ALUNOS:*\nCaso um aluno já matriculado traga alguém que ainda não é aluno, a rematrícula será ISENTA se o ingresso da nova pessoa ocorrer no dia do pagamento do aluno já matriculado. Caso ocorra em data diferente do vencimento, será necessário pagamento de rematrícula de R$ 40,00.\n\n*4. TROCA DE DUPLAS:*\nNão será permitido realizar trocas de duplas fora da data de vencimento. Em data diferente, será cobrada rematrícula de R$ 40,00.\n\n*5. VENCIMENTO FIXO:*\nNão será permitido alterar a data de vencimento (caso necessário, taxa de rematrícula de R$ 40,00).\n\n*6. INATIVIDADE DO PLANO:*\nApós 3 meses consecutivos sem frequência, taxa de R$ 20,00 na reativação.\n• Taxa de matrícula inicial: R$ 20,00 (R$ 10 por pessoa).\n\n──────────────────────\n📌 *O que deseja fazer agora?*\n\n👉 Digite *2* para Fazer Inscrição da Dupla (PIX)\n👉 Digite *1* para Voltar ao Resumo dos Planos\n👉 Digite *11* para ver as Regras do Love Fiel\n👉 Digite *13* para ver as Regras do Plano Básico\n👉 Digite *0* para Voltar ao Menu Principal",
    ],
    options: [
      { label: "Inscrição da Dupla (PIX)", triggers: ["2", "matricula", "inscricao", "cadastrar", "cadastro", "inscrever", "quero me matricular"], action: "GO_TO", target: "matricula" },
      { label: "Voltar ao resumo dos planos", triggers: ["1", "plano", "planos", "valor", "valores", "preco", "precos"], action: "GO_TO", target: "planos" },
      { label: "Regras do Love Fiel", triggers: ["11", "regras fiel", "regra fiel", "fiel"], action: "GO_TO", target: "regras-love-fiel" },
      { label: "Regras do Plano Básico", triggers: ["13", "regras basico", "regra basico", "basico"], action: "GO_TO", target: "regras-basico" },
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "regras-basico",
    title: "Regras — Plano Básico",
    showOptions: false,
    messages: [
      "📜 *REGRAS DO PLANO BÁSICO* (R$ 90,00)\n\n*1. VALOR DO PLANO:*\nO Plano Básico tem o valor de R$ 90,00 mensais.\n\n*2. ALTERAÇÃO DE DATA LIVRE:*\nVocê poderá alterar a data de vencimento sempre que desejar, sem restrições!\n\n*3. SEM VÍNCULO FIXO:*\nEste plano não exige vínculo fixo, proporcionando flexibilidade total no seu compromisso. Ideal para quem busca liberdade e praticidade em sua adesão!\n\n*4. REATIVAÇÃO DO PLANO:*\nPara reativar o plano após 3 meses de inatividade, será cobrada uma taxa de matrícula de R$ 10,00.\n• O plano possui taxa de matrícula de R$ 10,00 no primeiro mês.\n\n──────────────────────\n📌 *O que deseja fazer agora?*\n\n👉 Digite *2* para Fazer Inscrição no Plano Básico (PIX)\n👉 Digite *1* para Voltar ao Resumo dos Planos\n👉 Digite *11* para ver as Regras do Love Fiel\n👉 Digite *12* para ver as Regras do Plano Love (Dupla)\n👉 Digite *0* para Voltar ao Menu Principal",
    ],
    options: [
      { label: "Inscrição no Plano Básico (PIX)", triggers: ["2", "matricula", "inscricao", "cadastrar", "cadastro", "inscrever", "quero me matricular"], action: "GO_TO", target: "matricula" },
      { label: "Voltar ao resumo dos planos", triggers: ["1", "plano", "planos", "valor", "valores", "preco", "precos"], action: "GO_TO", target: "planos" },
      { label: "Regras do Love Fiel", triggers: ["11", "regras fiel", "regra fiel", "fiel"], action: "GO_TO", target: "regras-love-fiel" },
      { label: "Regras do Plano Love (Dupla)", triggers: ["12", "regras love", "regra love", "dupla", "casal"], action: "GO_TO", target: "regras-love-dupla" },
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "matricula",
    title: "Matrícula — escolha da unidade",
    showOptions: false,
    messages: [
      "✍️ *INSCRIÇÃO ONLINE - ACADEMIA LOVE FIT* ❤️\n\nVocê pode realizar seu cadastro e pagamento de forma rápida e 100% online aqui pelo WhatsApp!\n\n⚠️ *Informação importante:*\n• O pagamento pelo WhatsApp é aceito *exclusivamente via PIX*.\n• Caso prefira pagar no Cartão (Crédito/Débito) ou Dinheiro, a matrícula deve ser feita presencialmente na academia.\n\n📍 *Em qual unidade você deseja treinar?*\n\n👉 Digite *21* para Unidade *Atalaia*\n👉 Digite *22* para Unidade *Jardim Santana*\n👉 Digite *0* para Voltar ao Menu Principal\n\n_Responda com 21 ou 22 para receber a chave Pix e os dados necessários!_",
    ],
    options: [
      { label: "Unidade Atalaia", triggers: ["21", "atalaia"], action: "GO_TO", target: "matricula-atalaia" },
      { label: "Unidade Jardim Santana", triggers: ["22", "santana", "jardim santana"], action: "GO_TO", target: "matricula-santana" },
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "matricula-atalaia",
    title: "Matrícula — Atalaia (Pix e cadastro)",
    showOptions: false,
    messages: [
      "📍 *UNIDADE ATALAIA - DADOS DE MATRÍCULA*\n\n🔑 *CHAVE PIX (Celular):*\n[EDITAR chave Pix Atalaia]\n👤 *Favorecido:* [EDITAR favorecido Atalaia]\n🏦 *Unidade:* Atalaia\n\n💵 *Valores no 1º mês (Mensalidade + Matrícula):*\n• Plano Love Fiel: R$ 80,00 (R$ 70 + R$ 10 matrícula)\n• Plano Love (Dupla): R$ 140,00 (R$ 120 + R$ 20 matrícula)\n• Plano Básico: R$ 100,00 (R$ 90 + R$ 10 matrícula)\n\n📋 *DADOS PARA O SEU CADASTRO:*\nCopie a lista abaixo, preencha com seus dados e envie aqui junto com o *comprovante do PIX*:\n\nNome Completo:\nTelefone/WhatsApp:\nData de Nascimento:\nCPF:\nE-mail:\nPlano Escolhido:\n\n*(⚠️ Caso tenha escolhido o Plano de DUPLA, favor preencher os dados dos 2 alunos!).*\n\nAssim que enviar os dados e o comprovante, confirmaremos no sistema e você já poderá começar a treinar! 💪\n\n_Digite *0* se quiser voltar ao menu inicial a qualquer momento._",
    ],
    options: [
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "matricula-santana",
    title: "Matrícula — Jardim Santana (Pix e cadastro)",
    showOptions: false,
    messages: [
      "📍 *UNIDADE JARDIM SANTANA - DADOS DE MATRÍCULA*\n\n🔑 *CHAVE PIX (CNPJ):*\n[EDITAR chave Pix Jardim Santana]\n👤 *Favorecido:* [EDITAR favorecido Jardim Santana]\n🏦 *Unidade:* Jardim Santana\n\n💵 *Valores no 1º mês (Mensalidade + Matrícula):*\n• Plano Love Fiel: R$ 80,00 (R$ 70 + R$ 10 matrícula)\n• Plano Love (Dupla): R$ 140,00 (R$ 120 + R$ 20 matrícula)\n• Plano Básico: R$ 100,00 (R$ 90 + R$ 10 matrícula)\n\n📋 *DADOS PARA O SEU CADASTRO:*\nCopie a lista abaixo, preencha com seus dados e envie aqui junto com o *comprovante do PIX*:\n\nNome Completo:\nTelefone/WhatsApp:\nData de Nascimento:\nCPF:\nE-mail:\nPlano Escolhido:\n\n*(⚠️ Caso tenha escolhido o Plano de DUPLA, favor preencher os dados dos 2 alunos!).*\n\nAssim que enviar os dados e o comprovante, confirmaremos no sistema e você já poderá começar a treinar! 💪\n\n_Digite *0* se quiser voltar ao menu inicial a qualquer momento._",
    ],
    options: [
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "renovar",
    title: "Renovação",
    showOptions: false,
    onEnterAction: "PAUSE",
    pauseMinutes: 60,
    messages: [
      "🔄 *RENOVAÇÃO DE MATRÍCULA - LOVE FIT* ❤️\n\nQue excelente ter você continuando seus treinos com a gente, {{nome}}! 💪\n\nComo você já é nosso aluno, precisamos consultar sua matrícula no sistema para verificar se ela ainda está ativa ou se houve período de inatividade.\n\nPor favor, responda aqui com:\n1. *Seu Nome Completo*\n2. *Seu CPF*\n3. *Em qual unidade você treina (Atalaia ou Jd. Santana)*\n\nUm atendente já recebeu seu chamado e vai verificar sua ficha para te enviar a chave Pix de renovação certinha em instantes! ⏳\n\n_O robô foi pausado para esta conversa para você falar diretamente com o atendente._\n_(Digite *0* para reativar o robô se preferir voltar ao menu inicial)_",
    ],
    options: [
    ],
  },
  {
    key: "horarios",
    title: "Horários",
    showOptions: false,
    messages: [
      "🕔 *HORÁRIOS DE FUNCIONAMENTO - LOVE FIT* 💪\n\nConfira nossos horários de treino na unidade *{{unidade}}*:\n\n{{horarios}}\n\n──────────────────────\n👉 Digite *1* para Ver Planos e Valores\n👉 Digite *2* para Fazer Inscrição (PIX)\n👉 Digite *0* para Voltar ao Menu Principal",
    ],
    options: [
      { label: "Ver planos e valores", triggers: ["1", "plano", "planos", "valor", "valores", "preco", "precos"], action: "GO_TO", target: "planos" },
      { label: "Fazer inscrição (PIX)", triggers: ["2", "matricula", "inscricao", "cadastrar", "cadastro", "inscrever", "quero me matricular"], action: "GO_TO", target: "matricula" },
      { label: "Voltar ao menu principal", triggers: ["0", "voltar"], action: "GO_TO", target: "menu-principal" },
    ],
  },
  {
    key: "atendente",
    title: "Atendente",
    showOptions: false,
    messages: [
      "🧑‍💼 *FALAR COM ATENDENTE - LOVE FIT* ❤️\n\nPerfeito, {{nome}}! Notificamos um atendente da nossa equipe.\n\n⏸️ *O robô foi pausado nesta conversa.*\nPor favor, deixe sua dúvida por escrito aqui abaixo para adiantar seu atendimento.\n\nUm atendente da LOVE FIT irá te responder diretamente aqui em instantes! ⏳\n\n_(Caso queira reativar o menu do robô antes de 1 hora, basta digitar *#menu* ou *0*)_",
    ],
    options: [
    ],
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

/** Hours of the old bot (both units): Mon–Fri 06–22, Sat 09–14, Sun closed. Used for new instances. */
export const DEFAULT_HOURS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, open: "06:00", close: "22:00" })),
  { weekday: 6, open: "09:00", close: "14:00" },
];

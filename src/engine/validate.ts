import { normalizeText } from "./normalize";

/** Shape the validator needs — matches the panel payload and the DB. */
export interface ValidationNode {
  key: string;
  title: string;
  isMain: boolean;
  options: { label: string; triggers: string[]; action: string; targetKey: string | null }[];
}

/** RF-22: every option points to an existing node, no duplicate trigger in a node, exactly one main menu. */
export function validateContent(nodes: ValidationNode[]): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const n of nodes) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(n.key)) errors.push(`Tela "${n.title}": o nome interno "${n.key}" só pode ter letras minúsculas, números e hífen.`);
    if (keys.has(n.key)) errors.push(`Existem duas telas com o nome interno "${n.key}".`);
    keys.add(n.key);
  }
  const mains = nodes.filter((n) => n.isMain);
  if (mains.length === 0) errors.push("Precisa existir uma tela marcada como menu principal.");
  if (mains.length > 1) errors.push("Só pode existir uma tela de menu principal.");

  for (const n of nodes) {
    const seen = new Map<string, string>();
    for (const o of n.options) {
      if (!o.label.trim()) errors.push(`Tela "${n.title}": existe opção sem rótulo.`);
      if (!o.triggers.some((t) => normalizeText(t))) errors.push(`Tela "${n.title}", opção "${o.label}": informe pelo menos um gatilho.`);
      if ((o.action === "GO_TO" || o.action === "NONE") && !o.targetKey)
        errors.push(`Tela "${n.title}", opção "${o.label}": escolha a tela de destino.`);
      if (o.targetKey && !keys.has(o.targetKey))
        errors.push(`Tela "${n.title}", opção "${o.label}": a tela de destino "${o.targetKey}" não existe.`);
      for (const t of o.triggers) {
        const nt = normalizeText(t);
        if (!nt) continue;
        const prev = seen.get(nt);
        if (prev) errors.push(`Tela "${n.title}": o gatilho "${t}" se repete nas opções "${prev}" e "${o.label}".`);
        else seen.set(nt, o.label);
      }
    }
  }
  return errors;
}

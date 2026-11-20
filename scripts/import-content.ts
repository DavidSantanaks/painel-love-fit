/**
 * Replaces all screens of a franchise with a content file (format "lovefit-content/v1").
 * The file may contain real data (Pix keys) — keep it OUT of the repo (*.private.json is gitignored).
 *
 *   docker compose -p lovefit-bot exec -T app npm run import-content -- --replace < lovefit-content.private.json
 *   [--franchise lovefit]   [--dry-run  only validates]
 *
 * Settings, blacklist, staff numbers, instances, contacts and users are not touched.
 */
import { readFileSync } from "node:fs";
import type { SeedNode } from "../src/engine/seed-content";
import { replaceFranchiseContent, validateSeedNodes } from "../src/server/seed";
import { args, db, franchiseFrom, run } from "./lib";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

run(async () => {
  const a = args();
  const raw = a.file ? readFileSync(a.file, "utf8") : await readStdin();
  if (!raw.trim()) throw new Error("Nenhum conteúdo. Use --file arquivo.json ou envie pela entrada padrão (< arquivo.json).");
  const data = JSON.parse(raw) as { format?: string; nodes?: SeedNode[] };
  if (data.format !== "lovefit-content/v1" || !Array.isArray(data.nodes)) throw new Error('Arquivo não é do formato "lovefit-content/v1".');

  const errors = validateSeedNodes(data.nodes);
  if (errors.length) throw new Error("Conteúdo inválido:\n- " + errors.join("\n- "));
  const f = await franchiseFrom(a.franchise);
  console.log(`Arquivo válido: ${data.nodes.length} telas para a franquia ${f.name}.`);
  if (a["dry-run"]) return console.log("--dry-run: nada foi alterado.");
  if (!a.replace) throw new Error("Isto SUBSTITUI todas as telas atuais. Rode de novo com --replace para confirmar.");

  await replaceFranchiseContent(db, f.id, data.nodes);
  await db.auditLog.create({
    data: { franchiseId: f.id, userEmail: "script", entity: "tela", entityName: `${data.nodes.length} telas (import-content)`, action: "importou" },
  });
  console.log("Telas substituídas. Já estão valendo no WhatsApp (não precisa reiniciar).");
});

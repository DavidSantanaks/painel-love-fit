/**
 * Bulk import of blacklist numbers (one per line) from a file or stdin. Numbers never go to the repo.
 *   docker compose exec -T app npm run import-blacklist -- --label "Família" < numeros.txt
 *   npm run import-blacklist -- --file numeros.txt [--franchise lovefit]
 */
import { readFileSync } from "node:fs";
import { parsePhoneList, phoneVariants } from "../src/engine/normalize";
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
  if (!raw.trim()) throw new Error("Nenhum número. Use --file arquivo.txt ou envie pela entrada padrão.");
  const f = await franchiseFrom(a.franchise);
  const { valid, invalid } = parsePhoneList(raw);
  let added = 0;
  let dup = 0;
  for (const phone of valid) {
    const variants = phoneVariants(phone);
    if (await db.blacklistEntry.findFirst({ where: { franchiseId: f.id, phone: { in: variants } } })) {
      dup++;
      continue;
    }
    await db.blacklistEntry.create({ data: { franchiseId: f.id, phone, label: a.label ?? "", note: "importado por script" } });
    await db.notifyNumber.deleteMany({ where: { franchiseId: f.id, phone: { in: variants } } });
    added++;
  }
  await db.auditLog.create({ data: { franchiseId: f.id, userEmail: "script", entity: "blacklist", entityName: `${added} número(s)`, action: "importou" } });
  console.log(`Blacklist (${f.name}): ${added} adicionado(s), ${dup} já existia(m), ${invalid.length} inválido(s).`);
  if (invalid.length) console.log("Inválidos:", invalid.join(", "));
});

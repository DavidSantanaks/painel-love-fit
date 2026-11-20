import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

/** --key value / --flag parser */
export function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith("--")) {
      const k = a[i].slice(2);
      const v = a[i + 1] && !a[i + 1].startsWith("--") ? a[++i] : "true";
      out[k] = v;
    }
  }
  return out;
}

export async function franchiseFrom(slug?: string) {
  const f = slug ? await db.franchise.findUnique({ where: { slug } }) : await db.franchise.findFirst({ where: { isTemplate: true } });
  if (!f) throw new Error(slug ? `Franquia "${slug}" não encontrada.` : "Nenhuma franquia. Rode o seed primeiro.");
  return f;
}

export function run(main: () => Promise<void>) {
  main()
    .catch((e) => {
      console.error("ERRO:", e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}

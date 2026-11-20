import { z } from "zod";
import { DEFAULT_HOURS } from "@/engine/seed-content";
import { ADMIN_ROLES, panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { evolution, EvolutionError } from "@/server/evolution";

export const GET = panelRoute(async (_req, ctx) => {
  const list = await prisma.instance.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } });
  return Promise.all(list.map(async (i) => ({ id: i.id, name: i.name, state: await evolution.connectionState(i.name) })));
});

const schema = z.object({
  name: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,40}$/, "use letras minúsculas, números e hífen"),
  unitName: z.string().trim().min(1).max(60),
});

export const POST = panelRoute(
  async (req, ctx) => {
    const { name, unitName } = schema.parse(await req.json());
    if (await prisma.instance.findUnique({ where: { name } })) throw new HttpError(400, "Já existe uma instância com esse nome.");
    try {
      await evolution.create(name);
    } catch (e) {
      // Already exists in Evolution (e.g. created before): adopt it and point the webhook to us.
      if (e instanceof EvolutionError && (e.status === 403 || e.status === 409)) await evolution.setWebhook(name);
      else throw new HttpError(502, `Evolution API: ${(e as Error).message}`);
    }
    const inst = await prisma.instance.create({ data: { franchiseId: ctx.franchiseId, name, unitName, hours: DEFAULT_HOURS } });
    await audit(ctx, "instância", `${name} (${unitName})`, "criou");
    return { id: inst.id };
  },
  { roles: ADMIN_ROLES },
);

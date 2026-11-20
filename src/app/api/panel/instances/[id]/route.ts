import { z } from "zod";
import { ADMIN_ROLES, panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { evolution } from "@/server/evolution";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "use HH:MM");
const schema = z.object({
  unitName: z.string().trim().min(1).max(60),
  hours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), open: hhmm, close: hhmm }))
    .max(30)
    .refine((hs) => hs.every((h) => h.open < h.close), "o horário de abertura deve ser antes do fechamento"),
});

export const PUT = panelRoute<{ id: string }>(async (req, ctx, { id }) => {
  const data = schema.parse(await req.json());
  const inst = await prisma.instance.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
  if (!inst) throw new HttpError(404, "Instância não encontrada.");
  await prisma.instance.update({ where: { id }, data });
  await audit(ctx, "instância", `${inst.name} — horários/unidade`, "editou");
  return { ok: true };
});

export const DELETE = panelRoute<{ id: string }>(
  async (_req, ctx, { id }) => {
    const inst = await prisma.instance.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
    if (!inst) throw new HttpError(404, "Instância não encontrada.");
    await evolution.remove(inst.name).catch(() => undefined);
    await prisma.instance.delete({ where: { id } });
    await audit(ctx, "instância", inst.name, "excluiu");
    return { ok: true };
  },
  { roles: ADMIN_ROLES },
);

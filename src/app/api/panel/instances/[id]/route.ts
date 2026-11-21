import { z } from "zod";
import { ADMIN_ROLES, panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { evolution } from "@/server/evolution";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, "use HH:MM");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida");
const exception = z
  .object({
    from: isoDate,
    to: isoDate,
    label: z.string().trim().max(80),
    open: hhmm.nullable(),
    close: hhmm.nullable(),
    message: z.string().trim().max(2000),
  })
  .refine((e) => e.from <= e.to, "a data final deve ser igual ou depois da inicial")
  .refine((e) => (e.open === null) === (e.close === null) && (e.open === null || e.open < e.close!), "informe abertura e fechamento (abertura antes do fechamento) ou deixe os dois vazios");
const schema = z.object({
  unitName: z.string().trim().min(1).max(60).optional(),
  hours: z
    .array(z.object({ weekday: z.number().int().min(0).max(6), open: hhmm, close: hhmm }))
    .max(30)
    .refine((hs) => hs.every((h) => h.open < h.close), "o horário de abertura deve ser antes do fechamento")
    .optional(),
  exceptions: z.array(exception).max(200).optional(),
});

export const PUT = panelRoute<{ id: string }>(async (req, ctx, { id }) => {
  const data = schema.parse(await req.json());
  const inst = await prisma.instance.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
  if (!inst) throw new HttpError(404, "Instância não encontrada.");
  await prisma.instance.update({ where: { id }, data });
  await audit(ctx, "instância", `${inst.name} — ${data.exceptions ? "feriados/datas especiais" : "horários/unidade"}`, "editou");
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

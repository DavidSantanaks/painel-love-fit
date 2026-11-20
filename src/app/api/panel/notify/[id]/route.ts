import { formatPhone } from "@/engine/normalize";
import { panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";

export const DELETE = panelRoute<{ id: string }>(async (_req, ctx, { id }) => {
  const n = await prisma.notifyNumber.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
  if (!n) throw new HttpError(404, "Número não encontrado.");
  await prisma.notifyNumber.delete({ where: { id } });
  await audit(ctx, "número de aviso", `${n.label} ${formatPhone(n.phone)}`.trim(), "removeu");
  return { ok: true };
});

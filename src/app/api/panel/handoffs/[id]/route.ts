import { panelRoute, HttpError } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = panelRoute<{ id: string }>(async (_req, ctx, { id }) => {
  const h = await prisma.handoffRequest.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
  if (!h) throw new HttpError(404, "Pedido não encontrado.");
  await prisma.handoffRequest.update({ where: { id }, data: { resolvedAt: new Date(), resolvedBy: ctx.user.email } });
  return { ok: true };
});

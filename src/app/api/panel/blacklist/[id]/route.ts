import { z } from "zod";
import { formatPhone } from "@/engine/normalize";
import { ADMIN_ROLES, panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";

export const PUT = panelRoute<{ id: string }>(
  async (req, ctx, { id }) => {
    const body = z.object({ label: z.string().max(80), note: z.string().max(300) }).parse(await req.json());
    const e = await prisma.blacklistEntry.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
    if (!e) throw new HttpError(404, "Número não encontrado.");
    await prisma.blacklistEntry.update({ where: { id }, data: body });
    await audit(ctx, "blacklist", `${body.label} ${formatPhone(e.phone)}`.trim(), "editou");
    return { ok: true };
  },
  { roles: ADMIN_ROLES },
);

export const DELETE = panelRoute<{ id: string }>(
  async (_req, ctx, { id }) => {
    const e = await prisma.blacklistEntry.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
    if (!e) throw new HttpError(404, "Número não encontrado.");
    await prisma.blacklistEntry.delete({ where: { id } });
    await audit(ctx, "blacklist", `${e.label} ${formatPhone(e.phone)}`.trim(), "removeu");
    return { ok: true };
  },
  { roles: ADMIN_ROLES },
);

import { z } from "zod";
import { normalizePhone, phoneVariants, formatPhone } from "@/engine/normalize";
import { panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";

/** RF-16 — staff alert numbers. A blacklisted number can never be registered here. */
export const POST = panelRoute(async (req, ctx) => {
  const body = z.object({ phone: z.string().max(40), label: z.string().max(80).default("") }).parse(await req.json());
  const phone = normalizePhone(body.phone);
  if (!phone) throw new HttpError(400, "Número inválido. Use DDD + número.");
  const blocked = await prisma.blacklistEntry.findFirst({ where: { franchiseId: ctx.franchiseId, phone: { in: phoneVariants(phone) } } });
  if (blocked) throw new HttpError(400, `${formatPhone(phone)} está na blacklist e não pode receber avisos.`);
  const dup = await prisma.notifyNumber.findFirst({ where: { franchiseId: ctx.franchiseId, phone: { in: phoneVariants(phone) } } });
  if (dup) throw new HttpError(400, "Este número já está cadastrado.");
  await prisma.notifyNumber.create({ data: { franchiseId: ctx.franchiseId, phone, label: body.label } });
  await audit(ctx, "número de aviso", `${body.label} ${formatPhone(phone)}`.trim(), "cadastrou");
  return { ok: true };
});

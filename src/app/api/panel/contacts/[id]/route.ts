import { z } from "zod";
import { formatPhone } from "@/engine/normalize";
import { panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { sender } from "@/server/deps";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("pause"), minutes: z.number().int().min(1).max(60 * 24 * 7).optional() }),
  z.object({ action: z.literal("activate") }),
  z.object({ action: z.literal("send"), text: z.string().trim().min(1).max(2000) }),
]);

/** RF-26 — manual pause / reactivation, and manual send (through the single sender: RF-13). */
export const POST = panelRoute<{ id: string }>(async (req, ctx, { id }) => {
  const body = schema.parse(await req.json());
  const c = await prisma.contact.findFirst({ where: { id, franchiseId: ctx.franchiseId }, include: { instance: true } });
  if (!c) throw new HttpError(404, "Contato não encontrado.");
  const who = `${c.pushName || "sem nome"} ${formatPhone(c.phone)}`;

  if (body.action === "pause") {
    const s = await prisma.settings.findUniqueOrThrow({ where: { franchiseId: ctx.franchiseId } });
    const minutes = body.minutes ?? s.pauseMinutes;
    await prisma.contact.update({ where: { id }, data: { status: "PAUSED", pausedUntil: new Date(Date.now() + minutes * 60_000) } });
    await audit(ctx, "conversa", who, `pausou o bot (${minutes} min)`);
    return { ok: true };
  }
  if (body.action === "activate") {
    await prisma.contact.update({ where: { id }, data: { status: "ACTIVE", pausedUntil: null } });
    await prisma.handoffRequest.updateMany({
      where: { contactId: id, resolvedAt: null },
      data: { resolvedAt: new Date(), resolvedBy: ctx.user.email },
    });
    await audit(ctx, "conversa", who, "reativou o bot");
    return { ok: true };
  }
  const s = await prisma.settings.findUniqueOrThrow({ where: { franchiseId: ctx.franchiseId } });
  const r = await sender().send({
    franchiseId: ctx.franchiseId,
    instanceName: c.instance.name,
    to: { jid: c.remoteJid, phone: c.phone },
    messages: [{ type: "TEXT", text: body.text, media: null }],
    typingDelayMs: 800,
    betweenMessagesMs: s.betweenMessagesMs,
    purpose: "manual",
    allowUnresolved: s.respondUnresolvedLid,
  });
  if (r.blocked) throw new HttpError(403, "Envio bloqueado: este número está na blacklist (ou sem telefone resolvido).");
  if (!r.sent) throw new HttpError(502, "Falha ao enviar. Veja o log.");
  // Sending manually is a human reply: keep the bot quiet with this contact.
  await prisma.contact.update({ where: { id }, data: { status: "PAUSED", pausedUntil: new Date(Date.now() + s.pauseMinutes * 60_000) } });
  await audit(ctx, "conversa", who, "enviou mensagem manual");
  return { ok: true };
});

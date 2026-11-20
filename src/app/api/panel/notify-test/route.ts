import { panelRoute, HttpError } from "@/server/api";
import { prisma } from "@/server/db";
import { sender } from "@/server/deps";

/** Sends a test alert to every staff number (through the single sender — blacklist enforced). */
export const POST = panelRoute(async (_req, ctx) => {
  const [numbers, instance] = await Promise.all([
    prisma.notifyNumber.findMany({ where: { franchiseId: ctx.franchiseId } }),
    prisma.instance.findFirst({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!numbers.length) throw new HttpError(400, "Nenhum número de aviso cadastrado.");
  if (!instance) throw new HttpError(400, "Cadastre e conecte uma instância primeiro.");
  let sent = 0;
  for (const n of numbers) {
    const r = await sender().send({
      franchiseId: ctx.franchiseId,
      instanceName: instance.name,
      to: { jid: `${n.phone}@s.whatsapp.net`, phone: n.phone },
      messages: [{ type: "TEXT", text: "🔔 Teste de aviso do painel LOVE FIT. Se você recebeu, está tudo certo.", media: null }],
      typingDelayMs: 500,
      betweenMessagesMs: 500,
      purpose: "manual",
    });
    sent += r.sent;
  }
  return { sent, total: numbers.length };
});

import { z } from "zod";
import { panelRoute } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";

const words = z.array(z.string().trim().min(1).max(30)).max(20);
const schema = z.object({
  pauseMinutes: z.number().int().min(1).max(60 * 24 * 7),
  floodWindowSeconds: z.number().int().min(0).max(120),
  typingDelayMs: z.number().int().min(0).max(4000),
  betweenMessagesMs: z.number().int().min(300).max(5000),
  reactivationWords: words.min(1),
  staffCommands: words,
  notifyCooldownMinutes: z.number().int().min(1).max(24 * 60),
  retentionDays: z.number().int().min(7).max(3650),
  outOfHoursMessage: z.string().max(2000),
  respondUnresolvedLid: z.boolean(),
});

export const PUT = panelRoute(async (req, ctx) => {
  const data = schema.parse(await req.json());
  await prisma.settings.update({ where: { franchiseId: ctx.franchiseId }, data });
  await audit(ctx, "configurações", "Configurações gerais", "editou");
  return { ok: true };
});

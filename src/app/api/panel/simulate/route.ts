import { z } from "zod";
import { runEngine } from "@/engine/engine";
import { panelRoute, HttpError } from "@/server/api";
import { prisma } from "@/server/db";
import { loadSnapshot, parseHours } from "@/server/deps";
import { env } from "@/server/env";

const schema = z.object({
  text: z.string().max(2000),
  fromMe: z.boolean().default(false),
  pushName: z.string().max(60).default("Cliente"),
  instanceId: z.string().nullable().default(null),
  state: z.object({
    status: z.enum(["ACTIVE", "PAUSED", "WAITING_HUMAN"]),
    pausedUntil: z.string().nullable(),
    currentNodeKey: z.string().nullable(),
  }),
});

/** RF-29 — runs the real engine on the real content; never sends anything to WhatsApp. */
export const POST = panelRoute(async (req, ctx) => {
  const b = schema.parse(await req.json());
  const { content } = await loadSnapshot(ctx.franchiseId);
  if (!content.nodes.some((n) => n.isMain)) throw new HttpError(400, "Não existe tela de menu principal.");
  const inst = b.instanceId
    ? await prisma.instance.findFirst({ where: { id: b.instanceId, franchiseId: ctx.franchiseId } })
    : await prisma.instance.findFirst({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } });
  const r = runEngine(
    content,
    { status: b.state.status, pausedUntil: b.state.pausedUntil ? new Date(b.state.pausedUntil) : null, currentNodeKey: b.state.currentNodeKey },
    { text: b.text, fromMe: b.fromMe, pushName: b.pushName },
    { unitName: inst?.unitName ?? "Unidade", hours: parseHours(inst?.hours), timezone: env().TIMEZONE, now: new Date() },
  );
  return {
    decision: r.decision,
    replies: r.replies.map((m) => ({ type: m.type, text: m.text, fileName: m.media?.fileName ?? null, mediaId: m.media?.id ?? null })),
    state: { ...r.state, pausedUntil: r.state.pausedUntil?.toISOString() ?? null },
    handoff: r.handoff,
    nodeKey: r.nodeKey,
  };
});

import { Conversations } from "@/components/Conversations";
import { formatPhone } from "@/engine/normalize";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function ConversasPage() {
  const ctx = await requirePage();
  const [queue, contacts] = await Promise.all([
    prisma.handoffRequest.findMany({
      where: { franchiseId: ctx.franchiseId, resolvedAt: null },
      include: { contact: { include: { instance: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.contact.findMany({
      where: { franchiseId: ctx.franchiseId },
      include: { instance: true },
      orderBy: { updatedAt: "desc" },
      take: 150,
    }),
  ]);
  const now = Date.now();
  const effective = (status: string, until: Date | null) => (status !== "ACTIVE" && until && until.getTime() > now ? status : "ACTIVE");
  return (
    <Conversations
      queue={queue.map((h) => ({
        id: h.id,
        contactId: h.contactId,
        name: h.contact.pushName,
        phone: formatPhone(h.contact.phone),
        unit: h.contact.instance.unitName,
        reason: h.reason,
        notified: h.notified,
        createdAt: h.createdAt.toISOString(),
      }))}
      contacts={contacts.map((c) => ({
        id: c.id,
        name: c.pushName,
        phone: c.phone ? formatPhone(c.phone) : c.remoteJid,
        unit: c.instance.unitName,
        status: effective(c.status, c.pausedUntil),
        pausedUntil: c.pausedUntil?.toISOString() ?? null,
        node: c.currentNodeKey,
        updatedAt: c.updatedAt.toISOString(),
      }))}
    />
  );
}

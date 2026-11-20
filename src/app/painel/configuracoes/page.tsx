import { Settings } from "@/components/Settings";
import { formatPhone } from "@/engine/normalize";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";
import { parseHours } from "@/server/deps";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const ctx = await requirePage();
  const [s, notify, instances] = await Promise.all([
    prisma.settings.findUniqueOrThrow({ where: { franchiseId: ctx.franchiseId } }),
    prisma.notifyNumber.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } }),
    prisma.instance.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } }),
  ]);
  return (
    <Settings
      settings={{
        pauseMinutes: s.pauseMinutes,
        floodWindowSeconds: s.floodWindowSeconds,
        typingDelayMs: s.typingDelayMs,
        betweenMessagesMs: s.betweenMessagesMs,
        reactivationWords: s.reactivationWords,
        staffCommands: s.staffCommands,
        notifyCooldownMinutes: s.notifyCooldownMinutes,
        retentionDays: s.retentionDays,
        outOfHoursMessage: s.outOfHoursMessage,
        respondUnresolvedLid: s.respondUnresolvedLid,
      }}
      notify={notify.map((n) => ({ id: n.id, phone: formatPhone(n.phone), label: n.label }))}
      instances={instances.map((i) => ({ id: i.id, name: i.name, unitName: i.unitName, hours: parseHours(i.hours) }))}
    />
  );
}

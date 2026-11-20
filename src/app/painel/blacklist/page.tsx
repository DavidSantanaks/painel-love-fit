import { Blacklist } from "@/components/Blacklist";
import { formatPhone } from "@/engine/normalize";
import { ADMIN_ROLES } from "@/server/api";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function BlacklistPage() {
  const ctx = await requirePage(ADMIN_ROLES);
  const list = await prisma.blacklistEntry.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "desc" } });
  return (
    <Blacklist
      entries={list.map((e) => ({ id: e.id, phone: formatPhone(e.phone), label: e.label, note: e.note, createdAt: e.createdAt.toISOString() }))}
    />
  );
}

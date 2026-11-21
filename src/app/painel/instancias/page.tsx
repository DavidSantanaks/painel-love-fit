import { Instances } from "@/components/Instances";
import { requirePage } from "@/server/auth";
import { ADMIN_ROLES } from "@/server/api";
import { prisma } from "@/server/db";
import { parseExceptions, parseHours } from "@/server/deps";

export const dynamic = "force-dynamic";

export default async function InstanciasPage() {
  const ctx = await requirePage(ADMIN_ROLES);
  const list = await prisma.instance.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } });
  return <Instances initial={list.map((i) => ({ id: i.id, name: i.name, unitName: i.unitName, hours: parseHours(i.hours), exceptions: parseExceptions(i.exceptions) }))} />;
}

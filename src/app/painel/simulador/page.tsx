import { Simulator } from "@/components/Simulator";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function SimPage() {
  const ctx = await requirePage();
  const instances = await prisma.instance.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } });
  return <Simulator instances={instances.map((i) => ({ id: i.id, unitName: i.unitName }))} />;
}

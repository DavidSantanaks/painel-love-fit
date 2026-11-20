import { Shell } from "@/components/Shell";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePage();
  const [franchises, queueCount] = await Promise.all([
    ctx.user.role === "PLATFORM_ADMIN" ? prisma.franchise.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }) : null,
    prisma.handoffRequest.count({ where: { franchiseId: ctx.franchiseId, resolvedAt: null } }),
  ]);
  return (
    <Shell
      user={{ name: ctx.user.name, email: ctx.user.email, role: ctx.user.role }}
      isAdmin={ctx.isAdmin}
      franchise={{ id: ctx.franchiseId, name: ctx.franchiseName }}
      franchises={franchises}
      queueCount={queueCount}
    >
      {children}
    </Shell>
  );
}

import { prisma } from "./db";
import type { Ctx } from "./auth";

/** RF-24 — who edited what and when. */
export async function audit(ctx: Ctx, entity: string, entityName: string, action: string) {
  await prisma.auditLog.create({
    data: { franchiseId: ctx.franchiseId, userId: ctx.user.id, userEmail: ctx.user.email, entity, entityName: entityName.slice(0, 200), action },
  });
}

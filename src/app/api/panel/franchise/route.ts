import { cookies } from "next/headers";
import { z } from "zod";
import { panelRoute, HttpError } from "@/server/api";
import { FRANCHISE_COOKIE } from "@/server/auth";
import { prisma } from "@/server/db";

export const POST = panelRoute(
  async (req) => {
    const { franchiseId } = z.object({ franchiseId: z.string() }).parse(await req.json());
    if (!(await prisma.franchise.findUnique({ where: { id: franchiseId } }))) throw new HttpError(404, "Franquia não encontrada.");
    (await cookies()).set(FRANCHISE_COOKIE, franchiseId, { httpOnly: true, sameSite: "lax", path: "/" });
    return { ok: true };
  },
  { roles: ["PLATFORM_ADMIN"] },
);

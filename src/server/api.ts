/** Wrapper for panel route handlers: auth, roles, same-origin check (CSRF), Zod errors → 400. */
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { Role } from "@prisma/client";
import { getCtx, type Ctx } from "./auth";
import { log } from "./logger";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const ADMIN_ROLES: Role[] = ["PLATFORM_ADMIN", "ADMIN"];

type Handler<P> = (req: NextRequest, ctx: Ctx, params: P) => Promise<unknown>;

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers / curl with cookie
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function panelRoute<P = Record<string, string>>(handler: Handler<P>, opts: { roles?: Role[] } = {}) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) throw new HttpError(403, "Origem inválida.");
      const ctx = await getCtx();
      if (!ctx) throw new HttpError(401, "Faça login novamente.");
      if (opts.roles && !opts.roles.includes(ctx.user.role)) throw new HttpError(403, "Sem permissão para esta ação.");
      const result = await handler(req, ctx, (await route.params) ?? ({} as P));
      return result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json({ error: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
      }
      log("error", "panel_api_error", { path: req.nextUrl.pathname, error: e instanceof Error ? e.message : String(e) });
      return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno." }, { status: 500 });
    }
  };
}

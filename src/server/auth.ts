/** Panel authentication: e-mail + strong password (bcrypt), DB sessions, login rate limit (RNF-01/09). */
import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { K, redis } from "./redis";

export const SESSION_COOKIE = "lf_session";
export const FRANCHISE_COOKIE = "lf_franchise";
const SESSION_HOURS = 12;
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const IP_LIMIT = 20;
let dummyHash: string | undefined;

export { hashPassword, passwordProblems } from "./auth-password";

const tokenHash = (token: string) => createHmac("sha256", env().SESSION_SECRET).update(token).digest("hex");

async function isHttps(): Promise<boolean> {
  const mode = env().COOKIE_SECURE;
  if (mode !== "auto") return mode === "true";
  const h = await headers();
  return h.get("x-forwarded-proto") === "https";
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function login(email: string, password: string): Promise<LoginResult> {
  const generic: LoginResult = { ok: false, error: "E-mail ou senha incorretos." };
  const ipKey = K.login(`ip:${await clientIp()}`);
  const attempts = await redis().incr(ipKey);
  if (attempts === 1) await redis().expire(ipKey, LOCK_MINUTES * 60);
  if (attempts > IP_LIMIT) return { ok: false, error: "Muitas tentativas. Aguarde 15 minutos." };

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    dummyHash ??= await bcrypt.hash("dummy-password", 12);
    await bcrypt.compare(password, dummyHash); // same timing as a real check
    return generic;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, error: "Conta bloqueada por tentativas. Aguarde 15 minutos." };

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const failed = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: failed },
    });
    return generic;
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await prisma.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}

export interface Ctx {
  user: User;
  franchiseId: string;
  franchiseName: string;
  isAdmin: boolean;
}

/** Resolves user + active franchise. Platform admins pick the franchise (cookie); others are pinned to theirs. */
export async function getCtx(): Promise<Ctx | null> {
  const user = await currentUser();
  if (!user) return null;
  let franchiseId = user.franchiseId;
  if (user.role === "PLATFORM_ADMIN") {
    const wanted = (await cookies()).get(FRANCHISE_COOKIE)?.value;
    const f =
      (wanted && (await prisma.franchise.findUnique({ where: { id: wanted } }))) ||
      (await prisma.franchise.findFirst({ orderBy: [{ isTemplate: "desc" }, { createdAt: "asc" }] }));
    franchiseId = f?.id ?? null;
  }
  if (!franchiseId) return null;
  const franchise = await prisma.franchise.findUnique({ where: { id: franchiseId } });
  if (!franchise) return null;
  return { user, franchiseId, franchiseName: franchise.name, isAdmin: user.role !== "RECEPTION" };
}

/** For server components/pages. */
export async function requirePage(roles?: Role[]): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (roles && !roles.includes(ctx.user.role)) redirect("/painel");
  return ctx;
}

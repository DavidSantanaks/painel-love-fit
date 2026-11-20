/**
 * Evolution API webhook. Answers 200 fast and processes in the background (RNF-02).
 * Accepts only calls with the token (RNF-01) coming from the internal network — requests that went
 * through Cloudflare carry cf-connecting-ip and are refused (RNF-09).
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { log } from "@/server/logger";
import { K, redis } from "@/server/redis";
import { parseEvolutionWebhook } from "@/server/webhook-parse";

export const dynamic = "force-dynamic";

function tokenOk(given: string | null): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(env().WEBHOOK_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (req.headers.get("cf-connecting-ip") || req.headers.get("cf-ray")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!tokenOk(req.nextUrl.searchParams.get("token"))) {
    log("warn", "webhook_bad_token", {});
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid_json" });
  }
  const parsed = parseEvolutionWebhook(body);
  if (!parsed.ok) return NextResponse.json({ ok: true, ignored: parsed.reason });
  try {
    await redis().lpush(K.queue, ...parsed.events.map((e) => JSON.stringify(e)));
  } catch (e) {
    log("error", "webhook_enqueue_failed", { error: String(e) });
    return NextResponse.json({ error: "queue_unavailable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, queued: parsed.events.length });
}

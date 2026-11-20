import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { redis } from "@/server/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis().ping();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

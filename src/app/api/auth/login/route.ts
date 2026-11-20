import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { login } from "@/server/auth";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Informe e-mail e senha." }, { status: 400 });
  const r = await login(parsed.data.email, parsed.data.password);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 401 });
  return NextResponse.json({ ok: true });
}

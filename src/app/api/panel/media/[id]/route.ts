import { promises as fs } from "node:fs";
import path from "node:path";
import { panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

export const GET = panelRoute<{ id: string }>(async (_req, ctx, { id }) => {
  const m = await prisma.media.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
  if (!m) throw new HttpError(404, "Arquivo não encontrado.");
  const buf = await fs.readFile(path.join(env().MEDIA_DIR, m.storagePath));
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": m.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(m.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

export const DELETE = panelRoute<{ id: string }>(async (_req, ctx, { id }) => {
  const m = await prisma.media.findFirst({ where: { id, franchiseId: ctx.franchiseId }, include: { _count: { select: { messages: true } } } });
  if (!m) throw new HttpError(404, "Arquivo não encontrado.");
  if (m._count.messages) throw new HttpError(400, "Arquivo em uso por alguma tela.");
  await prisma.media.delete({ where: { id } });
  await fs.rm(path.join(env().MEDIA_DIR, m.storagePath), { force: true });
  await audit(ctx, "mídia", m.fileName, "excluiu");
  return { ok: true };
});

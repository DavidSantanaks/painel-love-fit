import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" };

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

/** RF-14 — upload JPG/PNG/PDF to the app volume (size-limited, type checked by content). */
export const POST = panelRoute(async (req, ctx) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Nenhum arquivo enviado.");
  const max = env().MEDIA_MAX_MB * 1024 * 1024;
  if (file.size > max) throw new HttpError(400, `Arquivo maior que ${env().MEDIA_MAX_MB} MB.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !ALLOWED[mime]) throw new HttpError(400, "Formato não aceito. Use JPG, PNG ou PDF.");

  const dir = path.join(env().MEDIA_DIR, ctx.franchiseId);
  await fs.mkdir(dir, { recursive: true });
  const storagePath = path.join(ctx.franchiseId, `${randomUUID()}.${ALLOWED[mime]}`);
  await fs.writeFile(path.join(env().MEDIA_DIR, storagePath), buf);

  const safeName = (file.name || `arquivo.${ALLOWED[mime]}`).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
  const media = await prisma.media.create({
    data: { franchiseId: ctx.franchiseId, fileName: safeName, mimeType: mime, size: buf.length, storagePath },
  });
  await audit(ctx, "mídia", safeName, "enviou");
  return { id: media.id, fileName: media.fileName, mimeType: media.mimeType, size: media.size };
});

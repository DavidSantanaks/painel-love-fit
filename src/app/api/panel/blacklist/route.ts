import { z } from "zod";
import { formatPhone, parsePhoneList, phoneVariants } from "@/engine/normalize";
import { ADMIN_ROLES, panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";

const schema = z.object({
  raw: z.string().min(1).max(20_000),
  label: z.string().max(80).default(""),
  note: z.string().max(300).default(""),
});

/**
 * §6.5 — add one number or paste a list. Numbers are normalized to E.164; duplicates (including the
 * variant with/without the extra 9) are refused. A number in the blacklist can never stay as a staff
 * alert number, so it is removed from there.
 */
export const POST = panelRoute(
  async (req, ctx) => {
    const { raw, label, note } = schema.parse(await req.json());
    const { valid, invalid } = parsePhoneList(raw);
    if (!valid.length) throw new HttpError(400, invalid.length ? `Número(s) inválido(s): ${invalid.join(", ")}` : "Nenhum número informado.");

    const added: string[] = [];
    const duplicates: string[] = [];
    const removedFromNotify: string[] = [];
    for (const phone of valid) {
      const variants = phoneVariants(phone);
      const exists = await prisma.blacklistEntry.findFirst({ where: { franchiseId: ctx.franchiseId, phone: { in: variants } } });
      if (exists || added.includes(phone)) {
        duplicates.push(formatPhone(phone));
        continue;
      }
      await prisma.blacklistEntry.create({ data: { franchiseId: ctx.franchiseId, phone, label, note } });
      added.push(phone);
      const n = await prisma.notifyNumber.deleteMany({ where: { franchiseId: ctx.franchiseId, phone: { in: variants } } });
      if (n.count) removedFromNotify.push(formatPhone(phone));
    }
    if (added.length) await audit(ctx, "blacklist", `${added.length} número(s)${label ? ` — ${label}` : ""}`, "adicionou");
    return { added: added.length, duplicates, invalid, removedFromNotify };
  },
  { roles: ADMIN_ROLES },
);

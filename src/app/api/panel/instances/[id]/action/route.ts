import { z } from "zod";
import { ADMIN_ROLES, panelRoute, HttpError } from "@/server/api";
import { audit } from "@/server/audit";
import { prisma } from "@/server/db";
import { evolution } from "@/server/evolution";

/** RF-25 — QR Code, restart, webhook reconfiguration and logout from the panel. */
export const POST = panelRoute<{ id: string }>(
  async (req, ctx, { id }) => {
    const { action } = z.object({ action: z.enum(["qr", "restart", "webhook", "logout", "status"]) }).parse(await req.json());
    const inst = await prisma.instance.findFirst({ where: { id, franchiseId: ctx.franchiseId } });
    if (!inst) throw new HttpError(404, "Instância não encontrada.");
    try {
      switch (action) {
        case "status": {
          const [state, info, webhook] = await Promise.all([
            evolution.connectionState(inst.name),
            evolution.fetchInstance(inst.name),
            evolution.findWebhook(inst.name),
          ]);
          return { state, number: info?.ownerJid?.split("@")[0] ?? null, profileName: info?.profileName ?? null, webhookEnabled: !!webhook?.enabled };
        }
        case "qr": {
          let state = await evolution.connectionState(inst.name);
          if (state === "missing") {
            await evolution.create(inst.name);
            state = "connecting";
          }
          if (state === "open") return { state, message: "Já está conectado." };
          const r = await evolution.connect(inst.name);
          return { state, qr: r.base64 ?? null, pairingCode: r.pairingCode ?? null };
        }
        case "restart":
          await evolution.restart(inst.name);
          break;
        case "webhook":
          await evolution.setWebhook(inst.name);
          break;
        case "logout":
          await evolution.logout(inst.name);
          break;
      }
    } catch (e) {
      throw new HttpError(502, `Evolution API: ${(e as Error).message}`);
    }
    const labels = { restart: "reiniciou", webhook: "reconfigurou o webhook de", logout: "desconectou" } as const;
    await audit(ctx, "instância", inst.name, labels[action]);
    return { ok: true };
  },
  { roles: ADMIN_ROLES },
);

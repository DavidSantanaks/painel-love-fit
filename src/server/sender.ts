/**
 * THE single outbound point (RF-13). Every message that leaves the app — replies, staff alerts,
 * manual sends from the panel — goes through `send()`, which checks the blacklist first.
 * There is no flag to bypass the blacklist.
 */
import { phoneVariants } from "@/engine/normalize";
import { log, mask } from "./logger";
import type { Ephemeral, MediaReader, SendRequest, SendResult, Sleep, Store, WhatsAppGateway } from "./ports";

export const MAX_ATTEMPTS = 3;

export interface SenderDeps {
  store: Pick<Store, "isBlacklisted" | "log">;
  ephemeral: Pick<Ephemeral, "rememberEcho" | "markSending">;
  gateway: WhatsAppGateway;
  media: MediaReader;
  sleep: Sleep;
}

export function createSender(deps: SenderDeps) {
  async function blocked(franchiseId: string, phone: string | null, allowUnresolved: boolean): Promise<string | null> {
    if (!phone) return allowUnresolved ? null : "unresolved_phone";
    for (const v of phoneVariants(phone)) {
      if (await deps.store.isBlacklisted(franchiseId, v)) return "blacklisted";
    }
    return null;
  }

  async function attempt(fn: () => Promise<string | null>): Promise<{ id: string | null; error: string | null }> {
    let lastErr = "";
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      try {
        return { id: await fn(), error: null };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        // A timeout may still be delivered later by Evolution: retrying could duplicate the message.
        if (/timeout|aborted/i.test(lastErr)) break;
        if (i < MAX_ATTEMPTS) await deps.sleep(1000 * 2 ** (i - 1)); // 1s, 2s — RF-12, never infinite
      }
    }
    return { id: null, error: lastErr };
  }

  async function send(req: SendRequest): Promise<SendResult> {
    const reason = await blocked(req.franchiseId, req.to.phone, !!req.allowUnresolved);
    if (reason) {
      log("warn", "send_blocked", { instance: req.instanceName, purpose: req.purpose, reason, to: mask(req.to.phone) });
      await deps.store.log({
        franchiseId: req.franchiseId,
        instanceName: req.instanceName,
        contactPhone: req.to.phone,
        direction: "OUT",
        decision: `blocked_${req.purpose}`,
        nodeKey: req.nodeKey ?? null,
        result: reason,
      });
      return { sent: 0, failed: 0, blocked: true };
    }

    // Prefer the phone number as destination; fall back to the raw jid (@lid).
    const to = req.to.phone ?? req.to.jid;
    let sent = 0;
    let failed = 0;
    await deps.ephemeral.markSending(req.instanceName, req.to.jid, true);
    try {
      for (let i = 0; i < req.messages.length; i++) {
        const m = req.messages[i];
        // RF-09: Evolution shows "typing…" during `delay` before delivering each message.
        const delay = i === 0 ? req.typingDelayMs : Math.max(req.betweenMessagesMs, 300);
        const r = await attempt(async () => {
          if (m.type === "TEXT") return deps.gateway.sendText(req.instanceName, to, m.text, delay);
          if (!m.media) throw new Error("media_missing");
          const file = await deps.media.readBase64(m.media.id);
          if (!file) throw new Error("media_file_missing");
          return deps.gateway.sendMedia(
            req.instanceName,
            to,
            {
              mediatype: m.type === "IMAGE" ? "image" : "document",
              mimetype: file.mimeType,
              base64: file.base64,
              fileName: file.fileName,
              caption: m.text,
            },
            delay,
          );
        });
        if (r.id) await deps.ephemeral.rememberEcho(req.instanceName, r.id); // RF-15
        if (r.error) failed++;
        else sent++;
        await deps.store.log({
          franchiseId: req.franchiseId,
          instanceName: req.instanceName,
          contactPhone: req.to.phone,
          direction: "OUT",
          decision: req.purpose,
          nodeKey: req.nodeKey ?? null,
          result: r.error ? `failed: ${r.error.slice(0, 180)}` : "sent",
        });
        if (r.error) {
          log("error", "send_failed", { instance: req.instanceName, to: mask(req.to.phone), error: r.error });
          break; // do not send the rest of a screen out of order
        }
      }
    } finally {
      await deps.ephemeral.markSending(req.instanceName, req.to.jid, false);
    }
    return { sent, failed, blocked: false };
  }

  return { send };
}

export type Sender = ReturnType<typeof createSender>;

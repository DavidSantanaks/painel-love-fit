/**
 * Inbound pipeline: filters (stateful) → engine (pure) → persistence → sender.
 * Order matters:
 *   1. unknown instance       5. echo of our own sends (RF-15)
 *   2. too old (reconnect)    6. blacklist — silent, no state (RF-07)
 *   3. idempotency (RF-11)    7. anti-flood (RF-06)
 *   4. unresolved @lid        8. engine + state + handoff + send
 */
import { formatPhone, phoneVariants } from "@/engine/normalize";
import { runEngine } from "@/engine/engine";
import { INITIAL_STATE } from "@/engine/types";
import { log, mask } from "./logger";
import type { Ephemeral, Sleep, Store } from "./ports";
import type { Sender } from "./sender";
import type { InboundEvent } from "./webhook-parse";

export const MAX_MESSAGE_AGE_SECONDS = 10 * 60;

export interface PipelineDeps {
  store: Store;
  ephemeral: Ephemeral;
  sender: Sender;
  now: () => Date;
  sleep: Sleep;
  timezone: string;
}

export type PipelineOutcome =
  | "unknown_instance"
  | "too_old"
  | "duplicate"
  | "echo"
  | "unresolved_lid"
  | "blacklisted"
  | "flood"
  | string; // engine decisions

async function waitForEcho(deps: PipelineDeps, ev: InboundEvent): Promise<boolean> {
  // The echo webhook can arrive before Evolution answers our send request.
  for (let i = 0; i < 20; i++) {
    if (await deps.ephemeral.isEcho(ev.instance, ev.messageId)) return true;
    if (!(await deps.ephemeral.isSending(ev.instance, ev.remoteJid)) && i > 0) break;
    await deps.sleep(250);
  }
  return deps.ephemeral.isEcho(ev.instance, ev.messageId);
}

export async function handleInbound(ev: InboundEvent, deps: PipelineDeps): Promise<PipelineOutcome> {
  const { store, ephemeral } = deps;
  const instance = await store.findInstance(ev.instance);
  if (!instance) {
    log("warn", "unknown_instance", { instance: ev.instance });
    return "unknown_instance";
  }
  const base = { franchiseId: instance.franchiseId, instanceName: instance.name, contactPhone: ev.phone };
  const now = deps.now();

  if (ev.timestamp && now.getTime() / 1000 - ev.timestamp > MAX_MESSAGE_AGE_SECONDS) return "too_old";
  if (!(await ephemeral.claimMessage(ev.instance, ev.messageId))) return "duplicate";
  if (ev.fromMe && (await waitForEcho(deps, ev))) return "echo";

  const { content, runtime } = await store.loadContent(instance.franchiseId);

  if (!ev.phone) {
    // §6.5 — @lid without a resolvable phone: we cannot check the blacklist.
    log("warn", "unresolved_lid", { instance: ev.instance, jid: ev.remoteJid });
    await store.log({ ...base, direction: "IN", decision: "unresolved_lid", result: "contato sem telefone resolvido" });
    if (!runtime.respondUnresolvedLid) return "unresolved_lid";
  } else {
    for (const v of phoneVariants(ev.phone)) {
      if (await store.isBlacklisted(instance.franchiseId, v)) {
        await store.log({ ...base, direction: "IN", decision: "blacklisted" });
        return "blacklisted";
      }
    }
  }

  if (!ev.fromMe && !(await ephemeral.floodAllow(ev.instance, ev.remoteJid, runtime.floodWindowSeconds))) {
    await store.log({ ...base, direction: "IN", decision: "flood" });
    return "flood";
  }

  return ephemeral.withLock(ev.instance, ev.remoteJid, async () => {
    const existing = await store.getContact(instance.id, ev.remoteJid);
    const state = existing ?? INITIAL_STATE;
    const result = runEngine(
      content,
      { status: state.status, pausedUntil: state.pausedUntil, currentNodeKey: state.currentNodeKey },
      { fromMe: ev.fromMe, text: ev.text, pushName: ev.pushName },
      { unitName: instance.unitName, hours: instance.hours, timezone: deps.timezone, now },
    );

    const contact = await store.saveContact({
      franchiseId: instance.franchiseId,
      instanceId: instance.id,
      remoteJid: ev.remoteJid,
      phone: ev.phone,
      pushName: ev.fromMe ? "" : ev.pushName, // fromMe carries the store's own name
      state: result.state,
      inbound: !ev.fromMe,
    });

    await store.log({
      ...base,
      direction: "IN",
      decision: result.decision,
      nodeKey: result.nodeKey,
      optionLabel: result.optionLabel,
    });
    log("info", "inbound", {
      instance: ev.instance,
      contact: mask(ev.phone),
      fromMe: ev.fromMe,
      decision: result.decision,
      node: result.nodeKey,
      replies: result.replies.length,
    });

    // RF-16 — the panel queue entry is created first, so it shows up even if WhatsApp is slow.
    const handoffId = result.handoff ? await store.createHandoff(instance.franchiseId, contact.id, result.handoff.reason) : null;

    if (result.replies.length) {
      await deps.sender.send({
        franchiseId: instance.franchiseId,
        instanceName: instance.name,
        to: { jid: ev.remoteJid, phone: ev.phone },
        messages: result.replies,
        typingDelayMs: runtime.typingDelayMs,
        betweenMessagesMs: runtime.betweenMessagesMs,
        purpose: "reply",
        allowUnresolved: runtime.respondUnresolvedLid,
        nodeKey: result.nodeKey,
      });
    }

    if (result.handoff && handoffId) {
      // WhatsApp alert to staff numbers, rate limited per contact.
      const cooldownMs = runtime.notifyCooldownMinutes * 60_000;
      const canNotify = !contact.lastNotifiedAt || now.getTime() - contact.lastNotifiedAt.getTime() >= cooldownMs;
      const numbers = canNotify ? await store.notifyNumbers(instance.franchiseId) : [];
      let notified = false;
      if (numbers.length) {
        const text = [
          "🔔 *Pedido de atendimento*",
          `Nome: ${ev.pushName || "(sem nome)"}`,
          `Telefone: ${ev.phone ? formatPhone(ev.phone) : ev.remoteJid}`,
          `Unidade: ${instance.unitName}`,
          `Pediu: ${result.handoff.reason}`,
        ].join("\n");
        for (const n of numbers) {
          const r = await deps.sender.send({
            franchiseId: instance.franchiseId,
            instanceName: instance.name,
            to: { jid: `${n}@s.whatsapp.net`, phone: n },
            messages: [{ type: "TEXT", text, media: null }],
            typingDelayMs: 500,
            betweenMessagesMs: 500,
            purpose: "notify",
          });
          if (r.sent) notified = true;
        }
      }
      if (notified) {
        await store.markNotified(contact.id, now);
        await store.markHandoffNotified(handoffId);
      }
    }
    return result.decision;
  });
}

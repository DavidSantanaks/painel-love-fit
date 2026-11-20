/** Real implementations of the pipeline ports: Prisma (state) + Redis (ephemeral) + Evolution (gateway). */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ContentSnapshot, EngineNode, HoursEntry } from "@/engine/types";
import { prisma } from "./db";
import { env } from "./env";
import { evolutionGateway } from "./evolution";
import { log } from "./logger";
import type { PipelineDeps } from "./pipeline";
import type { Ephemeral, MediaReader, RuntimeSettings, Store } from "./ports";
import { K, redis } from "./redis";
import { createSender, type Sender } from "./sender";

export function parseHours(v: unknown): HoursEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((h) => h && typeof h === "object")
    .map((h) => ({ weekday: Number(h.weekday), open: String(h.open), close: String(h.close) }))
    .filter((h) => h.weekday >= 0 && h.weekday <= 6 && /^\d{2}:\d{2}$/.test(h.open) && /^\d{2}:\d{2}$/.test(h.close));
}

/** Reads the franchise content fresh from the DB on every message (RF-23: edits apply immediately). */
export async function loadSnapshot(franchiseId: string): Promise<{ content: ContentSnapshot; runtime: RuntimeSettings }> {
  const [nodes, s] = await Promise.all([
    prisma.node.findMany({
      where: { franchiseId },
      include: {
        messages: { orderBy: { order: "asc" }, include: { media: true } },
        options: { orderBy: { order: "asc" }, include: { target: { select: { key: true } } } },
      },
    }),
    prisma.settings.findUnique({ where: { franchiseId } }),
  ]);
  if (!s) throw new Error(`Franchise ${franchiseId} has no settings`);
  const engineNodes: EngineNode[] = nodes.map((n) => ({
    key: n.key,
    title: n.title,
    isMain: n.isMain,
    showOptions: n.showOptions,
    onEnterAction: n.onEnterAction,
    pauseMinutes: n.pauseMinutes,
    messages: n.messages.map((m) => ({
      type: m.type,
      text: m.text,
      media: m.media ? { id: m.media.id, fileName: m.media.fileName, mimeType: m.media.mimeType } : null,
    })),
    options: n.options.map((o) => ({
      order: o.order,
      label: o.label,
      triggers: o.triggers,
      action: o.action,
      targetKey: o.target?.key ?? null,
      pauseMinutes: o.pauseMinutes,
    })),
  }));
  return {
    content: {
      nodes: engineNodes,
      settings: {
        pauseMinutes: s.pauseMinutes,
        reactivationWords: s.reactivationWords,
        staffCommands: s.staffCommands,
        outOfHoursMessage: s.outOfHoursMessage,
      },
    },
    runtime: {
      floodWindowSeconds: s.floodWindowSeconds,
      typingDelayMs: s.typingDelayMs,
      betweenMessagesMs: s.betweenMessagesMs,
      notifyCooldownMinutes: s.notifyCooldownMinutes,
      respondUnresolvedLid: s.respondUnresolvedLid,
    },
  };
}

export const prismaStore: Store = {
  async findInstance(name) {
    const i = await prisma.instance.findUnique({ where: { name } });
    return i ? { id: i.id, franchiseId: i.franchiseId, name: i.name, unitName: i.unitName, hours: parseHours(i.hours) } : null;
  },
  loadContent: loadSnapshot,
  async isBlacklisted(franchiseId, phone) {
    return !!(await prisma.blacklistEntry.findUnique({ where: { franchiseId_phone: { franchiseId, phone } }, select: { id: true } }));
  },
  async getContact(instanceId, remoteJid) {
    const c = await prisma.contact.findUnique({ where: { instanceId_remoteJid: { instanceId, remoteJid } } });
    return c ? { id: c.id, status: c.status, pausedUntil: c.pausedUntil, currentNodeKey: c.currentNodeKey, lastNotifiedAt: c.lastNotifiedAt } : null;
  },
  async saveContact(i) {
    const data = {
      status: i.state.status,
      pausedUntil: i.state.pausedUntil,
      currentNodeKey: i.state.currentNodeKey,
      ...(i.phone ? { phone: i.phone } : {}),
      ...(i.pushName ? { pushName: i.pushName.slice(0, 80) } : {}),
      ...(i.inbound ? { lastInboundAt: new Date() } : {}),
    };
    const c = await prisma.contact.upsert({
      where: { instanceId_remoteJid: { instanceId: i.instanceId, remoteJid: i.remoteJid } },
      create: { franchiseId: i.franchiseId, instanceId: i.instanceId, remoteJid: i.remoteJid, ...data },
      update: data,
    });
    return { id: c.id, status: c.status, pausedUntil: c.pausedUntil, currentNodeKey: c.currentNodeKey, lastNotifiedAt: c.lastNotifiedAt };
  },
  async markNotified(contactId, at) {
    await prisma.contact.update({ where: { id: contactId }, data: { lastNotifiedAt: at } });
  },
  async createHandoff(franchiseId, contactId, reason) {
    // One open request per contact: refresh it instead of piling duplicates.
    const open = await prisma.handoffRequest.findFirst({ where: { contactId, resolvedAt: null } });
    if (open) {
      await prisma.handoffRequest.update({ where: { id: open.id }, data: { reason: reason.slice(0, 200), createdAt: new Date() } });
      return open.id;
    }
    return (await prisma.handoffRequest.create({ data: { franchiseId, contactId, reason: reason.slice(0, 200) } })).id;
  },
  async markHandoffNotified(id) {
    await prisma.handoffRequest.update({ where: { id }, data: { notified: true } });
  },
  async notifyNumbers(franchiseId) {
    return (await prisma.notifyNumber.findMany({ where: { franchiseId }, select: { phone: true } })).map((n) => n.phone);
  },
  async log(e) {
    await prisma.messageLog.create({
      data: {
        franchiseId: e.franchiseId,
        instanceName: e.instanceName,
        contactPhone: e.contactPhone,
        direction: e.direction,
        decision: e.decision,
        nodeKey: e.nodeKey ?? null,
        optionLabel: e.optionLabel ?? null,
        result: e.result ?? null,
      },
    });
  },
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const redisEphemeral: Ephemeral = {
  async claimMessage(instance, id) {
    return (await redis().set(K.seen(instance, id), "1", "EX", 86_400, "NX")) === "OK";
  },
  async floodAllow(instance, jid, windowSeconds) {
    if (windowSeconds <= 0) return true;
    return (await redis().set(K.flood(instance, jid), "1", "EX", windowSeconds, "NX")) === "OK";
  },
  async rememberEcho(instance, id) {
    await redis().set(K.echo(instance, id), "1", "EX", 86_400);
  },
  async isEcho(instance, id) {
    return (await redis().exists(K.echo(instance, id))) === 1;
  },
  async markSending(instance, jid, on) {
    if (on) await redis().set(K.sending(instance, jid), "1", "EX", 120);
    else await redis().del(K.sending(instance, jid));
  },
  async isSending(instance, jid) {
    return (await redis().exists(K.sending(instance, jid))) === 1;
  },
  async withLock(instance, jid, fn) {
    const key = K.lock(instance, jid);
    const token = Math.random().toString(36).slice(2);
    for (let i = 0; i < 240; i++) {
      if ((await redis().set(key, token, "PX", 120_000, "NX")) === "OK") {
        try {
          return await fn();
        } finally {
          if ((await redis().get(key)) === token) await redis().del(key);
        }
      }
      await sleep(250);
    }
    throw new Error("contact_lock_timeout");
  },
};

export const fileMedia: MediaReader = {
  async readBase64(mediaId) {
    const m = await prisma.media.findUnique({ where: { id: mediaId } });
    if (!m) return null;
    try {
      const buf = await fs.readFile(path.join(env().MEDIA_DIR, m.storagePath));
      return { base64: buf.toString("base64"), mimeType: m.mimeType, fileName: m.fileName };
    } catch (e) {
      log("error", "media_read_failed", { mediaId, error: String(e) });
      return null;
    }
  },
};

const g = globalThis as unknown as { __sender?: Sender };

/** The app-wide sender — the only object that can deliver WhatsApp messages. */
export function sender(): Sender {
  if (!g.__sender) {
    g.__sender = createSender({ store: prismaStore, ephemeral: redisEphemeral, gateway: evolutionGateway, media: fileMedia, sleep });
  }
  return g.__sender;
}

export function pipelineDeps(): PipelineDeps {
  return { store: prismaStore, ephemeral: redisEphemeral, sender: sender(), now: () => new Date(), sleep, timezone: env().TIMEZONE };
}

import { createSender } from "@/server/sender";
import type { PipelineDeps } from "@/server/pipeline";
import type { Ephemeral, LogEntry, Store, StoredContact, WhatsAppGateway } from "@/server/ports";
import type { InboundEvent } from "@/server/webhook-parse";
import { NOW, seedSnapshot } from "./helpers";

export interface Sent {
  instance: string;
  to: string;
  text: string;
}

export function createWorld() {
  const clock = { now: new Date(NOW) };
  const content = seedSnapshot();
  const runtime = {
    floodWindowSeconds: 5,
    typingDelayMs: 0,
    betweenMessagesMs: 0,
    notifyCooldownMinutes: 30,
    respondUnresolvedLid: false,
  };
  const blacklist = new Set<string>();
  const notify: string[] = [];
  const contacts = new Map<string, StoredContact & { phone: string | null }>();
  const handoffs: { contactId: string; reason: string; notified: boolean }[] = [];
  const logs: LogEntry[] = [];
  const sent: Sent[] = [];
  let failNext = 0;

  const store: Store = {
    async findInstance(name) {
      if (!["atalaia", "santana"].includes(name)) return null;
      return { id: `inst-${name}`, franchiseId: "f1", name, unitName: name === "atalaia" ? "Atalaia" : "Jardim Santana", hours: [] };
    },
    async loadContent() {
      return { content, runtime };
    },
    async isBlacklisted(_f, phone) {
      return blacklist.has(phone);
    },
    async getContact(instanceId, jid) {
      return contacts.get(`${instanceId}|${jid}`) ?? null;
    },
    async saveContact(i) {
      const k = `${i.instanceId}|${i.remoteJid}`;
      const prev = contacts.get(k);
      const c = { id: prev?.id ?? `c${contacts.size + 1}`, lastNotifiedAt: prev?.lastNotifiedAt ?? null, phone: i.phone, ...i.state };
      contacts.set(k, c);
      return c;
    },
    async markNotified(id, at) {
      for (const c of contacts.values()) if (c.id === id) c.lastNotifiedAt = at;
    },
    async createHandoff(_f, contactId, reason) {
      handoffs.push({ contactId, reason, notified: false });
      return String(handoffs.length - 1);
    },
    async markHandoffNotified(id) {
      handoffs[Number(id)].notified = true;
    },
    async notifyNumbers() {
      return [...notify];
    },
    async log(e) {
      logs.push(e);
    },
  };

  const seen = new Set<string>();
  const echoes = new Set<string>();
  const flood = new Map<string, number>();
  const ephemeral: Ephemeral = {
    async claimMessage(i, id) {
      const k = `${i}:${id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    },
    async floodAllow(i, jid, win) {
      const k = `${i}:${jid}`;
      const last = flood.get(k);
      const t = clock.now.getTime();
      if (last !== undefined && t - last < win * 1000) return false;
      flood.set(k, t);
      return true;
    },
    async rememberEcho(i, id) {
      echoes.add(`${i}:${id}`);
    },
    async isEcho(i, id) {
      return echoes.has(`${i}:${id}`);
    },
    async markSending() {},
    async isSending() {
      return false;
    },
    async withLock(_i, _j, fn) {
      return fn();
    },
  };

  let msgSeq = 0;
  const gateway: WhatsAppGateway = {
    async sendText(instance, to, text) {
      if (failNext > 0) {
        failNext--;
        throw new Error("evolution down");
      }
      sent.push({ instance, to, text });
      return `OUT-${++msgSeq}`;
    },
    async sendMedia(instance, to, m) {
      sent.push({ instance, to, text: `[${m.mediatype}] ${m.caption}` });
      return `OUT-${++msgSeq}`;
    },
  };

  const sleep = async () => {};
  const sender = createSender({
    store,
    ephemeral,
    gateway,
    media: { readBase64: async () => ({ base64: "AAAA", mimeType: "image/png", fileName: "x.png" }) },
    sleep,
  });
  const deps: PipelineDeps = { store, ephemeral, sender, now: () => clock.now, sleep, timezone: "America/Sao_Paulo" };

  let inSeq = 0;
  const event = (phone: string, text: string, extra: Partial<InboundEvent> = {}): InboundEvent => ({
    instance: "atalaia",
    messageId: `IN-${++inSeq}`,
    remoteJid: `${phone}@s.whatsapp.net`,
    phone,
    fromMe: false,
    text,
    pushName: "Cliente Teste",
    timestamp: Math.floor(clock.now.getTime() / 1000),
    ...extra,
  });
  const advance = (seconds: number) => {
    clock.now = new Date(clock.now.getTime() + seconds * 1000);
  };

  return {
    deps, sender, content, runtime, blacklist, notify, contacts, handoffs, logs, sent, clock, event, advance,
    failNext: (n: number) => { failNext = n; },
  };
}

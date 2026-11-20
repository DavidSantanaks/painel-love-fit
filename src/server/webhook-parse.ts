/**
 * Parses Evolution API v2 webhook payloads (event "messages.upsert") into a minimal inbound event.
 * Pure function — easy to test.
 */
import { normalizePhone } from "@/engine/normalize";

export interface InboundEvent {
  instance: string;
  messageId: string;
  remoteJid: string;
  /** Resolved E.164 phone, or null for @lid contacts we could not resolve. */
  phone: string | null;
  fromMe: boolean;
  text: string;
  pushName: string;
  timestamp: number | null; // unix seconds
}

export type ParseResult = { ok: true; events: InboundEvent[] } | { ok: false; reason: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function extractText(message: Obj | undefined): string {
  if (!message) return "";
  const m = message as Record<string, Obj | string | undefined>;
  const pick = (k: string, f: string) => (isObj(m[k]) ? str((m[k] as Obj)[f]) : "");
  return (
    str(m.conversation) ||
    pick("extendedTextMessage", "text") ||
    pick("imageMessage", "caption") ||
    pick("videoMessage", "caption") ||
    pick("documentMessage", "caption") ||
    pick("buttonsResponseMessage", "selectedDisplayText") ||
    pick("templateButtonReplyMessage", "selectedDisplayText") ||
    pick("listResponseMessage", "title") ||
    ""
  );
}

const IGNORED_TYPES = ["protocolMessage", "reactionMessage", "pollUpdateMessage", "editedMessage", "senderKeyDistributionMessage"];

export function isIgnoredJid(jid: string): boolean {
  return jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid.endsWith("@newsletter") || jid === "status@broadcast";
}

/** For @lid contacts Evolution may send the real number in an alternate field. */
function resolvePhone(remoteJid: string, key: Obj, data: Obj): string | null {
  if (remoteJid.endsWith("@s.whatsapp.net")) return normalizePhone(remoteJid);
  if (remoteJid.endsWith("@lid")) {
    for (const c of [key.remoteJidAlt, key.senderPn, data.senderPn, key.participantAlt, data.remoteJidAlt]) {
      const s = str(c);
      if (s && !s.endsWith("@lid")) {
        const n = normalizePhone(s);
        if (n) return n;
      }
    }
    return null;
  }
  return normalizePhone(remoteJid);
}

export function parseEvolutionWebhook(body: unknown): ParseResult {
  if (!isObj(body)) return { ok: false, reason: "invalid_body" };
  const event = str(body.event).toLowerCase().replace(/_/g, ".");
  if (event !== "messages.upsert") return { ok: false, reason: `event_${event || "missing"}` };
  const instance = str(body.instance);
  if (!instance) return { ok: false, reason: "missing_instance" };

  const items = Array.isArray(body.data) ? body.data : [body.data];
  const events: InboundEvent[] = [];
  for (const data of items) {
    if (!isObj(data) || !isObj(data.key)) continue;
    const key = data.key;
    const remoteJid = str(key.remoteJid);
    const messageId = str(key.id);
    if (!remoteJid || !messageId || isIgnoredJid(remoteJid)) continue;
    const message = isObj(data.message) ? data.message : undefined;
    const messageType = str(data.messageType);
    if (IGNORED_TYPES.includes(messageType) || (message && IGNORED_TYPES.some((t) => t in message))) continue;

    const ts = Number(data.messageTimestamp);
    events.push({
      instance,
      messageId,
      remoteJid,
      phone: resolvePhone(remoteJid, key, data),
      fromMe: key.fromMe === true,
      text: extractText(message),
      pushName: str(data.pushName),
      timestamp: Number.isFinite(ts) && ts > 0 ? ts : null,
    });
  }
  if (!events.length) return { ok: false, reason: "no_relevant_messages" };
  return { ok: true, events };
}

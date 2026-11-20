/** Thin client for Evolution API v2 (internal Docker network). The API key only comes from .env. */
import { env } from "./env";
import type { WhatsAppGateway } from "./ports";

export class EvolutionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T = unknown>(method: string, path: string, body?: unknown, timeoutMs = 30_000): Promise<T> {
  const e = env();
  const res = await fetch(`${e.EVOLUTION_API_URL}${path}`, {
    method,
    headers: { apikey: e.AUTHENTICATION_API_KEY, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    const msg = typeof data === "object" && data ? JSON.stringify(data).slice(0, 300) : String(text).slice(0, 300);
    throw new EvolutionError(res.status, `Evolution ${method} ${path.split("?")[0]} → ${res.status}: ${msg}`);
  }
  return data as T;
}

const enc = encodeURIComponent;
const idOf = (r: unknown): string | null => {
  const key = (r as { key?: { id?: string } } | null)?.key;
  return key?.id ?? null;
};

export const evolutionGateway: WhatsAppGateway = {
  async sendText(instance, to, text, delayMs) {
    const r = await call("POST", `/message/sendText/${enc(instance)}`, { number: to, text, delay: delayMs, linkPreview: false }, 20_000 + delayMs);
    return idOf(r);
  },
  async sendMedia(instance, to, m, delayMs) {
    const r = await call(
      "POST",
      `/message/sendMedia/${enc(instance)}`,
      { number: to, mediatype: m.mediatype, mimetype: m.mimetype, caption: m.caption, media: m.base64, fileName: m.fileName, delay: delayMs },
      45_000 + delayMs,
    );
    return idOf(r);
  },
};

export function webhookUrl(): string {
  const e = env();
  return `${e.APP_INTERNAL_URL}/api/webhooks/evolution?token=${enc(e.WEBHOOK_TOKEN)}`;
}

const webhookConfig = () => ({
  enabled: true,
  url: webhookUrl(),
  byEvents: false,
  base64: false,
  events: ["MESSAGES_UPSERT"],
});

export type ConnState = "open" | "close" | "connecting" | "unknown" | "missing";

export const evolution = {
  async connectionState(instance: string): Promise<ConnState> {
    try {
      const r = await call<{ instance?: { state?: string } }>("GET", `/instance/connectionState/${enc(instance)}`, undefined, 8_000);
      const s = r?.instance?.state;
      return s === "open" || s === "close" || s === "connecting" ? s : "unknown";
    } catch (e) {
      if (e instanceof EvolutionError && e.status === 404) return "missing";
      return "unknown";
    }
  },
  async fetchInstance(instance: string): Promise<{ ownerJid?: string; profileName?: string } | null> {
    try {
      const r = await call<Array<{ ownerJid?: string; profileName?: string }>>("GET", `/instance/fetchInstances?instanceName=${enc(instance)}`, undefined, 8_000);
      return Array.isArray(r) ? r[0] ?? null : null;
    } catch {
      return null;
    }
  },
  async create(instance: string): Promise<void> {
    await call("POST", "/instance/create", {
      instanceName: instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      syncFullHistory: false,
      webhook: webhookConfig(),
    });
  },
  /** Returns the QR Code as a data URL (or a pairing code), when not connected yet. */
  async connect(instance: string): Promise<{ base64?: string; pairingCode?: string; code?: string }> {
    return call("GET", `/instance/connect/${enc(instance)}`);
  },
  async restart(instance: string): Promise<void> {
    await call("POST", `/instance/restart/${enc(instance)}`);
  },
  async logout(instance: string): Promise<void> {
    await call("DELETE", `/instance/logout/${enc(instance)}`);
  },
  async remove(instance: string): Promise<void> {
    await call("DELETE", `/instance/delete/${enc(instance)}`);
  },
  async setWebhook(instance: string): Promise<void> {
    await call("POST", `/webhook/set/${enc(instance)}`, { webhook: webhookConfig() });
  },
  async findWebhook(instance: string): Promise<{ url?: string; enabled?: boolean } | null> {
    try {
      return await call("GET", `/webhook/find/${enc(instance)}`, undefined, 8_000);
    } catch {
      return null;
    }
  },
};

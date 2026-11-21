/**
 * Dependency ports used by the pipeline and the sender.
 * Real implementations live in deps.ts (Prisma + Redis + Evolution); tests use in-memory fakes.
 */
import type { ContactState, ContentSnapshot, DateException, HoursEntry, OutboundMessage } from "@/engine/types";

export interface InstanceInfo {
  id: string;
  franchiseId: string;
  name: string;
  unitName: string;
  hours: HoursEntry[];
  exceptions?: DateException[];
}

export interface RuntimeSettings {
  floodWindowSeconds: number;
  typingDelayMs: number;
  betweenMessagesMs: number;
  notifyCooldownMinutes: number;
  respondUnresolvedLid: boolean;
}

export interface StoredContact extends ContactState {
  id: string;
  lastNotifiedAt: Date | null;
}

export interface LogEntry {
  franchiseId: string;
  instanceName: string;
  contactPhone: string | null;
  direction: "IN" | "OUT";
  decision: string;
  nodeKey?: string | null;
  optionLabel?: string | null;
  result?: string | null;
}

export interface Store {
  findInstance(name: string): Promise<InstanceInfo | null>;
  loadContent(franchiseId: string): Promise<{ content: ContentSnapshot; runtime: RuntimeSettings }>;
  isBlacklisted(franchiseId: string, phone: string): Promise<boolean>;
  getContact(instanceId: string, remoteJid: string): Promise<StoredContact | null>;
  saveContact(input: {
    franchiseId: string;
    instanceId: string;
    remoteJid: string;
    phone: string | null;
    pushName: string;
    state: ContactState;
    inbound: boolean;
  }): Promise<StoredContact>;
  markNotified(contactId: string, at: Date): Promise<void>;
  /** Opens (or refreshes) the panel queue entry; returns its id. */
  createHandoff(franchiseId: string, contactId: string, reason: string): Promise<string>;
  markHandoffNotified(handoffId: string): Promise<void>;
  notifyNumbers(franchiseId: string): Promise<string[]>;
  log(entry: LogEntry): Promise<void>;
}

/** Shared ephemeral state (Redis). */
export interface Ephemeral {
  /** Returns true the first time a message id is seen (RF-11). */
  claimMessage(instance: string, messageId: string): Promise<boolean>;
  /** Returns true when allowed; false when inside the anti-flood window (RF-06). */
  floodAllow(instance: string, jid: string, windowSeconds: number): Promise<boolean>;
  rememberEcho(instance: string, messageId: string): Promise<void>;
  isEcho(instance: string, messageId: string): Promise<boolean>;
  markSending(instance: string, jid: string, on: boolean): Promise<void>;
  isSending(instance: string, jid: string): Promise<boolean>;
  withLock<T>(instance: string, jid: string, fn: () => Promise<T>): Promise<T>;
}

export interface WhatsAppGateway {
  /** Returns the WhatsApp message id of the sent message. */
  sendText(instance: string, to: string, text: string, delayMs: number): Promise<string | null>;
  sendMedia(
    instance: string,
    to: string,
    media: { mediatype: "image" | "document"; mimetype: string; base64: string; fileName: string; caption: string },
    delayMs: number,
  ): Promise<string | null>;
}

export interface MediaReader {
  readBase64(mediaId: string): Promise<{ base64: string; mimeType: string; fileName: string } | null>;
}

export interface SendRequest {
  franchiseId: string;
  instanceName: string;
  /** Destination: remoteJid (may be @lid) plus resolved phone when known. */
  to: { jid: string; phone: string | null };
  messages: OutboundMessage[];
  typingDelayMs: number;
  betweenMessagesMs: number;
  purpose: "reply" | "notify" | "manual";
  allowUnresolved?: boolean;
  nodeKey?: string | null;
}

export interface SendResult {
  sent: number;
  failed: number;
  blocked: boolean;
}

export type Sleep = (ms: number) => Promise<void>;

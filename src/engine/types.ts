export type MessageType = "TEXT" | "IMAGE" | "DOCUMENT";
export type NodeAction = "NONE" | "CALL_HUMAN" | "PAUSE";
export type OptionAction = "GO_TO" | "CALL_HUMAN" | "PAUSE" | "NONE";
export type ContactStatus = "ACTIVE" | "PAUSED" | "WAITING_HUMAN";

export interface EngineMedia {
  id: string;
  fileName: string;
  mimeType: string;
}

export interface EngineMessage {
  type: MessageType;
  /** Text body, or caption for media. Accepts variables. */
  text: string;
  media?: EngineMedia | null;
}

export interface EngineOption {
  order: number;
  label: string;
  triggers: string[];
  action: OptionAction;
  targetKey: string | null;
  pauseMinutes: number | null;
}

export interface EngineNode {
  key: string;
  title: string;
  isMain: boolean;
  showOptions: boolean;
  onEnterAction: NodeAction;
  pauseMinutes: number | null;
  messages: EngineMessage[];
  options: EngineOption[];
}

export interface HoursEntry {
  weekday: number; // 0 = Sunday … 6 = Saturday
  open: string; // "HH:MM"
  close: string; // "HH:MM"
}

/** Special period (holiday, vacation, event): closed, or open with different hours. Dates are "YYYY-MM-DD", inclusive. */
export interface DateException {
  from: string;
  to: string;
  label: string;
  /** Both set = open on these days with these hours; otherwise closed. */
  open: string | null;
  close: string | null;
  /** Sent instead of the default out-of-hours message when someone asks for an attendant. Also {{aviso}}. */
  message: string;
}

export interface EngineSettings {
  pauseMinutes: number;
  reactivationWords: string[];
  staffCommands: string[];
  outOfHoursMessage: string;
}

export interface ContentSnapshot {
  nodes: EngineNode[];
  settings: EngineSettings;
}

export interface ContactState {
  status: ContactStatus;
  pausedUntil: Date | null;
  currentNodeKey: string | null;
}

export interface InboundMessage {
  fromMe: boolean;
  text: string;
  pushName: string;
}

export interface EngineContext {
  unitName: string;
  hours: HoursEntry[];
  exceptions?: DateException[];
  timezone: string;
  now: Date;
}

/** A message ready to be sent (variables already rendered). */
export interface OutboundMessage {
  type: MessageType;
  text: string;
  media?: EngineMedia | null;
}

export type Decision =
  | "human_reply_pause"
  | "staff_command_pause"
  | "paused_silent"
  | "reactivated"
  | "menu"
  | "option"
  | "fallback"
  | "ignored_no_text";

export interface EngineResult {
  decision: Decision;
  replies: OutboundMessage[];
  state: ContactState;
  /** Set when the customer must be put in the human queue (RF-10 / RF-16). */
  handoff: { reason: string } | null;
  nodeKey: string | null;
  optionLabel: string | null;
}

export const INITIAL_STATE: ContactState = { status: "ACTIVE", pausedUntil: null, currentNodeKey: null };

/**
 * Conversation engine — a pure function (constitution §10):
 *   (content, contact state, inbound message, context) → (replies, new state, handoff, decision)
 * No I/O, no clock reads (the clock comes from ctx.now), no WhatsApp.
 *
 * Filters that need shared state (idempotency, echo, blacklist, anti-flood) run before the
 * engine in src/server/pipeline.ts.
 */
import { normalizeText } from "./normalize";
import { isOpen, renderNode, renderTemplate } from "./render";
import type {
  ContactState,
  ContentSnapshot,
  EngineContext,
  EngineNode,
  EngineOption,
  EngineResult,
  InboundMessage,
  OutboundMessage,
} from "./types";

const MINUTE = 60_000;

function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * MINUTE);
}

export function isPaused(state: ContactState, now: Date): boolean {
  return state.status !== "ACTIVE" && !!state.pausedUntil && state.pausedUntil.getTime() > now.getTime();
}

function mainNode(content: ContentSnapshot): EngineNode {
  const main = content.nodes.find((n) => n.isMain);
  if (!main) throw new Error("Content has no main menu node");
  return main;
}

function findNode(content: ContentSnapshot, key: string | null): EngineNode | undefined {
  return key ? content.nodes.find((n) => n.key === key) : undefined;
}

const isNumeric = (s: string) => /^\d+$/.test(s);

function containsWords(text: string, trigger: string): boolean {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(text);
}

/**
 * Trigger lookup order: current node → main menu → every other node.
 * First pass: exact match. Second pass: non-numeric triggers (≥ 3 chars) found as a word in the text.
 */
export function matchOption(content: ContentSnapshot, currentKey: string | null, text: string): EngineOption | null {
  const t = normalizeText(text);
  if (!t) return null;
  const main = mainNode(content);
  const current = findNode(content, currentKey);
  const ordered: EngineNode[] = [];
  for (const n of [current, main, ...content.nodes]) if (n && !ordered.includes(n)) ordered.push(n);

  for (const node of ordered) {
    for (const opt of [...node.options].sort((a, b) => a.order - b.order)) {
      if (opt.triggers.some((tr) => normalizeText(tr) === t)) return opt;
    }
  }
  for (const node of ordered) {
    for (const opt of [...node.options].sort((a, b) => a.order - b.order)) {
      const hit = opt.triggers.some((tr) => {
        const n = normalizeText(tr);
        return n.length >= 3 && !isNumeric(n) && containsWords(t, n);
      });
      if (hit) return opt;
    }
  }
  return null;
}

function matchesList(text: string, list: string[]): boolean {
  const t = normalizeText(text);
  return !!t && list.some((w) => normalizeText(w) === t);
}

export function runEngine(
  content: ContentSnapshot,
  state: ContactState,
  msg: InboundMessage,
  ctx: EngineContext,
): EngineResult {
  const { settings } = content;
  const now = ctx.now;
  const base = { handoff: null, nodeKey: null, optionLabel: null } as const;

  // RF-03 / RF-04 — the store answered from its own phone (echoes are filtered upstream).
  if (msg.fromMe) {
    const isCommand = matchesList(msg.text, settings.staffCommands);
    return {
      ...base,
      decision: isCommand ? "staff_command_pause" : "human_reply_pause",
      replies: [],
      state: {
        status: "PAUSED",
        pausedUntil: addMinutes(now, settings.pauseMinutes),
        currentNodeKey: state.currentNodeKey,
      },
    };
  }

  const reactivation = matchesList(msg.text, settings.reactivationWords);
  const main = mainNode(content);

  const enter = (node: EngineNode): OutboundMessage[] => renderNode(node, msg.pushName, ctx);

  // RF-05 — paused: only reactivation words wake the bot up.
  if (isPaused(state, now)) {
    if (!reactivation) return { ...base, decision: "paused_silent", replies: [], state };
    return {
      ...base,
      decision: "reactivated",
      replies: enter(main),
      nodeKey: main.key,
      state: { status: "ACTIVE", pausedUntil: null, currentNodeKey: main.key },
    };
  }

  const active: ContactState = { status: "ACTIVE", pausedUntil: null, currentNodeKey: state.currentNodeKey };

  if (!normalizeText(msg.text)) {
    // Media without caption, stickers, reactions… nothing to answer.
    return { ...base, decision: "ignored_no_text", replies: [], state: active };
  }

  if (reactivation) {
    return {
      ...base,
      decision: "menu",
      replies: enter(main),
      nodeKey: main.key,
      state: { ...active, currentNodeKey: main.key },
    };
  }

  const option = matchOption(content, state.currentNodeKey, msg.text);
  const target = option ? findNode(content, option.targetKey) : undefined;

  // §6.3 — anything unknown falls back to the main menu with greeting.
  if (!option || (!target && (option.action === "GO_TO" || option.action === "NONE"))) {
    return {
      ...base,
      decision: "fallback",
      replies: enter(main),
      nodeKey: main.key,
      state: { ...active, currentNodeKey: main.key },
    };
  }

  const replies: OutboundMessage[] = target ? enter(target) : [];
  let next: ContactState = { ...active, currentNodeKey: target?.key ?? state.currentNodeKey };
  let handoff: EngineResult["handoff"] = null;

  // Action from the option, or from the node being entered (acao_ao_entrar).
  let pauseAction: { minutes: number; reason: string } | null = null;
  if (option.action === "CALL_HUMAN" || option.action === "PAUSE") {
    pauseAction = { minutes: option.pauseMinutes ?? settings.pauseMinutes, reason: option.label };
  } else if (target && target.onEnterAction !== "NONE") {
    pauseAction = { minutes: target.pauseMinutes ?? settings.pauseMinutes, reason: target.title };
  }

  if (pauseAction) {
    next = { status: "WAITING_HUMAN", pausedUntil: addMinutes(now, pauseAction.minutes), currentNodeKey: next.currentNodeKey };
    handoff = { reason: pauseAction.reason };
    const closedMsg = settings.outOfHoursMessage.trim();
    if (closedMsg && !isOpen(ctx.hours, now, ctx.timezone)) {
      replies.push({ type: "TEXT", text: renderTemplate(closedMsg, msg.pushName, ctx), media: null });
    }
  }

  return {
    decision: "option",
    replies,
    state: next,
    handoff,
    nodeKey: target?.key ?? null,
    optionLabel: option.label,
  };
}

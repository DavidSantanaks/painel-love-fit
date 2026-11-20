import type { EngineContext, EngineNode, HoursEntry, OutboundMessage } from "./types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Hour, minute and weekday of `now` in the given IANA timezone. */
export function localTime(now: Date, timezone: string): { weekday: number; minutes: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { weekday, hour, minutes: hour * 60 + minute };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function greeting(now: Date, timezone: string): string {
  const { hour } = localTime(now, timezone);
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** True when there are no hours configured (always open) or now falls inside one window. */
export function isOpen(hours: HoursEntry[], now: Date, timezone: string): boolean {
  if (!hours.length) return true;
  const { weekday, minutes } = localTime(now, timezone);
  return hours.some((h) => h.weekday === weekday && minutes >= toMinutes(h.open) && minutes < toMinutes(h.close));
}

export function formatHours(hours: HoursEntry[]): string {
  if (!hours.length) return "Horário não cadastrado.";
  return WEEK_ORDER.map((d) => {
    const slots = hours.filter((h) => h.weekday === d).sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
    const label = WEEKDAYS[d];
    if (!slots.length) return `${label}: fechado`;
    return `${label}: ${slots.map((s) => `${s.open} às ${s.close}`).join(" e ")}`;
  }).join("\n");
}

function firstName(pushName: string): string {
  const clean = pushName.replace(/[^\p{L}\p{N}' -]/gu, "").trim();
  return clean.split(/\s+/)[0] ?? "";
}

/** Replaces {{nome}}, {{unidade}}, {{saudacao}}, {{horarios}}, {{expediente}} and tidies empty variables. */
export function renderTemplate(template: string, pushName: string, ctx: EngineContext): string {
  const vars: Record<string, string> = {
    nome: firstName(pushName),
    unidade: ctx.unitName,
    saudacao: greeting(ctx.now, ctx.timezone),
    horarios: formatHours(ctx.hours),
    expediente: isOpen(ctx.hours, ctx.now, ctx.timezone) ? "aberto agora" : "fechado agora",
  };
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => (name in vars ? vars[name] : match))
    .replace(/,\s*([!?.])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function optionsList(node: EngineNode): string {
  return [...node.options]
    .sort((a, b) => a.order - b.order)
    .map((o) => (o.triggers[0] ? `*${o.triggers[0]}* - ${o.label}` : o.label))
    .join("\n");
}

/** Renders every message of a node and appends the numbered option list when enabled. */
export function renderNode(node: EngineNode, pushName: string, ctx: EngineContext): OutboundMessage[] {
  const out: OutboundMessage[] = node.messages
    .map((m) => ({ type: m.type, text: renderTemplate(m.text, pushName, ctx), media: m.media ?? null }))
    .filter((m) => m.type !== "TEXT" || m.text.length > 0)
    .filter((m) => m.type === "TEXT" || !!m.media);

  if (node.showOptions && node.options.length) {
    const list = optionsList(node);
    const last = out[out.length - 1];
    if (last && last.type === "TEXT") last.text = `${last.text}\n\n${list}`;
    else out.push({ type: "TEXT", text: list, media: null });
  }
  return out;
}

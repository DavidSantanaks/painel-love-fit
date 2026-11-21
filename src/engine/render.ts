import type { DateException, EngineContext, EngineNode, HoursEntry, OutboundMessage } from "./types";

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

/** Local calendar date of `now` as "YYYY-MM-DD". */
export function localDate(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** The special period covering today, if any (the last one registered wins). */
export function activeException(exceptions: DateException[] | undefined, now: Date, timezone: string): DateException | null {
  if (!exceptions?.length) return null;
  const today = localDate(now, timezone);
  return [...exceptions].reverse().find((e) => e.from <= today && today <= e.to) ?? null;
}

/** A special period overrides the weekly hours; with no hours configured the unit is always open. */
export function isOpen(hours: HoursEntry[], now: Date, timezone: string, exceptions?: DateException[]): boolean {
  const exc = activeException(exceptions, now, timezone);
  if (exc) {
    if (!exc.open || !exc.close) return false;
    const { minutes } = localTime(now, timezone);
    return minutes >= toMinutes(exc.open) && minutes < toMinutes(exc.close);
  }
  if (!hours.length) return true;
  const { weekday, minutes } = localTime(now, timezone);
  return hours.some((h) => h.weekday === weekday && minutes >= toMinutes(h.open) && minutes < toMinutes(h.close));
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * Groups consecutive days with the same hours, in the old bot's style:
 *   • *Segunda a Sexta:* das 06:00 às 22:00
 *   • *Sábado:* das 09:00 às 14:00
 *   • *Domingo:* Fechado
 */
export function formatHours(hours: HoursEntry[]): string {
  if (!hours.length) return "Horário não cadastrado.";
  const describe = (d: number) => {
    const slots = hours.filter((h) => h.weekday === d).sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
    return slots.length ? slots.map((s) => `das ${s.open} às ${s.close}`).join(" e ") : "Fechado";
  };
  const groups: { days: number[]; text: string }[] = [];
  for (const d of WEEK_ORDER) {
    const text = describe(d);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.days.push(d);
    else groups.push({ days: [d], text });
  }
  return groups
    .map(({ days, text }) => {
      const first = DAY_NAMES[days[0]];
      const lastDay = DAY_NAMES[days[days.length - 1]];
      const label = days.length === 1 ? first : days.length === 2 ? `${first} e ${lastDay}` : `${first} a ${lastDay}`;
      return `• *${label}:* ${text}`;
    })
    .join("\n");
}

function cleanName(pushName: string): string {
  return pushName.replace(/\s+/g, " ").trim().slice(0, 60);
}

function firstName(pushName: string): string {
  const clean = pushName.replace(/[^\p{L}\p{N}' -]/gu, "").trim();
  return clean.split(/\s+/)[0] ?? "";
}

/**
 * Variables: {{nome}} (full WhatsApp name, "Atleta" when empty — same as the old bot), {{primeiro_nome}},
 * {{unidade}}, {{saudacao}}, {{horarios}}, {{expediente}}, {{aviso}} (message of the holiday/special period running today, empty otherwise).
 */
export function renderTemplate(template: string, pushName: string, ctx: EngineContext): string {
  const vars: Record<string, string> = {
    nome: cleanName(pushName) || "Atleta",
    primeiro_nome: firstName(pushName) || "Atleta",
    unidade: ctx.unitName,
    saudacao: greeting(ctx.now, ctx.timezone),
    horarios: formatHours(ctx.hours),
    expediente: isOpen(ctx.hours, ctx.now, ctx.timezone, ctx.exceptions) ? "aberto agora" : "fechado agora",
    aviso: activeException(ctx.exceptions, ctx.now, ctx.timezone)?.message.trim() ?? "",
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

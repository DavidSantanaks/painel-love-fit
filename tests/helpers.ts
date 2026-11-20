import { SEED_NODES, SEED_SETTINGS } from "@/engine/seed-content";
import type { ContentSnapshot, EngineContext } from "@/engine/types";

export function seedSnapshot(overrides: Partial<ContentSnapshot["settings"]> = {}): ContentSnapshot {
  return {
    settings: {
      pauseMinutes: SEED_SETTINGS.pauseMinutes,
      reactivationWords: SEED_SETTINGS.reactivationWords,
      staffCommands: SEED_SETTINGS.staffCommands,
      outOfHoursMessage: SEED_SETTINGS.outOfHoursMessage,
      ...overrides,
    },
    nodes: SEED_NODES.map((n) => ({
      key: n.key,
      title: n.title,
      isMain: !!n.isMain,
      showOptions: n.showOptions ?? true,
      onEnterAction: n.onEnterAction ?? "NONE",
      pauseMinutes: n.pauseMinutes ?? null,
      messages: n.messages.map((text) => ({ type: "TEXT" as const, text, media: null })),
      options: n.options.map((o, i) => ({
        order: i,
        label: o.label,
        triggers: o.triggers,
        action: o.action,
        targetKey: o.target,
        pauseMinutes: o.pauseMinutes ?? null,
      })),
    })),
  };
}

// Wednesday 2026-11-18 14:00 in São Paulo (UTC-3)
export const NOW = new Date("2026-11-18T17:00:00Z");

export function ctx(now: Date = NOW, hours: EngineContext["hours"] = []): EngineContext {
  return { unitName: "Atalaia", hours, timezone: "America/Sao_Paulo", now };
}

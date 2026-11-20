import { describe, expect, it } from "vitest";
import { matchOption, runEngine } from "@/engine/engine";
import { INITIAL_STATE, type ContactState } from "@/engine/types";
import { ctx, NOW, seedSnapshot } from "./helpers";

const msg = (text: string, extra: Partial<{ fromMe: boolean; pushName: string }> = {}) => ({
  text,
  fromMe: false,
  pushName: "Maria Souza",
  ...extra,
});

describe("engine — menus and triggers", () => {
  const content = seedSnapshot();

  it("unknown text falls back to the main menu with greeting and name (§6.3)", () => {
    const r = runEngine(content, INITIAL_STATE, msg("oi"), ctx());
    expect(r.decision).toBe("fallback");
    expect(r.nodeKey).toBe("menu-principal");
    expect(r.replies[0].text).toContain("Boa tarde, Maria!");
    expect(r.replies[0].text).toContain("LOVE FIT Atalaia");
    expect(r.replies[0].text).toContain("*1* - Planos e valores");
  });

  it("drops the dangling comma when the contact has no name", () => {
    const r = runEngine(content, INITIAL_STATE, msg("oi", { pushName: "" }), ctx());
    expect(r.replies[0].text.startsWith("Boa tarde! ")).toBe(true);
  });

  it("matches numeric and word triggers, accent-insensitive", () => {
    expect(runEngine(content, INITIAL_STATE, msg("1"), ctx()).nodeKey).toBe("planos");
    expect(runEngine(content, INITIAL_STATE, msg("Preço"), ctx()).nodeKey).toBe("planos");
    expect(runEngine(content, INITIAL_STATE, msg("quero saber os valores"), ctx()).nodeKey).toBe("planos");
    expect(runEngine(content, INITIAL_STATE, msg("MATRÍCULA"), ctx()).nodeKey).toBe("matricula");
  });

  it("sub-options (11, 21, 22) work from anywhere, like the old bot", () => {
    expect(runEngine(content, INITIAL_STATE, msg("11"), ctx()).nodeKey).toBe("regras-love-fiel");
    expect(runEngine(content, INITIAL_STATE, msg("22"), ctx()).nodeKey).toBe("matricula-santana");
  });

  it("prefers the current node's options", () => {
    const st: ContactState = { ...INITIAL_STATE, currentNodeKey: "planos" };
    expect(runEngine(content, st, msg("2"), ctx()).nodeKey).toBe("matricula");
    expect(matchOption(content, "planos", "1")?.label).toBe("Planos e valores");
  });

  it("price shown is whatever the content says (panel is the source of truth)", () => {
    const edited = seedSnapshot();
    const planos = edited.nodes.find((n) => n.key === "planos")!;
    planos.messages[0].text = planos.messages[0].text.replace("R$ 70,00", "R$ 79,90");
    const r = runEngine(edited, INITIAL_STATE, msg("1"), ctx());
    expect(r.replies[0].text).toContain("R$ 79,90");
  });

  it("renders the unit hours", () => {
    const hours = [{ weekday: 3, open: "06:00", close: "22:00" }];
    const r = runEngine(content, INITIAL_STATE, msg("4"), ctx(NOW, hours));
    expect(r.replies[0].text).toContain("Qua: 06:00 às 22:00");
    expect(r.replies[0].text).toContain("Dom: fechado");
  });

  it("ignores messages without text (media with no caption)", () => {
    const r = runEngine(content, INITIAL_STATE, msg("   "), ctx());
    expect(r.decision).toBe("ignored_no_text");
    expect(r.replies).toHaveLength(0);
  });
});

describe("engine — human handoff and pause", () => {
  const content = seedSnapshot();

  it("'atendente' puts the contact in the queue and pauses (RF-10)", () => {
    const r = runEngine(content, INITIAL_STATE, msg("atendente"), ctx());
    expect(r.handoff).toEqual({ reason: "Falar com atendente" });
    expect(r.state.status).toBe("WAITING_HUMAN");
    expect(r.state.pausedUntil!.getTime() - NOW.getTime()).toBe(60 * 60_000);
    expect(r.replies[0].text).toContain("Já chamei a recepção");
  });

  it("node with acao_ao_entrar pause(60) also hands off (renovar)", () => {
    const r = runEngine(content, INITIAL_STATE, msg("3"), ctx());
    expect(r.handoff).toEqual({ reason: "Renovação" });
    expect(r.state.status).toBe("WAITING_HUMAN");
  });

  it("adds the out-of-hours message when calling a human while closed", () => {
    const hours = [{ weekday: 3, open: "06:00", close: "10:00" }];
    const r = runEngine(content, INITIAL_STATE, msg("5"), ctx(NOW, hours));
    expect(r.replies.at(-1)!.text).toContain("fora do horário");
  });

  it("store replying from the phone pauses the bot for 1h (RF-03)", () => {
    const r = runEngine(content, INITIAL_STATE, msg("Oi, tudo bem?", { fromMe: true }), ctx());
    expect(r.decision).toBe("human_reply_pause");
    expect(r.replies).toHaveLength(0);
    expect(r.state.status).toBe("PAUSED");
    expect(r.state.pausedUntil!.getTime() - NOW.getTime()).toBe(60 * 60_000);
  });

  it("staff commands pause too (RF-04)", () => {
    const r = runEngine(content, INITIAL_STATE, msg("#PAUSA", { fromMe: true }), ctx());
    expect(r.decision).toBe("staff_command_pause");
  });

  it("while paused the bot stays silent; 'menu' brings it back (RF-05)", () => {
    const paused = runEngine(content, INITIAL_STATE, msg("x", { fromMe: true }), ctx()).state;
    const later = new Date(NOW.getTime() + 10 * 60_000);
    const silent = runEngine(content, paused, msg("1"), ctx(later));
    expect(silent.decision).toBe("paused_silent");
    expect(silent.replies).toHaveLength(0);
    for (const word of ["menu", "#menu", "0", "Voltar"]) {
      const back = runEngine(content, paused, msg(word), ctx(later));
      expect(back.decision).toBe("reactivated");
      expect(back.state.status).toBe("ACTIVE");
      expect(back.nodeKey).toBe("menu-principal");
    }
  });

  it("pause expires by itself after the configured time", () => {
    const paused = runEngine(content, INITIAL_STATE, msg("x", { fromMe: true }), ctx()).state;
    const after = new Date(NOW.getTime() + 61 * 60_000);
    const r = runEngine(content, paused, msg("1"), ctx(after));
    expect(r.decision).toBe("option");
    expect(r.state.status).toBe("ACTIVE");
  });

  it("uses the configured pause time", () => {
    const c = seedSnapshot({ pauseMinutes: 15 });
    const r = runEngine(c, INITIAL_STATE, msg("x", { fromMe: true }), ctx());
    expect(r.state.pausedUntil!.getTime() - NOW.getTime()).toBe(15 * 60_000);
  });

  it("is pure: same input, same output, input untouched", () => {
    const st = { ...INITIAL_STATE };
    const a = runEngine(content, st, msg("1"), ctx());
    const b = runEngine(content, st, msg("1"), ctx());
    expect(a).toEqual(b);
    expect(st).toEqual(INITIAL_STATE);
  });
});

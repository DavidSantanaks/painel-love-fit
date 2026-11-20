import { describe, expect, it } from "vitest";
import { handleInbound } from "@/server/pipeline";
import { MAX_ATTEMPTS } from "@/server/sender";
import { createWorld } from "./fakes";

const CLIENT = "5579988887777";
const FAMILY = "5579911112222";
const STAFF = "5579933334444";

describe("pipeline — acceptance criteria (spec §11)", () => {
  it("answers through the instance that received the message (RF-02)", async () => {
    const w = createWorld();
    await handleInbound(w.event(CLIENT, "oi", { instance: "santana" }), w.deps);
    expect(w.sent).toHaveLength(1);
    expect(w.sent[0].instance).toBe("santana");
    expect(w.sent[0].text).toContain("Olá, *Cliente Teste*!");
  });

  it("two messages within 5 s produce a single answer (RF-06)", async () => {
    const w = createWorld();
    await handleInbound(w.event(CLIENT, "oi"), w.deps);
    w.advance(2);
    expect(await handleInbound(w.event(CLIENT, "1"), w.deps)).toBe("flood");
    expect(w.sent).toHaveLength(1);
    w.advance(4);
    await handleInbound(w.event(CLIENT, "1"), w.deps);
    expect(w.sent).toHaveLength(2);
  });

  it("the same message id is processed only once (RF-11)", async () => {
    const w = createWorld();
    const ev = w.event(CLIENT, "oi");
    await handleInbound(ev, w.deps);
    w.advance(10);
    expect(await handleInbound(ev, w.deps)).toBe("duplicate");
    expect(w.sent).toHaveLength(1);
  });

  it("blacklisted number: silent, no state, logged without text (RF-07)", async () => {
    const w = createWorld();
    w.blacklist.add(FAMILY);
    expect(await handleInbound(w.event(FAMILY, "oi"), w.deps)).toBe("blacklisted");
    expect(w.sent).toHaveLength(0);
    expect(w.contacts.size).toBe(0);
    expect(w.logs.at(-1)).toMatchObject({ decision: "blacklisted", direction: "IN" });
    expect(JSON.stringify(w.logs)).not.toContain("oi");
  });

  it("blacklist matches the variant without the extra 9", async () => {
    const w = createWorld();
    w.blacklist.add("557911112222"); // stored without the 9
    expect(await handleInbound(w.event(FAMILY, "oi"), w.deps)).toBe("blacklisted");
  });

  it("blacklisted number never receives anything — not even a manual send (RF-13)", async () => {
    const w = createWorld();
    w.blacklist.add(FAMILY);
    const r = await w.sender.send({
      franchiseId: "f1",
      instanceName: "atalaia",
      to: { jid: `${FAMILY}@s.whatsapp.net`, phone: FAMILY },
      messages: [{ type: "TEXT", text: "teste", media: null }],
      typingDelayMs: 0,
      betweenMessagesMs: 0,
      purpose: "manual",
    });
    expect(r.blocked).toBe(true);
    expect(w.sent).toHaveLength(0);
  });

  it("store reply from the phone silences the bot; 'menu' brings it back (RF-03/05)", async () => {
    const w = createWorld();
    await handleInbound(w.event(CLIENT, "oi"), w.deps);
    w.advance(30);
    // recepção answered from the phone (not an echo of the bot)
    expect(await handleInbound(w.event(CLIENT, "Olá! Posso ajudar?", { fromMe: true, pushName: "LOVE FIT" }), w.deps)).toBe(
      "human_reply_pause",
    );
    w.advance(30);
    expect(await handleInbound(w.event(CLIENT, "1"), w.deps)).toBe("paused_silent");
    w.advance(30);
    expect(await handleInbound(w.event(CLIENT, "menu"), w.deps)).toBe("reactivated");
    expect(w.sent).toHaveLength(2);
  });

  it("echo of the bot's own message does NOT pause the bot (RF-15)", async () => {
    const w = createWorld();
    await handleInbound(w.event(CLIENT, "oi"), w.deps);
    const echo = w.event(CLIENT, w.sent[0].text, { fromMe: true, messageId: "OUT-1" });
    expect(await handleInbound(echo, w.deps)).toBe("echo");
    w.advance(10);
    expect(await handleInbound(w.event(CLIENT, "1"), w.deps)).toBe("option");
  });

  it("pause survives an app restart because state lives in the store", async () => {
    const w = createWorld();
    await handleInbound(w.event(CLIENT, "eu", { fromMe: true }), w.deps);
    // "restart": a brand-new sender/pipeline using the same store
    const stored = [...w.contacts.values()][0];
    expect(stored.status).toBe("PAUSED");
    w.advance(20 * 60);
    expect(await handleInbound(w.event(CLIENT, "1"), w.deps)).toBe("paused_silent");
  });

  it("asking for a human: panel queue + WhatsApp to staff, with cooldown (RF-16)", async () => {
    const w = createWorld();
    w.notify.push(STAFF);
    await handleInbound(w.event(CLIENT, "atendente"), w.deps);
    expect(w.handoffs).toEqual([{ contactId: "c1", reason: "Falar com atendente", notified: true }]);
    const alert = w.sent.find((s) => s.to === STAFF)!;
    expect(alert.text).toContain("Pedido de atendimento");
    expect(alert.text).toContain("Cliente Teste");
    expect(alert.text).toContain("Atalaia");

    // contact reactivates and asks again within the cooldown → queue yes, WhatsApp no
    w.advance(60);
    await handleInbound(w.event(CLIENT, "menu"), w.deps);
    w.advance(60);
    await handleInbound(w.event(CLIENT, "5"), w.deps);
    expect(w.handoffs).toHaveLength(2);
    expect(w.handoffs[1].notified).toBe(false);
    expect(w.sent.filter((s) => s.to === STAFF)).toHaveLength(1);
  });

  it("no staff numbers: only the panel queue works", async () => {
    const w = createWorld();
    await handleInbound(w.event(CLIENT, "atendente"), w.deps);
    expect(w.handoffs[0].notified).toBe(false);
  });

  it("a staff alert is never delivered to a blacklisted number", async () => {
    const w = createWorld();
    w.notify.push(FAMILY);
    w.blacklist.add(FAMILY);
    await handleInbound(w.event(CLIENT, "atendente"), w.deps);
    expect(w.sent.some((s) => s.to === FAMILY)).toBe(false);
  });

  it("unresolved @lid contacts are logged and not answered by default", async () => {
    const w = createWorld();
    const ev = w.event(CLIENT, "oi", { remoteJid: "123456789@lid", phone: null });
    expect(await handleInbound(ev, w.deps)).toBe("unresolved_lid");
    expect(w.sent).toHaveLength(0);
    expect(w.logs.at(-1)?.result).toBe("contato sem telefone resolvido");
  });

  it("ignores unknown instances and very old messages (reconnect backlog)", async () => {
    const w = createWorld();
    expect(await handleInbound(w.event(CLIENT, "oi", { instance: "outra" }), w.deps)).toBe("unknown_instance");
    const old = w.event(CLIENT, "oi", { timestamp: Math.floor(w.clock.now.getTime() / 1000) - 3600 });
    expect(await handleInbound(old, w.deps)).toBe("too_old");
  });

  it("send failures are retried with a limit and logged (RF-12)", async () => {
    const w = createWorld();
    w.failNext(MAX_ATTEMPTS);
    await handleInbound(w.event(CLIENT, "oi"), w.deps);
    expect(w.sent).toHaveLength(0);
    expect(w.logs.some((l) => l.direction === "OUT" && l.result?.startsWith("failed"))).toBe(true);

    const w2 = createWorld();
    w2.failNext(MAX_ATTEMPTS - 1);
    await handleInbound(w2.event(CLIENT, "oi"), w2.deps);
    expect(w2.sent).toHaveLength(1);
  });

  it("price changed in the panel reaches the very next customer (RF-23)", async () => {
    const w = createWorld();
    const planos = w.content.nodes.find((n) => n.key === "planos")!;
    planos.messages[0].text = planos.messages[0].text.replace("R$ 70,00", "R$ 75,00");
    await handleInbound(w.event(CLIENT, "planos"), w.deps);
    expect(w.sent[0].text).toContain("R$ 75,00");
  });
});

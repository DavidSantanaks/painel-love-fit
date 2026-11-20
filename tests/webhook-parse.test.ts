import { describe, expect, it } from "vitest";
import { parseEvolutionWebhook } from "@/server/webhook-parse";

const payload = (data: Record<string, unknown>, event = "messages.upsert") => ({
  event,
  instance: "atalaia",
  data: { pushName: "João", messageTimestamp: 1763485200, ...data },
});

describe("parseEvolutionWebhook (RF-01)", () => {
  it("parses a plain text message", () => {
    const r = parseEvolutionWebhook(
      payload({ key: { remoteJid: "5579988887777@s.whatsapp.net", fromMe: false, id: "ABC" }, message: { conversation: "Oi" } }),
    );
    expect(r).toEqual({
      ok: true,
      events: [
        {
          instance: "atalaia",
          messageId: "ABC",
          remoteJid: "5579988887777@s.whatsapp.net",
          phone: "5579988887777",
          fromMe: false,
          text: "Oi",
          pushName: "João",
          timestamp: 1763485200,
        },
      ],
    });
  });

  it("reads extended text and captions", () => {
    const r = parseEvolutionWebhook(
      payload({ key: { remoteJid: "5579988887777@s.whatsapp.net", id: "A" }, message: { extendedTextMessage: { text: "planos" } } }),
    );
    expect(r.ok && r.events[0].text).toBe("planos");
    const r2 = parseEvolutionWebhook(
      payload({ key: { remoteJid: "5579988887777@s.whatsapp.net", id: "B" }, message: { imageMessage: { caption: "comprovante" } } }),
    );
    expect(r2.ok && r2.events[0].text).toBe("comprovante");
  });

  it("ignores other events, groups, broadcast and reactions", () => {
    expect(parseEvolutionWebhook(payload({}, "connection.update")).ok).toBe(false);
    expect(parseEvolutionWebhook(payload({ key: { remoteJid: "123@g.us", id: "A" } })).ok).toBe(false);
    expect(parseEvolutionWebhook(payload({ key: { remoteJid: "status@broadcast", id: "A" } })).ok).toBe(false);
    expect(
      parseEvolutionWebhook(payload({ key: { remoteJid: "5579988887777@s.whatsapp.net", id: "A" }, message: { reactionMessage: {} } })).ok,
    ).toBe(false);
  });

  it("accepts the MESSAGES_UPSERT spelling", () => {
    expect(parseEvolutionWebhook(payload({ key: { remoteJid: "5579988887777@s.whatsapp.net", id: "A" } }, "MESSAGES_UPSERT")).ok).toBe(true);
  });

  it("resolves @lid contacts through the alternate field", () => {
    const r = parseEvolutionWebhook(
      payload({ key: { remoteJid: "99887766@lid", remoteJidAlt: "5579988887777@s.whatsapp.net", id: "A" }, message: { conversation: "oi" } }),
    );
    expect(r.ok && r.events[0].phone).toBe("5579988887777");
    const r2 = parseEvolutionWebhook(payload({ key: { remoteJid: "99887766@lid", id: "A" }, message: { conversation: "oi" } }));
    expect(r2.ok && r2.events[0].phone).toBeNull();
  });
});

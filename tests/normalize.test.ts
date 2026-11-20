import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, normalizeText, parsePhoneList, phoneVariants } from "@/engine/normalize";

describe("normalizeText (RF-08)", () => {
  it("lowercases, strips accents and trims", () => {
    expect(normalizeText("  Preço  ")).toBe("preco");
    expect(normalizeText("MATRÍCULA")).toBe("matricula");
    expect(normalizeText("Já   sou aluno")).toBe("ja sou aluno");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("normalizePhone (§6.5)", () => {
  it("normalizes every format to the same E.164 entry", () => {
    expect(normalizePhone("(11) 97634-1183")).toBe("5511976341183");
    expect(normalizePhone("11976341183")).toBe("5511976341183");
    expect(normalizePhone("5511976341183")).toBe("5511976341183");
    expect(normalizePhone("+55 11 97634-1183")).toBe("5511976341183");
    expect(normalizePhone("5511976341183@s.whatsapp.net")).toBe("5511976341183");
  });
  it("rejects numbers with too few digits (no more endsWith false positives)", () => {
    expect(normalizePhone("1183")).toBeNull();
    expect(normalizePhone("976341183")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
  it("generates the variant with and without the extra 9", () => {
    expect(phoneVariants("5531987654321").sort()).toEqual(["553187654321", "5531987654321"].sort());
    expect(phoneVariants("553187654321").sort()).toEqual(["553187654321", "5531987654321"].sort());
  });
  it("formats for display", () => {
    expect(formatPhone("5511976341183")).toBe("+55 (11) 97634-1183");
  });
  it("parses pasted lists", () => {
    const r = parsePhoneList("(11) 97634-1183\n31 98765-4321; 123\n\n");
    expect(r.valid).toEqual(["5511976341183", "5531987654321"]);
    expect(r.invalid).toEqual(["123"]);
  });
});

import { describe, expect, it } from "vitest";
import { SEED_NODES } from "@/engine/seed-content";
import { validateSeedNodes } from "@/server/seed";

describe("seed content (exact texts of the old bot)", () => {
  it("is valid (RF-22)", () => {
    expect(validateSeedNodes(SEED_NODES)).toEqual([]);
  });
  it("has no real Pix keys or phones in the repo", () => {
    const all = JSON.stringify(SEED_NODES);
    expect(all).not.toMatch(/\d{10,}/); // phones, CPF/CNPJ-like numbers
    expect(all).toContain("[EDITAR chave Pix Atalaia]");
    expect(all).toContain("[EDITAR chave Pix Jardim Santana]");
  });
  it("import validation rejects broken files", () => {
    const broken = structuredClone(SEED_NODES);
    broken[0].options[0].target = "nao-existe";
    expect(validateSeedNodes(broken).join()).toContain("não existe");
  });
});

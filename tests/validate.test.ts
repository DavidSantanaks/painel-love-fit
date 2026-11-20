import { describe, expect, it } from "vitest";
import { validateContent, type ValidationNode } from "@/engine/validate";
import { SEED_NODES } from "@/engine/seed-content";

const seed: ValidationNode[] = SEED_NODES.map((n) => ({
  key: n.key,
  title: n.title,
  isMain: !!n.isMain,
  options: n.options.map((o) => ({ label: o.label, triggers: o.triggers, action: o.action, targetKey: o.target })),
}));

describe("validateContent (RF-22)", () => {
  it("accepts the seed", () => {
    expect(validateContent(seed)).toEqual([]);
  });
  it("rejects options pointing to a missing node", () => {
    const bad = structuredClone(seed);
    bad[0].options[0].targetKey = "nao-existe";
    expect(validateContent(bad).join()).toContain("não existe");
  });
  it("rejects repeated triggers in the same node (accent-insensitive)", () => {
    const bad = structuredClone(seed);
    bad[0].options[1].triggers.push("PREÇO");
    expect(validateContent(bad).join()).toContain("se repete");
  });
  it("requires exactly one main menu", () => {
    const none = structuredClone(seed).map((n) => ({ ...n, isMain: false }));
    expect(validateContent(none).join()).toContain("menu principal");
    const two = structuredClone(seed);
    two[1].isMain = true;
    expect(validateContent(two).join()).toContain("Só pode existir");
  });
});

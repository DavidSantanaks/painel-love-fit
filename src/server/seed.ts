/** Seeding and franchise cloning (spec §6.0 and §9). Uses a passed PrismaClient so scripts can reuse it. */
import type { PrismaClient } from "@prisma/client";
import { SEED_NODES, SEED_SETTINGS, type SeedNode } from "@/engine/seed-content";
import { validateContent } from "@/engine/validate";

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function createNodes(tx: Tx, franchiseId: string, nodes: SeedNode[]) {
    const ids = new Map<string, string>();
    for (const n of nodes) {
      const node = await tx.node.create({
        data: {
          franchiseId,
          key: n.key,
          title: n.title,
          isMain: !!n.isMain,
          showOptions: n.showOptions ?? true,
          onEnterAction: n.onEnterAction ?? "NONE",
          pauseMinutes: n.pauseMinutes ?? null,
          messages: { create: n.messages.map((text, i) => ({ franchiseId, order: i, type: "TEXT" as const, text })) },
        },
      });
      ids.set(n.key, node.id);
    }
    for (const n of nodes) {
      await tx.option.createMany({
        data: n.options.map((o, i) => ({
          franchiseId,
          nodeId: ids.get(n.key)!,
          order: i,
          label: o.label,
          triggers: o.triggers,
          action: o.action,
          targetNodeId: o.target ? ids.get(o.target) ?? null : null,
          pauseMinutes: o.pauseMinutes ?? null,
        })),
      });
    }
}

export async function seedFranchiseContent(db: PrismaClient, franchiseId: string) {
  await db.$transaction(async (tx) => {
    await createNodes(tx, franchiseId, SEED_NODES);
    await tx.settings.create({ data: { franchiseId, ...SEED_SETTINGS } });
  });
}

/** Checks a content file (same shape as SEED_NODES) against RF-22 rules. Returns error messages. */
export function validateSeedNodes(nodes: SeedNode[]): string[] {
  return validateContent(
    nodes.map((n) => ({
      key: n.key,
      title: n.title,
      isMain: !!n.isMain,
      options: n.options.map((o) => ({ label: o.label, triggers: o.triggers, action: o.action, targetKey: o.target })),
    })),
  );
}

/** Replaces ALL screens of a franchise with the given ones (settings, blacklist, contacts untouched). */
export async function replaceFranchiseContent(db: PrismaClient, franchiseId: string, nodes: SeedNode[]) {
  const errors = validateSeedNodes(nodes);
  if (errors.length) throw new Error("Conteúdo inválido:\n- " + errors.join("\n- "));
  await db.$transaction(async (tx) => {
    await tx.node.deleteMany({ where: { franchiseId } });
    await createNodes(tx, franchiseId, nodes);
  });
}

/** Idempotent: creates the base LOVE FIT franchise with the current screens only when no franchise exists. */
export async function ensureSeed(db: PrismaClient): Promise<{ created: boolean; franchiseId: string }> {
  const existing = await db.franchise.findFirst({ where: { isTemplate: true } });
  if (existing) return { created: false, franchiseId: existing.id };
  const f = await db.franchise.create({ data: { name: "LOVE FIT", slug: "lovefit", isTemplate: true } });
  await seedFranchiseContent(db, f.id);
  return { created: true, franchiseId: f.id };
}

/**
 * New franchise = copy of the template's screens, options, media references and settings.
 * Blacklist, staff numbers, instances, users and contacts start empty — never copied.
 */
export async function cloneFranchise(db: PrismaClient, name: string, slug: string) {
  const template = await db.franchise.findFirst({ where: { isTemplate: true } });
  if (!template) throw new Error("No template franchise. Run the seed first.");
  return db.$transaction(async (tx) => {
    const f = await tx.franchise.create({ data: { name, slug } });
    const nodes = await tx.node.findMany({ where: { franchiseId: template.id }, include: { messages: true, options: true } });
    const media = await tx.media.findMany({ where: { franchiseId: template.id } });
    const mediaMap = new Map<string, string>();
    for (const m of media) {
      const copy = await tx.media.create({
        data: { franchiseId: f.id, fileName: m.fileName, mimeType: m.mimeType, size: m.size, storagePath: m.storagePath },
      });
      mediaMap.set(m.id, copy.id);
    }
    const nodeMap = new Map<string, string>();
    for (const n of nodes) {
      const copy = await tx.node.create({
        data: {
          franchiseId: f.id,
          key: n.key,
          title: n.title,
          isMain: n.isMain,
          showOptions: n.showOptions,
          onEnterAction: n.onEnterAction,
          pauseMinutes: n.pauseMinutes,
          messages: {
            create: n.messages.map((m) => ({
              franchiseId: f.id,
              order: m.order,
              type: m.type,
              text: m.text,
              mediaId: m.mediaId ? mediaMap.get(m.mediaId) ?? null : null,
            })),
          },
        },
      });
      nodeMap.set(n.id, copy.id);
    }
    for (const n of nodes) {
      if (!n.options.length) continue;
      await tx.option.createMany({
        data: n.options.map((o) => ({
          franchiseId: f.id,
          nodeId: nodeMap.get(n.id)!,
          order: o.order,
          label: o.label,
          triggers: o.triggers,
          action: o.action,
          targetNodeId: o.targetNodeId ? nodeMap.get(o.targetNodeId) ?? null : null,
          pauseMinutes: o.pauseMinutes,
        })),
      });
    }
    const s = await tx.settings.findUniqueOrThrow({ where: { franchiseId: template.id } });
    const { franchiseId: _omit, updatedAt: _u, ...rest } = s;
    await tx.settings.create({ data: { ...rest, franchiseId: f.id } });
    return f;
  });
}

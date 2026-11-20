/** Screen (node) editing with whole-content validation (RF-22). */
import { z } from "zod";
import { validateContent, type ValidationNode } from "@/engine/validate";
import { HttpError } from "./api";
import { prisma } from "./db";

export const nodeInput = z.object({
  key: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(100),
  isMain: z.boolean().default(false),
  showOptions: z.boolean().default(true),
  onEnterAction: z.enum(["NONE", "CALL_HUMAN", "PAUSE"]).default("NONE"),
  pauseMinutes: z.number().int().min(1).max(60 * 24 * 7).nullable().default(null),
  messages: z
    .array(
      z.object({
        type: z.enum(["TEXT", "IMAGE", "DOCUMENT"]),
        text: z.string().max(4000).default(""),
        mediaId: z.string().nullable().default(null),
      }),
    )
    .max(10),
  options: z
    .array(
      z.object({
        label: z.string().trim().max(100),
        triggers: z.array(z.string().trim().max(60)).max(20),
        action: z.enum(["GO_TO", "CALL_HUMAN", "PAUSE", "NONE"]),
        targetKey: z.string().nullable().default(null),
        pauseMinutes: z.number().int().min(1).max(60 * 24 * 7).nullable().default(null),
      }),
    )
    .max(30),
});
export type NodeInput = z.infer<typeof nodeInput>;

async function currentValidationNodes(franchiseId: string) {
  const nodes = await prisma.node.findMany({
    where: { franchiseId },
    include: { options: { orderBy: { order: "asc" }, include: { target: { select: { key: true } } } } },
  });
  return nodes.map((n) => ({
    id: n.id,
    v: {
      key: n.key,
      title: n.title,
      isMain: n.isMain,
      options: n.options.map((o) => ({ label: o.label, triggers: o.triggers, action: o.action, targetKey: o.target?.key ?? null })),
    } satisfies ValidationNode,
  }));
}

export async function saveNode(franchiseId: string, nodeId: string | null, raw: unknown) {
  const input = nodeInput.parse(raw);
  input.key = input.key.toLowerCase();
  input.options = input.options.map((o) => ({ ...o, triggers: o.triggers.filter(Boolean) }));
  input.messages = input.messages.filter((m) => (m.type === "TEXT" ? m.text.trim() : m.mediaId));

  const existing = await currentValidationNodes(franchiseId);
  if (nodeId && !existing.some((e) => e.id === nodeId)) throw new HttpError(404, "Tela não encontrada.");
  const oldKey = existing.find((e) => e.id === nodeId)?.v.key;

  const proposed: ValidationNode[] = existing
    .filter((e) => e.id !== nodeId)
    .map((e) => ({
      ...e.v,
      isMain: input.isMain ? false : e.v.isMain,
      // other screens keep pointing to this one even if its key changes
      options: e.v.options.map((o) => ({ ...o, targetKey: oldKey && o.targetKey === oldKey ? input.key : o.targetKey })),
    }));
  proposed.push({ key: input.key, title: input.title, isMain: input.isMain, options: input.options });

  const errors = validateContent(proposed);
  if (errors.length) throw new HttpError(400, errors.join("\n"));

  const mediaIds = input.messages.map((m) => m.mediaId).filter((x): x is string => !!x);
  if (mediaIds.length) {
    const found = await prisma.media.count({ where: { franchiseId, id: { in: mediaIds } } });
    if (found !== new Set(mediaIds).size) throw new HttpError(400, "Arquivo de mídia não encontrado.");
  }

  return prisma.$transaction(async (tx) => {
    if (input.isMain) await tx.node.updateMany({ where: { franchiseId, isMain: true, NOT: nodeId ? { id: nodeId } : undefined }, data: { isMain: false } });
    const data = {
      key: input.key,
      title: input.title,
      isMain: input.isMain,
      showOptions: input.showOptions,
      onEnterAction: input.onEnterAction,
      pauseMinutes: input.pauseMinutes,
    };
    const node = nodeId
      ? await tx.node.update({ where: { id: nodeId }, data })
      : await tx.node.create({ data: { ...data, franchiseId } });

    await tx.nodeMessage.deleteMany({ where: { nodeId: node.id } });
    await tx.option.deleteMany({ where: { nodeId: node.id } });
    if (input.messages.length) {
      await tx.nodeMessage.createMany({
        data: input.messages.map((m, i) => ({
          franchiseId,
          nodeId: node.id,
          order: i,
          type: m.type,
          text: m.text,
          mediaId: m.type === "TEXT" ? null : m.mediaId,
        })),
      });
    }
    const keyToId = new Map((await tx.node.findMany({ where: { franchiseId }, select: { id: true, key: true } })).map((n) => [n.key, n.id]));
    if (input.options.length) {
      await tx.option.createMany({
        data: input.options.map((o, i) => ({
          franchiseId,
          nodeId: node.id,
          order: i,
          label: o.label,
          triggers: o.triggers,
          action: o.action,
          targetNodeId: o.targetKey ? keyToId.get(o.targetKey) ?? null : null,
          pauseMinutes: o.pauseMinutes,
        })),
      });
    }
    return node;
  });
}

export async function deleteNode(franchiseId: string, nodeId: string) {
  const node = await prisma.node.findFirst({ where: { id: nodeId, franchiseId } });
  if (!node) throw new HttpError(404, "Tela não encontrada.");
  if (node.isMain) throw new HttpError(400, "Não é possível excluir o menu principal.");
  const refs = await prisma.option.findMany({
    where: { franchiseId, targetNodeId: nodeId, NOT: { nodeId } },
    include: { node: { select: { title: true } } },
  });
  if (refs.length) {
    throw new HttpError(400, `Esta tela é destino de: ${refs.map((r) => `"${r.node.title}" → "${r.label}"`).join(", ")}. Altere essas opções antes.`);
  }
  await prisma.node.delete({ where: { id: nodeId } });
  return node;
}

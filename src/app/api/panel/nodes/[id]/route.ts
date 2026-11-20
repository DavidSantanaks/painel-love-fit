import { panelRoute } from "@/server/api";
import { audit } from "@/server/audit";
import { deleteNode, saveNode } from "@/server/content";

export const PUT = panelRoute<{ id: string }>(async (req, ctx, { id }) => {
  const node = await saveNode(ctx.franchiseId, id, await req.json());
  await audit(ctx, "tela", node.title, "editou");
  return { id: node.id };
});

export const DELETE = panelRoute<{ id: string }>(async (_req, ctx, { id }) => {
  const node = await deleteNode(ctx.franchiseId, id);
  await audit(ctx, "tela", node.title, "excluiu");
  return { ok: true };
});

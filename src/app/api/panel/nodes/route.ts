import { panelRoute } from "@/server/api";
import { audit } from "@/server/audit";
import { saveNode } from "@/server/content";

export const POST = panelRoute(async (req, ctx) => {
  const node = await saveNode(ctx.franchiseId, null, await req.json());
  await audit(ctx, "tela", node.title, "criou");
  return { id: node.id };
});

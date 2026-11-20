import { notFound } from "next/navigation";
import { NodeEditor, type EditorNode } from "@/components/NodeEditor";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";
import { parseHours } from "@/server/deps";

export const dynamic = "force-dynamic";

export default async function EditTela({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage();
  const [all, media, instance, settings] = await Promise.all([
    prisma.node.findMany({ where: { franchiseId: ctx.franchiseId }, select: { id: true, key: true, title: true }, orderBy: { title: "asc" } }),
    prisma.media.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "desc" } }),
    prisma.instance.findFirst({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "asc" } }),
    prisma.settings.findUnique({ where: { franchiseId: ctx.franchiseId } }),
  ]);

  let node: EditorNode;
  if (id === "nova") {
    node = {
      id: null,
      key: "",
      title: "",
      isMain: false,
      showOptions: true,
      onEnterAction: "NONE",
      pauseMinutes: null,
      messages: [{ type: "TEXT", text: "", mediaId: null }],
      options: [{ label: "Voltar ao menu", triggers: ["0", "voltar"], action: "GO_TO", targetKey: all.length ? (await prisma.node.findFirst({ where: { franchiseId: ctx.franchiseId, isMain: true } }))?.key ?? null : null, pauseMinutes: null }],
    };
  } else {
    const n = await prisma.node.findFirst({
      where: { id, franchiseId: ctx.franchiseId },
      include: { messages: { orderBy: { order: "asc" } }, options: { orderBy: { order: "asc" }, include: { target: { select: { key: true } } } } },
    });
    if (!n) notFound();
    node = {
      id: n.id,
      key: n.key,
      title: n.title,
      isMain: n.isMain,
      showOptions: n.showOptions,
      onEnterAction: n.onEnterAction,
      pauseMinutes: n.pauseMinutes,
      messages: n.messages.map((m) => ({ type: m.type, text: m.text, mediaId: m.mediaId })),
      options: n.options.map((o) => ({ label: o.label, triggers: o.triggers, action: o.action, targetKey: o.target?.key ?? null, pauseMinutes: o.pauseMinutes })),
    };
  }

  return (
    <NodeEditor
      initial={node}
      nodes={all.filter((x) => x.id !== node.id).map((x) => ({ key: x.key, title: x.title }))}
      media={media.map((m) => ({ id: m.id, fileName: m.fileName, mimeType: m.mimeType }))}
      unitName={instance?.unitName ?? "Atalaia"}
      hours={parseHours(instance?.hours)}
      defaultPause={settings?.pauseMinutes ?? 60}
      timezone={process.env.TIMEZONE ?? "America/Sao_Paulo"}
    />
  );
}

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const ACTION: Record<string, string> = { CALL_HUMAN: "chama atendente", PAUSE: "pausa o bot" };

export default async function TelasPage() {
  const ctx = await requirePage();
  const nodes = await prisma.node.findMany({
    where: { franchiseId: ctx.franchiseId },
    include: { options: { orderBy: { order: "asc" } }, _count: { select: { messages: true } } },
    orderBy: [{ isMain: "desc" }, { title: "asc" }],
  });
  return (
    <>
      <PageHeader
        title="Telas e menus"
        subtitle="Cada tela é uma resposta do bot. As mudanças valem para o próximo cliente, sem reiniciar nada."
        actions={
          <Link className="btn-primary" href="/painel/telas/nova">
            + Nova tela
          </Link>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((n) => (
          <Link key={n.id} href={`/painel/telas/${n.id}`} className="card group p-4 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-bold group-hover:text-brand-700">{n.title}</div>
                <div className="truncate font-mono text-xs text-ink-400">{n.key}</div>
              </div>
              {n.isMain && <span className="badge bg-brand-50 text-brand-700">Menu principal</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {n.options.slice(0, 6).map((o) => (
                <span key={o.id} className="badge bg-ink-50 text-ink-600">
                  {o.triggers[0] ? <b className="text-ink-900">{o.triggers[0]}</b> : null} {o.label}
                </span>
              ))}
              {n.options.length > 6 && <span className="badge bg-ink-50 text-ink-400">+{n.options.length - 6}</span>}
            </div>
            <div className="mt-3 text-xs text-ink-400">
              {n._count.messages} mensagem(ns) · {n.options.length} opção(ões)
              {ACTION[n.onEnterAction] ? ` · ao entrar: ${ACTION[n.onEnterAction]}` : ""}
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

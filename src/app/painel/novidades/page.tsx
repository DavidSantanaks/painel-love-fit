import { PageHeader } from "@/components/ui";
import { requirePage } from "@/server/auth";
import { CHANGELOG } from "./changelog";

export const dynamic = "force-dynamic";

const TAG = {
  novo: "bg-emerald-50 text-emerald-700",
  melhoria: "bg-brand-50 text-brand-700",
  correção: "bg-amber-50 text-amber-700",
} as const;

const fmt = (iso: string) => iso.split("-").reverse().join("/");

export default async function NovidadesPage() {
  await requirePage();
  return (
    <>
      <PageHeader title="Novidades" subtitle="O que saiu no painel e no bot, da mais recente para a mais antiga." />
      <div className="max-w-3xl space-y-5">
        {CHANGELOG.map((r, idx) => (
          <section key={r.date + r.title} className="card p-5">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold">
                {r.title} {idx === 0 && <span className="badge ml-1 bg-brand-50 text-brand-700">mais recente</span>}
              </h2>
              <span className="text-xs text-ink-400">{fmt(r.date)}</span>
            </div>
            <ul className="space-y-2">
              {r.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`badge mt-0.5 shrink-0 ${TAG[it.tag]}`}>{it.tag}</span>
                  <span>{it.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

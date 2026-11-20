import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { evolution } from "@/server/evolution";

export const dynamic = "force-dynamic";

const DAYS = 14;

function dayKeys(tz: string): string[] {
  const out: string[] = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    out.push(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(Date.now() - i * 86_400_000)));
  }
  return out;
}

export default async function Dashboard() {
  const ctx = await requirePage();
  const tz = env().TIMEZONE;
  const fid = ctx.franchiseId;
  const since30 = new Date(Date.now() - 30 * 86_400_000);

  const [rows, topOptions, handoffs30, fallback30, openQueue, notifyCount, instances] = await Promise.all([
    prisma.$queryRaw<{ d: string; inst: string; dir: "IN" | "OUT"; c: number }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS d,
             "instanceName" AS inst, direction::text AS dir, count(*)::int AS c
      FROM "MessageLog"
      WHERE "franchiseId" = ${fid}
        AND "createdAt" > now() - interval '15 days'
        AND ((direction = 'IN' AND decision NOT IN ('blacklisted', 'unresolved_lid'))
          OR (direction = 'OUT' AND result = 'sent'))
      GROUP BY 1, 2, 3`,
    prisma.messageLog.groupBy({
      by: ["optionLabel"],
      where: { franchiseId: fid, createdAt: { gte: since30 }, optionLabel: { not: null }, direction: "IN" },
      _count: { _all: true },
      orderBy: { _count: { optionLabel: "desc" } },
      take: 6,
    }),
    prisma.handoffRequest.count({ where: { franchiseId: fid, createdAt: { gte: since30 } } }),
    prisma.messageLog.count({ where: { franchiseId: fid, createdAt: { gte: since30 }, decision: "fallback" } }),
    prisma.handoffRequest.count({ where: { franchiseId: fid, resolvedAt: null } }),
    prisma.notifyNumber.count({ where: { franchiseId: fid } }),
    prisma.instance.findMany({ where: { franchiseId: fid }, orderBy: { createdAt: "asc" } }),
  ]);
  const states = await Promise.all(instances.map((i) => evolution.connectionState(i.name)));

  const days = dayKeys(tz);
  const today = days[days.length - 1];
  const units = [...new Set(rows.map((r) => r.inst))];
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, r) => a + r.c, 0);
  const max = Math.max(1, ...days.map((d) => sum((r) => r.d === d && r.dir === "IN")));
  const COLORS = ["bg-brand-500", "bg-amber-400", "bg-sky-500", "bg-emerald-500", "bg-violet-500"];
  const topMax = Math.max(1, ...topOptions.map((t) => t._count._all));

  const kpis = [
    { label: "Recebidas hoje", value: sum((r) => r.d === today && r.dir === "IN") },
    { label: "Enviadas hoje", value: sum((r) => r.d === today && r.dir === "OUT") },
    { label: "Fila de atendimento", value: openQueue, href: "/painel/conversas", hot: openQueue > 0 },
    { label: "Pedidos de atendente (30d)", value: handoffs30 },
    { label: "Caíram no menu (30d)", value: fallback30 },
  ];

  return (
    <>
      <PageHeader title="Visão geral" subtitle="Movimento do bot e situação dos números de WhatsApp." />

      <div className="mb-6 space-y-2">
        {notifyCount === 0 && (
          <Link href="/painel/configuracoes" className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ Nenhum número de aviso da equipe cadastrado: pedidos de atendente só aparecem aqui no painel. <b>Cadastrar →</b>
          </Link>
        )}
        {instances.length === 0 && (
          <Link href="/painel/instancias" className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            ⚠️ Nenhuma instância de WhatsApp cadastrada. <b>Conectar WhatsApp →</b>
          </Link>
        )}
        {instances.map((i, idx) =>
          states[idx] !== "open" ? (
            <Link key={i.id} href="/painel/instancias" className="block rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              🔌 O WhatsApp <b>{i.unitName}</b> ({i.name}) não está conectado. <b>Ver QR Code →</b>
            </Link>
          ) : null,
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {kpis.map((k) => {
          const inner = (
            <div className={`card h-full p-4 transition ${k.hot ? "border-brand-200 bg-brand-50" : ""} ${k.href ? "hover:-translate-y-0.5 hover:shadow-md" : ""}`}>
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">{k.label}</div>
              <div className={`mt-2 text-3xl font-extrabold tabular-nums ${k.hot ? "text-brand-600" : "text-ink-900"}`}>{k.value}</div>
            </div>
          );
          return k.href ? (
            <Link key={k.label} href={k.href}>
              {inner}
            </Link>
          ) : (
            <div key={k.label}>{inner}</div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Mensagens recebidas por dia</h2>
            <div className="flex flex-wrap gap-3 text-xs text-ink-500">
              {units.map((u, i) => (
                <span key={u} className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-sm ${COLORS[i % COLORS.length]}`} />
                  {instances.find((x) => x.name === u)?.unitName ?? u}
                </span>
              ))}
            </div>
          </div>
          <div className="flex h-48 items-end gap-1.5">
            {days.map((d) => {
              const total = sum((r) => r.d === d && r.dir === "IN");
              const sent = sum((r) => r.d === d && r.dir === "OUT");
              return (
                <div key={d} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.slice(8)}/${d.slice(5, 7)}: ${total} recebidas, ${sent} enviadas`}>
                  <div className="flex flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(total / max) * 100}%` }}>
                    {units.map((u, i) => {
                      const c = sum((r) => r.d === d && r.inst === u && r.dir === "IN");
                      return c ? <div key={u} className={COLORS[i % COLORS.length]} style={{ height: `${(c / Math.max(total, 1)) * 100}%` }} /> : null;
                    })}
                  </div>
                  {total === 0 && <div className="h-1 rounded bg-ink-100" />}
                  <div className="mt-1 text-center text-[10px] text-ink-400">{d.slice(8)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-bold">Opções mais escolhidas (30d)</h2>
          {topOptions.length === 0 ? (
            <p className="text-sm text-ink-400">Ainda sem dados.</p>
          ) : (
            <ul className="space-y-3">
              {topOptions.map((t) => (
                <li key={t.optionLabel}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="truncate">{t.optionLabel}</span>
                    <span className="font-semibold tabular-nums">{t._count._all}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-100">
                    <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(t._count._all / topMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5 lg:col-span-3">
          <h2 className="mb-3 font-bold">Números de WhatsApp</h2>
          <div className="flex flex-wrap gap-3">
            {instances.map((i, idx) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-2.5">
                <span className="font-semibold">{i.unitName}</span>
                <span className="text-xs text-ink-400">{i.name}</span>
                <StatusBadge status={states[idx]} />
              </div>
            ))}
            {instances.length === 0 && <p className="text-sm text-ink-400">Nenhum número cadastrado.</p>}
          </div>
        </section>
      </div>
    </>
  );
}

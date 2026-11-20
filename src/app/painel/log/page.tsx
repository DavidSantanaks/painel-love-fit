import { PageHeader } from "@/components/ui";
import { formatPhone } from "@/engine/normalize";
import { requirePage } from "@/server/auth";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

const DECISION: Record<string, string> = {
  fallback: "menu (não reconheceu)", option: "opção", menu: "menu", reactivated: "reativou o bot", paused_silent: "pausado (silêncio)",
  human_reply_pause: "recepção respondeu → pausa", staff_command_pause: "comando da equipe → pausa", ignored_no_text: "sem texto",
  blacklisted: "blacklist (ignorado)", flood: "anti-flood (ignorado)", unresolved_lid: "sem telefone resolvido",
  reply: "resposta", notify: "aviso à equipe", manual: "envio manual", blocked_reply: "BLOQUEADO (resposta)", blocked_notify: "BLOQUEADO (aviso)", blocked_manual: "BLOQUEADO (manual)",
};

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: process.env.TIMEZONE ?? "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default async function LogPage() {
  const ctx = await requirePage();
  const [logs, audits] = await Promise.all([
    prisma.messageLog.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.auditLog.findMany({ where: { franchiseId: ctx.franchiseId }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return (
    <>
      <PageHeader title="Log e auditoria" subtitle="Só metadados: nunca o texto das mensagens dos clientes." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="card overflow-hidden">
          <div className="p-4 font-bold">Mensagens recentes</div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white"><tr><th className="th">Quando</th><th className="th">Número</th><th className="th">Contato</th><th className="th">Decisão</th><th className="th">Tela / resultado</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="td whitespace-nowrap text-xs text-ink-500">{fmt(l.createdAt)}</td>
                    <td className="td text-xs">{l.direction === "IN" ? "⬇" : "⬆"} {l.instanceName}</td>
                    <td className="td whitespace-nowrap font-mono text-xs">{formatPhone(l.contactPhone)}</td>
                    <td className={`td text-xs ${l.decision.startsWith("blocked") || l.result?.startsWith("failed") ? "font-semibold text-red-600" : ""}`}>{DECISION[l.decision] ?? l.decision}</td>
                    <td className="td text-xs text-ink-500">{[l.optionLabel, l.nodeKey, l.result].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="p-4 text-sm text-ink-400">Sem registros ainda.</p>}
          </div>
        </section>
        <section className="card overflow-hidden">
          <div className="p-4 font-bold">Quem editou o quê</div>
          <ul className="max-h-[70vh] divide-y divide-ink-100 overflow-auto">
            {audits.map((a) => (
              <li key={a.id} className="px-4 py-3 text-sm">
                <div><b>{a.userEmail}</b> {a.action} <span className="text-ink-500">{a.entity}</span></div>
                <div className="truncate text-ink-700">{a.entityName}</div>
                <div className="text-xs text-ink-400">{fmt(a.createdAt)}</div>
              </li>
            ))}
            {audits.length === 0 && <li className="p-4 text-sm text-ink-400">Nenhuma edição ainda.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./client";
import { Empty, PageHeader, useAction, useToast } from "./ui";

interface Entry { id: string; phone: string; label: string; note: string; createdAt: string }

export function Blacklist({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const toast = useToast();
  const { busy, run } = useAction();
  const [raw, setRaw] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");

  async function add() {
    const r = await run(() =>
      api<{ added: number; duplicates: string[]; invalid: string[]; removedFromNotify: string[] }>("/api/panel/blacklist", "POST", { raw, label, note }),
    );
    if (!r) return;
    const parts = [`${r.added} número(s) adicionado(s).`];
    if (r.duplicates.length) parts.push(`Já existiam (recusados): ${r.duplicates.join(", ")}`);
    if (r.invalid.length) parts.push(`Inválidos: ${r.invalid.join(", ")}`);
    if (r.removedFromNotify.length) parts.push(`Removidos dos números de aviso: ${r.removedFromNotify.join(", ")}`);
    toast(r.duplicates.length || r.invalid.length ? "err" : "ok", parts.join("\n"));
    setRaw("");
    setLabel("");
    setNote("");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Blacklist"
        subtitle="Números com os quais o bot nunca interage: não responde, não avisa e não envia nada, nem manualmente. Sem exceções."
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="card h-fit p-5">
          <h2 className="mb-1 font-bold">Adicionar números</h2>
          <p className="mb-4 text-xs text-ink-500">
            Um número ou uma lista (um por linha). Qualquer formato: (11) 97634-1183, 11976341183 ou 5511976341183. A versão com e sem o 9 é bloqueada automaticamente.
          </p>
          <label className="label">Número(s)</label>
          <textarea className="input mb-3 min-h-[120px] font-mono" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={"(79) 99999-0000\n79 98888-1111"} />
          <label className="label">Rótulo</label>
          <input className="input mb-3" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Dono / Pix Atalaia" />
          <label className="label">Observação</label>
          <input className="input mb-4" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary w-full" disabled={busy || !raw.trim()} onClick={add}>Adicionar à blacklist</button>
        </section>

        <section className="card overflow-hidden">
          <div className="p-4 font-bold">{entries.length} número(s) bloqueado(s)</div>
          {entries.length === 0 ? (
            <div className="p-4"><Empty>Nenhum número na blacklist.</Empty></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr><th className="th">Número</th><th className="th">Rótulo</th><th className="th">Observação</th><th className="th">Desde</th><th className="th" /></tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td className="td font-mono">{e.phone}</td>
                      <td className="td">{e.label || <span className="text-ink-300">—</span>}</td>
                      <td className="td text-ink-500">{e.note || <span className="text-ink-300">—</span>}</td>
                      <td className="td text-ink-500">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="td text-right">
                        <button
                          className="text-xs font-semibold text-red-600 hover:underline"
                          disabled={busy}
                          onClick={async () => {
                            if (!confirm(`Remover ${e.phone} da blacklist? O bot passará a responder este número.`)) return;
                            if (await run(() => api(`/api/panel/blacklist/${e.id}`, "DELETE"), "Removido da blacklist.")) router.refresh();
                          }}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

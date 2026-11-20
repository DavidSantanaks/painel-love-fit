"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./client";
import { Empty, Modal, PageHeader, StatusBadge, useAction } from "./ui";

interface QueueItem { id: string; contactId: string; name: string; phone: string; unit: string; reason: string; notified: boolean; createdAt: string }
interface ContactItem { id: string; name: string; phone: string; unit: string; status: string; pausedUntil: string | null; node: string | null; updatedAt: string }

const time = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function Conversations({ queue, contacts }: { queue: QueueItem[]; contacts: ContactItem[] }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [filter, setFilter] = useState("");
  const [sendTo, setSendTo] = useState<ContactItem | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router]);

  const act = async (id: string, body: object, ok: string) => {
    if (await run(() => api(`/api/panel/contacts/${id}`, "POST", body), ok)) router.refresh();
  };

  const list = contacts.filter((c) => !filter || `${c.name} ${c.phone} ${c.unit}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageHeader title="Conversas" subtitle="Fila de quem pediu atendente e situação do bot com cada contato. Atualiza sozinho a cada 20 s." />

      <section className="mb-8">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          Pediram atendente <span className="badge bg-brand-50 text-brand-700">{queue.length}</span>
        </h2>
        {queue.length === 0 ? (
          <Empty>Ninguém aguardando. 🎉</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {queue.map((q) => (
              <div key={q.id} className="card flex flex-col gap-3 border-brand-100 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{q.name || "Sem nome"}</div>
                    <div className="text-sm text-ink-500">{q.phone} · {q.unit}</div>
                  </div>
                  <span className="text-xs text-ink-400">{time(q.createdAt)}</span>
                </div>
                <div className="text-sm">
                  Pediu: <b>{q.reason}</b>
                  {!q.notified && <span className="ml-2 text-xs text-amber-700">(sem aviso no WhatsApp)</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => act(q.contactId, { action: "activate" }, "Atendimento concluído e bot reativado.")}>
                    Concluir e reativar bot
                  </button>
                  <button
                    className="btn-ghost px-3 py-1.5 text-xs"
                    disabled={busy}
                    onClick={async () => {
                      if (await run(() => api(`/api/panel/handoffs/${q.id}`, "POST"), "Removido da fila (bot continua pausado).")) router.refresh();
                    }}
                  >
                    Só tirar da fila
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <h2 className="font-bold">Contatos recentes</h2>
          <input className="input max-w-xs" placeholder="Buscar nome, telefone ou unidade" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {list.length === 0 ? (
          <div className="p-4"><Empty>Nenhum contato ainda.</Empty></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr><th className="th">Contato</th><th className="th">Unidade</th><th className="th">Situação</th><th className="th">Última atividade</th><th className="th text-right">Ações</th></tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50/60">
                    <td className="td"><div className="font-semibold">{c.name || "Sem nome"}</div><div className="text-xs text-ink-400">{c.phone}</div></td>
                    <td className="td">{c.unit}</td>
                    <td className="td">
                      <StatusBadge status={c.status} />
                      {c.status !== "ACTIVE" && c.pausedUntil && <div className="mt-1 text-xs text-ink-400">até {time(c.pausedUntil)}</div>}
                    </td>
                    <td className="td text-ink-500">{time(c.updatedAt)}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        {c.status === "ACTIVE" ? (
                          <button className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => act(c.id, { action: "pause" }, "Bot pausado para este contato.")}>Pausar bot</button>
                        ) : (
                          <button className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => act(c.id, { action: "activate" }, "Bot reativado.")}>Reativar bot</button>
                        )}
                        <button className="btn-ghost px-2.5 py-1 text-xs" onClick={() => { setSendTo(c); setText(""); }}>Enviar mensagem</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={!!sendTo} onClose={() => setSendTo(null)} title={`Mensagem para ${sendTo?.name || sendTo?.phone || ""}`}>
        <p className="mb-3 text-xs text-ink-500">Sai pelo número da unidade {sendTo?.unit}. Depois do envio, o bot fica pausado com este contato.</p>
        <textarea className="input mb-4 min-h-[120px]" value={text} onChange={(e) => setText(e.target.value)} />
        <button
          className="btn-primary w-full"
          disabled={busy || !text.trim()}
          onClick={async () => {
            if (!sendTo) return;
            if (await run(() => api(`/api/panel/contacts/${sendTo.id}`, "POST", { action: "send", text }), "Mensagem enviada.")) {
              setSendTo(null);
              router.refresh();
            }
          }}
        >
          Enviar
        </button>
      </Modal>
    </>
  );
}

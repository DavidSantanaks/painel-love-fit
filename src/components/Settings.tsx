"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatHours } from "@/engine/render";
import { api } from "./client";
import { ExceptionsEditor, HoursEditor, type Inst } from "./Instances";
import { Modal, PageHeader, useAction } from "./ui";

interface S {
  pauseMinutes: number;
  floodWindowSeconds: number;
  typingDelayMs: number;
  betweenMessagesMs: number;
  reactivationWords: string[];
  staffCommands: string[];
  notifyCooldownMinutes: number;
  retentionDays: number;
  outOfHoursMessage: string;
  respondUnresolvedLid: boolean;
}

function Num({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

export function Settings({ settings, notify, instances }: { settings: S; notify: { id: string; phone: string; label: string }[]; instances: Inst[] }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [s, setS] = useState(settings);
  const [words, setWords] = useState({ r: settings.reactivationWords.join(", "), c: settings.staffCommands.join(", ") });
  const [nf, setNf] = useState({ phone: "", label: "" });
  const [editing, setEditing] = useState<Inst | null>(null);
  const [exc, setExc] = useState<Inst | null>(null);
  const set = (p: Partial<S>) => setS((x) => ({ ...x, ...p }));
  const split = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="Valem na hora para todos os números desta franquia."
        actions={
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => run(() => api("/api/panel/settings", "PUT", { ...s, reactivationWords: split(words.r), staffCommands: split(words.c) }), "Configurações salvas.")}
          >
            Salvar configurações
          </button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <h2 className="font-bold">Comportamento do bot</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num label="Pausa automática (min)" hint="Quando a recepção responde pelo celular." value={s.pauseMinutes} onChange={(v) => set({ pauseMinutes: v })} />
            <Num label="Anti-flood (segundos)" hint="Mensagens nesse intervalo são ignoradas." value={s.floodWindowSeconds} onChange={(v) => set({ floodWindowSeconds: v })} />
            <Num label="Digitando… (ms)" hint="Atraso antes da 1ª mensagem." value={s.typingDelayMs} onChange={(v) => set({ typingDelayMs: v })} />
            <Num label="Entre mensagens (ms)" value={s.betweenMessagesMs} onChange={(v) => set({ betweenMessagesMs: v })} />
            <Num label="Intervalo entre avisos (min)" hint="Por contato, para não lotar o celular da equipe." value={s.notifyCooldownMinutes} onChange={(v) => set({ notifyCooldownMinutes: v })} />
            <Num label="Guardar log por (dias)" hint="Só metadados, nunca o texto." value={s.retentionDays} onChange={(v) => set({ retentionDays: v })} />
          </div>
          <div>
            <label className="label">Palavras de reativação</label>
            <input className="input" value={words.r} onChange={(e) => setWords({ ...words, r: e.target.value })} />
            <p className="mt-1 text-xs text-ink-400">O cliente digita uma delas para o bot voltar durante uma pausa.</p>
          </div>
          <div>
            <label className="label">Comandos da equipe</label>
            <input className="input" value={words.c} onChange={(e) => setWords({ ...words, c: e.target.value })} />
            <p className="mt-1 text-xs text-ink-400">Enviados do celular da loja na conversa, pausam o bot para aquele contato.</p>
          </div>
          <div>
            <label className="label">Mensagem fora do expediente</label>
            <textarea className="input min-h-[100px]" value={s.outOfHoursMessage} onChange={(e) => set({ outOfHoursMessage: e.target.value })} />
            <p className="mt-1 text-xs text-ink-400">Enviada quando o cliente pede atendente com a unidade fechada (pelo horário semanal). Para feriados, use “Feriados / datas especiais” em Horário de funcionamento: lá cada data tem a sua mensagem. Vazio = não envia.</p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-brand-600" checked={s.respondUnresolvedLid} onChange={(e) => set({ respondUnresolvedLid: e.target.checked })} />
            <span>
              Responder contatos sem telefone identificado (@lid).
              <span className="block text-xs text-ink-400">Desligado = mais seguro: sem o telefone, o app não consegue conferir a blacklist.</span>
            </span>
          </label>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-bold">Números de aviso da equipe</h2>
              {notify.length > 0 && (
                <button className="btn-ghost px-2.5 py-1 text-xs" disabled={busy} onClick={() => run(() => api<{ sent: number }>("/api/panel/notify-test", "POST"), "Aviso de teste enviado.")}>
                  Enviar teste
                </button>
              )}
            </div>
            <p className="mb-4 text-xs text-ink-500">Recebem um WhatsApp quando alguém pede atendente. Números da blacklist são recusados.</p>
            {notify.length === 0 && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum cadastrado: só a fila do painel funciona.</div>}
            <ul className="mb-4 divide-y divide-ink-100">
              {notify.map((n) => (
                <li key={n.id} className="flex items-center justify-between py-2 text-sm">
                  <span><b className="font-mono">{n.phone}</b> {n.label && <span className="text-ink-500">— {n.label}</span>}</span>
                  <button
                    className="text-xs font-semibold text-red-600 hover:underline"
                    onClick={async () => {
                      if (await run(() => api(`/api/panel/notify/${n.id}`, "DELETE"), "Removido.")) router.refresh();
                    }}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <input className="input flex-1" placeholder="(79) 99999-0000" value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} />
              <input className="input flex-1" placeholder="Recepção Atalaia" value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} />
              <button
                className="btn-primary"
                disabled={busy || !nf.phone}
                onClick={async () => {
                  if (await run(() => api("/api/panel/notify", "POST", nf), "Número de aviso cadastrado.")) {
                    setNf({ phone: "", label: "" });
                    router.refresh();
                  }
                }}
              >
                Adicionar
              </button>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-bold">Horário de funcionamento</h2>
            {instances.length === 0 && <p className="text-sm text-ink-400">Cadastre as instâncias de WhatsApp primeiro.</p>}
            <div className="space-y-3">
              {instances.map((i) => (
                <div key={i.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <b>{i.unitName}</b>
                    <span className="flex gap-3">
                      <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setExc(i)}>Feriados / datas especiais ({i.exceptions.length})</button>
                      <button className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => setEditing(i)}>Editar</button>
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-xs text-ink-500">{formatHours(i.hours)}</pre>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <Modal open={!!exc} onClose={() => setExc(null)} title={`Feriados e datas especiais — ${exc?.unitName ?? ""}`}>
        {exc && <ExceptionsEditor inst={exc} onSaved={() => { setExc(null); router.refresh(); }} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Horários — ${editing?.unitName ?? ""}`}>
        {editing && <HoursEditor inst={editing} onSaved={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { HoursEntry } from "@/engine/types";
import { api } from "./client";
import { Empty, Modal, PageHeader, StatusBadge, useAction } from "./ui";

export interface Inst { id: string; name: string; unitName: string; hours: HoursEntry[] }
interface Status { state: string; number: string | null; profileName: string | null; webhookEnabled: boolean }

const WEEK = [
  { d: 1, l: "Segunda" }, { d: 2, l: "Terça" }, { d: 3, l: "Quarta" }, { d: 4, l: "Quinta" },
  { d: 5, l: "Sexta" }, { d: 6, l: "Sábado" }, { d: 0, l: "Domingo" },
];

export function HoursEditor({ inst, onSaved }: { inst: Inst; onSaved: () => void }) {
  const { busy, run } = useAction();
  const [unitName, setUnitName] = useState(inst.unitName);
  const [rows, setRows] = useState(() =>
    WEEK.map(({ d }) => {
      const h = inst.hours.filter((x) => x.weekday === d);
      return { d, open: !!h.length, a: h[0]?.open ?? "06:00", b: h[0]?.close ?? "22:00", a2: h[1]?.open ?? "", b2: h[1]?.close ?? "" };
    }),
  );
  const save = async () => {
    const hours: HoursEntry[] = rows.flatMap((r) =>
      !r.open ? [] : [{ weekday: r.d, open: r.a, close: r.b }, ...(r.a2 && r.b2 ? [{ weekday: r.d, open: r.a2, close: r.b2 }] : [])],
    );
    if (await run(() => api(`/api/panel/instances/${inst.id}`, "PUT", { unitName, hours }), "Unidade e horários salvos.")) onSaved();
  };
  return (
    <div className="space-y-3">
      <div>
        <label className="label">Nome da unidade (vira {"{{unidade}}"})</label>
        <input className="input" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        {rows.map((r, i) => (
          <div key={r.d} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex w-24 items-center gap-2">
              <input type="checkbox" className="accent-brand-600" checked={r.open} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, open: e.target.checked } : y)))} />
              {WEEK[i].l.slice(0, 3)}
            </label>
            {r.open ? (
              <>
                <input type="time" className="input w-24 px-2 py-1" value={r.a} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, a: e.target.value } : y)))} />
                <span className="text-ink-400">às</span>
                <input type="time" className="input w-24 px-2 py-1" value={r.b} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, b: e.target.value } : y)))} />
                <span className="text-xs text-ink-400">+</span>
                <input type="time" className="input w-24 px-2 py-1" value={r.a2} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, a2: e.target.value } : y)))} />
                <input type="time" className="input w-24 px-2 py-1" value={r.b2} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, b2: e.target.value } : y)))} />
              </>
            ) : (
              <span className="text-ink-400">fechado</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-400">O segundo horário (opcional) serve para dias com intervalo.</p>
      <button className="btn-primary w-full" disabled={busy} onClick={save}>Salvar</button>
    </div>
  );
}

export function Instances({ initial }: { initial: Inst[] }) {
  const router = useRouter();
  const { busy, run } = useAction();
  const [status, setStatus] = useState<Record<string, Status | null>>({});
  const [qr, setQr] = useState<{ inst: Inst; img: string | null; code: string | null } | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", unitName: "" });
  const [editing, setEditing] = useState<Inst | null>(null);

  const refresh = useCallback(async (i: Inst) => {
    try {
      const s = await api<Status>(`/api/panel/instances/${i.id}/action`, "POST", { action: "status" });
      setStatus((x) => ({ ...x, [i.id]: s }));
      return s;
    } catch {
      setStatus((x) => ({ ...x, [i.id]: { state: "unknown", number: null, profileName: null, webhookEnabled: false } }));
      return null;
    }
  }, []);

  useEffect(() => {
    initial.forEach((i) => void refresh(i));
  }, [initial, refresh]);

  // While the QR modal is open, refresh the code and close once connected.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(async () => {
      const s = await refresh(qr.inst);
      if (s?.state === "open") {
        setQr(null);
        return;
      }
      try {
        const r = await api<{ qr?: string | null; pairingCode?: string | null }>(`/api/panel/instances/${qr.inst.id}/action`, "POST", { action: "qr" });
        if (r.qr) setQr((x) => (x ? { ...x, img: r.qr ?? null, code: r.pairingCode ?? null } : x));
      } catch {
        /* keep last QR */
      }
    }, 15_000);
    return () => clearInterval(t);
  }, [qr, refresh]);

  const action = async (i: Inst, a: "restart" | "webhook" | "logout", ok: string) => {
    if (a === "logout" && !confirm(`Desconectar o WhatsApp de ${i.unitName}? Vai ser preciso escanear o QR Code de novo.`)) return;
    if (await run(() => api(`/api/panel/instances/${i.id}/action`, "POST", { action: a }), ok)) setTimeout(() => void refresh(i), 1500);
  };

  const showQr = async (i: Inst) => {
    const r = await run(() => api<{ state: string; qr?: string | null; pairingCode?: string | null; message?: string }>(`/api/panel/instances/${i.id}/action`, "POST", { action: "qr" }));
    if (!r) return;
    if (r.state === "open") {
      void refresh(i);
      return alert("Este número já está conectado.");
    }
    setQr({ inst: i, img: r.qr ?? null, code: r.pairingCode ?? null });
  };

  return (
    <>
      <PageHeader
        title="Números de WhatsApp"
        subtitle="Cada instância é um número. O bot responde sempre pelo número que recebeu a mensagem."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}>+ Nova instância</button>}
      />
      {initial.length === 0 && <Empty>Nenhuma instância. Crie uma (ex.: atalaia, santana) e escaneie o QR Code.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {initial.map((i) => {
          const s = status[i.id];
          return (
            <div key={i.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold">{i.unitName}</div>
                  <div className="font-mono text-xs text-ink-400">{i.name}</div>
                </div>
                {s ? <StatusBadge status={s.state} /> : <span className="text-xs text-ink-400">verificando…</span>}
              </div>
              {s?.number && <div className="mb-1 text-sm">Número: <b>+{s.number}</b> {s.profileName ? `(${s.profileName})` : ""}</div>}
              {s && s.state !== "missing" && !s.webhookEnabled && (
                <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Webhook desligado: clique em “Reconfigurar webhook”.</div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {s?.state !== "open" && <button className="btn-primary px-3 py-1.5 text-xs" disabled={busy} onClick={() => showQr(i)}>Conectar (QR Code)</button>}
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => action(i, "restart", "Instância reiniciada.")}>Reiniciar</button>
                <button className="btn-ghost px-3 py-1.5 text-xs" disabled={busy} onClick={() => action(i, "webhook", "Webhook configurado.")}>Reconfigurar webhook</button>
                <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditing(i)}>Unidade e horários</button>
                {s?.state === "open" && <button className="btn-danger px-3 py-1.5 text-xs" disabled={busy} onClick={() => action(i, "logout", "WhatsApp desconectado.")}>Desconectar</button>}
                <button
                  className="btn-danger px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm(`Excluir a instância ${i.name}? Os contatos dela também saem do painel.`)) return;
                    if (await run(() => api(`/api/panel/instances/${i.id}`, "DELETE"), "Instância excluída.")) router.refresh();
                  }}
                >
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!qr} onClose={() => setQr(null)} title={`Conectar ${qr?.inst.unitName ?? ""}`}>
        <p className="mb-3 text-sm text-ink-500">No celular: WhatsApp → Aparelhos conectados → Conectar aparelho. O código se renova sozinho.</p>
        <div className="flex min-h-[280px] items-center justify-center rounded-xl bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr?.img ? <img src={qr.img} alt="QR Code" className="h-72 w-72" /> : <span className="text-sm text-ink-400">Gerando QR Code…</span>}
        </div>
        {qr?.code && <p className="mt-3 text-center text-sm">Código de pareamento: <b className="font-mono">{qr.code}</b></p>}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nova instância">
        <label className="label">Nome técnico</label>
        <input className="input mb-3 font-mono" placeholder="atalaia" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.toLowerCase() })} />
        <label className="label">Nome da unidade</label>
        <input className="input mb-4" placeholder="Atalaia" value={form.unitName} onChange={(e) => setForm({ ...form, unitName: e.target.value })} />
        <button
          className="btn-primary w-full"
          disabled={busy || !form.name || !form.unitName}
          onClick={async () => {
            if (await run(() => api("/api/panel/instances", "POST", form), "Instância criada. Agora conecte pelo QR Code.")) {
              setCreating(false);
              setForm({ name: "", unitName: "" });
              router.refresh();
            }
          }}
        >
          Criar
        </button>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Unidade e horários — ${editing?.name ?? ""}`}>
        {editing && <HoursEditor inst={editing} onSaved={() => { setEditing(null); router.refresh(); }} />}
      </Modal>
    </>
  );
}

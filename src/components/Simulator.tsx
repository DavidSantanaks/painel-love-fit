"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "./client";
import { Bubble, PageHeader, StatusBadge, useAction, WaText } from "./ui";

type State = { status: "ACTIVE" | "PAUSED" | "WAITING_HUMAN"; pausedUntil: string | null; currentNodeKey: string | null };
type Line = { out: boolean; text: string; type?: string; fileName?: string | null; mediaId?: string | null; note?: string };

const INITIAL: State = { status: "ACTIVE", pausedUntil: null, currentNodeKey: null };
const DECISIONS: Record<string, string> = {
  fallback: "não reconheceu → menu principal",
  option: "opção escolhida",
  menu: "voltou ao menu",
  reactivated: "bot reativado",
  paused_silent: "bot pausado: ficou em silêncio",
  human_reply_pause: "resposta da recepção → bot pausado",
  staff_command_pause: "comando da equipe → bot pausado",
  ignored_no_text: "mensagem sem texto: ignorada",
};

export function Simulator({ instances }: { instances: { id: string; unitName: string }[] }) {
  const { busy, run } = useAction();
  const [state, setState] = useState<State>(INITIAL);
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [asStore, setAsStore] = useState(false);
  const [name, setName] = useState("Maria");
  const [instanceId, setInstanceId] = useState(instances[0]?.id ?? null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim() && !asStore) return;
    const input = text;
    setText("");
    setLines((l) => [...l, { out: !asStore ? false : true, text: input, note: asStore ? "recepção (celular da loja)" : undefined }]);
    const r = await run(() =>
      api<{ decision: string; replies: { type: string; text: string; fileName: string | null; mediaId: string | null }[]; state: State; handoff: { reason: string } | null }>(
        "/api/panel/simulate",
        "POST",
        { text: input, fromMe: asStore, pushName: name, instanceId, state },
      ),
    );
    if (!r) return;
    setState(r.state);
    setLines((l) => [
      ...l,
      ...r.replies.map((m) => ({ out: true, text: m.text, type: m.type, fileName: m.fileName, mediaId: m.mediaId })),
      { out: false, text: "", note: `⚙ ${DECISIONS[r.decision] ?? r.decision}${r.handoff ? ` · entrou na fila de atendimento (${r.handoff.reason}) + aviso à equipe` : ""}` },
    ]);
  }

  return (
    <>
      <PageHeader title="Simulador" subtitle="Converse com o bot usando as telas atuais. Nada é enviado ao WhatsApp e nada é gravado." />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="overflow-hidden rounded-3xl border border-ink-200 shadow-xl">
          <div className="flex items-center justify-between bg-wa-head px-4 py-3 text-white">
            <div className="text-sm font-semibold">LOVE FIT · {instances.find((i) => i.id === instanceId)?.unitName ?? "Unidade"}</div>
            <button className="text-xs opacity-80 hover:opacity-100" onClick={() => { setLines([]); setState(INITIAL); }}>Reiniciar conversa</button>
          </div>
          <div className="flex h-[520px] flex-col gap-2 overflow-y-auto bg-wa-bg p-4">
            {lines.length === 0 && <p className="m-auto text-sm text-ink-400">Digite “oi” para começar.</p>}
            {lines.map((l, i) =>
              l.note && !l.text ? (
                <div key={i} className="mx-auto rounded-full bg-white/70 px-3 py-1 text-[11px] text-ink-500">{l.note}</div>
              ) : (
                <Bubble key={i} out={l.out} meta={l.note}>
                  {l.type === "IMAGE" && l.mediaId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/panel/media/${l.mediaId}`} alt="" className="mb-1.5 max-h-48 rounded-lg" />
                  )}
                  {l.type === "DOCUMENT" && <div className="mb-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs">📄 {l.fileName}</div>}
                  <WaText text={l.text} />
                </Bubble>
              ),
            )}
            <div ref={end} />
          </div>
          <form onSubmit={send} className="flex gap-2 border-t border-ink-100 bg-white p-3">
            <input className="input" placeholder={asStore ? "Mensagem da recepção pelo celular…" : "Mensagem do cliente…"} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            <button className="btn-primary" disabled={busy}>Enviar</button>
          </form>
        </div>
        <aside className="card h-fit space-y-4 p-5">
          <div>
            <div className="label">Situação do contato</div>
            <StatusBadge status={state.status} />
            {state.pausedUntil && <div className="mt-1 text-xs text-ink-400">até {new Date(state.pausedUntil).toLocaleTimeString("pt-BR")}</div>}
            <div className="mt-2 text-xs text-ink-500">Tela atual: <span className="font-mono">{state.currentNodeKey ?? "—"}</span></div>
          </div>
          <div>
            <label className="label">Nome do cliente</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {instances.length > 1 && (
            <div>
              <label className="label">Número que recebe</label>
              <select className="input" value={instanceId ?? ""} onChange={(e) => setInstanceId(e.target.value)}>
                {instances.map((i) => <option key={i.id} value={i.id}>{i.unitName}</option>)}
              </select>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-brand-600" checked={asStore} onChange={(e) => setAsStore(e.target.checked)} />
            <span>Enviar como a recepção (pelo celular da loja) — testa a pausa automática.</span>
          </label>
        </aside>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { renderNode } from "@/engine/render";
import type { EngineNode, HoursEntry } from "@/engine/types";
import { api } from "./client";
import { Bubble, PageHeader, useAction, WaText } from "./ui";

type MsgType = "TEXT" | "IMAGE" | "DOCUMENT";
type OptAction = "GO_TO" | "CALL_HUMAN" | "PAUSE" | "NONE";

export interface EditorNode {
  id: string | null;
  key: string;
  title: string;
  isMain: boolean;
  showOptions: boolean;
  onEnterAction: "NONE" | "CALL_HUMAN" | "PAUSE";
  pauseMinutes: number | null;
  messages: { type: MsgType; text: string; mediaId: string | null }[];
  options: { label: string; triggers: string[]; action: OptAction; targetKey: string | null; pauseMinutes: number | null }[];
}

interface MediaItem {
  id: string;
  fileName: string;
  mimeType: string;
}

interface Props {
  initial: EditorNode;
  nodes: { key: string; title: string }[];
  media: MediaItem[];
  unitName: string;
  hours: HoursEntry[];
  defaultPause: number;
  timezone: string;
}

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const ACTIONS: { value: OptAction; label: string }[] = [
  { value: "GO_TO", label: "Ir para tela" },
  { value: "CALL_HUMAN", label: "Chamar atendente" },
  { value: "PAUSE", label: "Pausar bot" },
];

export function NodeEditor({ initial, nodes, media: initialMedia, unitName, hours, defaultPause, timezone }: Props) {
  const router = useRouter();
  const [n, setN] = useState<EditorNode>(initial);
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [keyTouched, setKeyTouched] = useState(!!initial.id);
  const { busy, run } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<number | null>(null);

  const set = (patch: Partial<EditorNode>) => setN((x) => ({ ...x, ...patch }));
  const setMsg = (i: number, patch: Partial<EditorNode["messages"][number]>) =>
    setN((x) => ({ ...x, messages: x.messages.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const setOpt = (i: number, patch: Partial<EditorNode["options"][number]>) =>
    setN((x) => ({ ...x, options: x.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));
  const move = <T,>(arr: T[], i: number, d: number) => {
    const a = [...arr];
    const j = i + d;
    if (j < 0 || j >= a.length) return a;
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  };

  const targets = useMemo(() => [...nodes, ...(n.key ? [{ key: n.key, title: `${n.title || n.key} (esta tela)` }] : [])], [nodes, n.key, n.title]);

  const preview = useMemo(() => {
    const engineNode: EngineNode = {
      key: n.key,
      title: n.title,
      isMain: n.isMain,
      showOptions: n.showOptions,
      onEnterAction: n.onEnterAction,
      pauseMinutes: n.pauseMinutes,
      messages: n.messages.map((m) => {
        const md = media.find((x) => x.id === m.mediaId);
        return { type: m.type, text: m.text, media: md ? { id: md.id, fileName: md.fileName, mimeType: md.mimeType } : null };
      }),
      options: n.options.map((o, i) => ({ ...o, order: i })),
    };
    return renderNode(engineNode, "Maria Souza", { unitName, hours, timezone, now: new Date() });
  }, [n, media, unitName, hours, timezone]);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const m = await run(() => api<MediaItem>("/api/panel/media", "POST", fd), "Arquivo enviado.");
    if (m && uploadFor !== null) {
      setMedia((x) => [m, ...x]);
      setMsg(uploadFor, { mediaId: m.id });
    }
  }

  async function save() {
    const payload = { ...n, options: n.options.map((o) => ({ ...o, triggers: o.triggers.map((t) => t.trim()).filter(Boolean) })) };
    const r = await run(
      () => (n.id ? api<{ id: string }>(`/api/panel/nodes/${n.id}`, "PUT", payload) : api<{ id: string }>("/api/panel/nodes", "POST", payload)),
      "Tela salva. Já está valendo no WhatsApp.",
    );
    if (r && !n.id) router.replace(`/painel/telas/${r.id}`);
    else if (r) router.refresh();
  }

  async function remove() {
    if (!n.id || !confirm(`Excluir a tela "${n.title}"?`)) return;
    const r = await run(() => api(`/api/panel/nodes/${n.id}`, "DELETE"), "Tela excluída.");
    if (r) router.push("/painel/telas");
  }

  return (
    <>
      <PageHeader
        title={n.id ? n.title || "Tela" : "Nova tela"}
        subtitle="Textos aceitam {{nome}}, {{unidade}}, {{saudacao}}, {{horarios}} e {{expediente}}. Use *negrito* e _itálico_ como no WhatsApp."
        actions={
          <>
            <Link href="/painel/telas" className="btn-ghost">
              Voltar
            </Link>
            {n.id && !n.isMain && (
              <button className="btn-danger" onClick={remove} disabled={busy}>
                Excluir
              </button>
            )}
            <button className="btn-primary" onClick={save} disabled={busy}>
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <label className="label">Título</label>
              <input
                className="input"
                value={n.title}
                onChange={(e) => set({ title: e.target.value, ...(keyTouched ? {} : { key: slugify(e.target.value) }) })}
                placeholder="Ex.: Planos"
              />
            </div>
            <div>
              <label className="label">Nome interno</label>
              <input
                className="input font-mono"
                value={n.key}
                onChange={(e) => {
                  setKeyTouched(true);
                  set({ key: slugify(e.target.value) });
                }}
                placeholder="planos"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={n.isMain} onChange={(e) => set({ isMain: e.target.checked })} className="accent-brand-600" />
              <span>
                Esta é a tela de <b>menu principal</b> (fallback)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={n.showOptions} onChange={(e) => set({ showOptions: e.target.checked })} className="accent-brand-600" />
              <span>Listar as opções numeradas no fim da mensagem</span>
            </label>
            <div>
              <label className="label">Ao entrar nesta tela</label>
              <select className="input" value={n.onEnterAction} onChange={(e) => set({ onEnterAction: e.target.value as EditorNode["onEnterAction"] })}>
                <option value="NONE">Nada</option>
                <option value="CALL_HUMAN">Chamar atendente (pausa + aviso)</option>
                <option value="PAUSE">Pausar o bot (pausa + aviso)</option>
              </select>
            </div>
            {n.onEnterAction !== "NONE" && (
              <div>
                <label className="label">Pausar por (minutos)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  placeholder={String(defaultPause)}
                  value={n.pauseMinutes ?? ""}
                  onChange={(e) => set({ pauseMinutes: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            )}
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Mensagens</h2>
              <div className="flex gap-2">
                {(["TEXT", "IMAGE", "DOCUMENT"] as MsgType[]).map((t) => (
                  <button
                    key={t}
                    className="btn-ghost px-2.5 py-1.5 text-xs"
                    disabled={n.messages.length >= 10}
                    onClick={() => set({ messages: [...n.messages, { type: t, text: "", mediaId: null }] })}
                  >
                    + {t === "TEXT" ? "Texto" : t === "IMAGE" ? "Imagem" : "PDF"}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {n.messages.map((m, i) => {
                const pool = media.filter((x) => (m.type === "IMAGE" ? x.mimeType.startsWith("image/") : x.mimeType === "application/pdf"));
                return (
                  <div key={i} className="rounded-xl border border-ink-100 bg-ink-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                        {i + 1}. {m.type === "TEXT" ? "Texto" : m.type === "IMAGE" ? "Imagem" : "PDF"}
                      </span>
                      <div className="flex gap-1 text-ink-400">
                        <button className="px-1.5 hover:text-ink-800" onClick={() => set({ messages: move(n.messages, i, -1) })} aria-label="Subir">↑</button>
                        <button className="px-1.5 hover:text-ink-800" onClick={() => set({ messages: move(n.messages, i, 1) })} aria-label="Descer">↓</button>
                        <button className="px-1.5 hover:text-red-600" onClick={() => set({ messages: n.messages.filter((_, j) => j !== i) })} aria-label="Remover">✕</button>
                      </div>
                    </div>
                    {m.type !== "TEXT" && (
                      <div className="mb-2 flex gap-2">
                        <select className="input" value={m.mediaId ?? ""} onChange={(e) => setMsg(i, { mediaId: e.target.value || null })}>
                          <option value="">Escolha o arquivo…</option>
                          {pool.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.fileName}
                            </option>
                          ))}
                        </select>
                        <button
                          className="btn-ghost shrink-0"
                          onClick={() => {
                            setUploadFor(i);
                            fileRef.current?.click();
                          }}
                        >
                          Enviar arquivo
                        </button>
                      </div>
                    )}
                    <textarea
                      className="input min-h-[96px] resize-y font-[inherit]"
                      value={m.text}
                      placeholder={m.type === "TEXT" ? "Texto da mensagem" : "Legenda (opcional)"}
                      onChange={(e) => setMsg(i, { text: e.target.value })}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-bold">Opções</h2>
                <p className="text-xs text-ink-400">Gatilhos separados por vírgula. Sem acento e sem maiúsculas faz diferença nenhuma.</p>
              </div>
              <button
                className="btn-ghost px-2.5 py-1.5 text-xs"
                onClick={() => set({ options: [...n.options, { label: "", triggers: [String(n.options.length + 1)], action: "GO_TO", targetKey: null, pauseMinutes: null }] })}
              >
                + Opção
              </button>
            </div>
            <div className="space-y-3">
              {n.options.map((o, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-ink-100 bg-ink-50/50 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="label">Rótulo</label>
                    <input className="input" value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} placeholder="Planos e valores" />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">Gatilhos</label>
                    <input
                      className="input"
                      value={o.triggers.join(", ")}
                      onChange={(e) => setOpt(i, { triggers: e.target.value.split(",").map((t) => t.trimStart()) })}
                      placeholder="1, planos, valores"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Ação</label>
                    <select className="input" value={o.action} onChange={(e) => setOpt(i, { action: e.target.value as OptAction })}>
                      {ACTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="label">{o.action === "GO_TO" ? "Tela de destino" : "Mostrar a tela (opcional)"}</label>
                    <select className="input" value={o.targetKey ?? ""} onChange={(e) => setOpt(i, { targetKey: e.target.value || null })}>
                      <option value="">{o.action === "GO_TO" ? "Escolha…" : "— nenhuma —"}</option>
                      {targets.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  {o.action !== "GO_TO" && (
                    <div className="sm:col-span-4">
                      <label className="label">Pausar por (min)</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        placeholder={String(defaultPause)}
                        value={o.pauseMinutes ?? ""}
                        onChange={(e) => setOpt(i, { pauseMinutes: e.target.value ? Number(e.target.value) : null })}
                      />
                    </div>
                  )}
                  <div className="flex items-end justify-end gap-1 text-ink-400 sm:col-span-12">
                    <button className="px-1.5 hover:text-ink-800" onClick={() => set({ options: move(n.options, i, -1) })}>↑</button>
                    <button className="px-1.5 hover:text-ink-800" onClick={() => set({ options: move(n.options, i, 1) })}>↓</button>
                    <button className="px-1.5 text-xs font-semibold hover:text-red-600" onClick={() => set({ options: n.options.filter((_, j) => j !== i) })}>
                      Remover
                    </button>
                  </div>
                </div>
              ))}
              {n.options.length === 0 && <p className="text-sm text-ink-400">Sem opções: depois desta tela, o próximo texto do cliente é tratado pelo menu principal.</p>}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-3xl border border-ink-200 shadow-xl">
            <div className="flex items-center gap-3 bg-wa-head px-4 py-3 text-white">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm">♥</div>
              <div>
                <div className="text-sm font-semibold">LOVE FIT {unitName}</div>
                <div className="text-[11px] opacity-80">pré-visualização</div>
              </div>
            </div>
            <div className="flex min-h-[420px] flex-col gap-2 bg-wa-bg p-3">
              {preview.length === 0 && <p className="mt-10 text-center text-xs text-ink-400">Esta tela não envia nada.</p>}
              {preview.map((m, i) => (
                <Bubble key={i} meta="agora">
                  {m.type === "IMAGE" && (
                    <div className="mb-1.5 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-ink-100 text-xs text-ink-400">
                      {m.media ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/panel/media/${m.media.id}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "imagem"
                      )}
                    </div>
                  )}
                  {m.type === "DOCUMENT" && (
                    <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-ink-50 px-3 py-2 text-xs">📄 {m.media?.fileName ?? "documento.pdf"}</div>
                  )}
                  <WaText text={m.text} />
                </Bubble>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-ink-400">Exemplo com cliente “Maria” na unidade {unitName}.</p>
        </aside>
      </div>
    </>
  );
}

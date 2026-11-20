"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; kind: "ok" | "err"; text: string };
const ToastCtx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 7000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`animate-fade-up whitespace-pre-line rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.kind === "ok" ? "bg-ink-900 text-white" : "bg-red-600 text-white"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/** Runs an async action with busy state and toast feedback. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okText?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (okText) toast("ok", okText);
        return r;
      } catch (e) {
        toast("err", e instanceof Error ? e.message : "Erro inesperado.");
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { busy, run };
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-md animate-fade-up p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="text-ink-400 hover:text-ink-700" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Bot ativo", cls: "bg-emerald-50 text-emerald-700" },
  PAUSED: { label: "Pausado", cls: "bg-amber-50 text-amber-700" },
  WAITING_HUMAN: { label: "Aguardando humano", cls: "bg-brand-50 text-brand-700" },
  open: { label: "Conectado", cls: "bg-emerald-50 text-emerald-700" },
  connecting: { label: "Aguardando QR", cls: "bg-amber-50 text-amber-700" },
  close: { label: "Desconectado", cls: "bg-red-50 text-red-700" },
  missing: { label: "Não existe na Evolution", cls: "bg-red-50 text-red-700" },
  unknown: { label: "Sem resposta", cls: "bg-ink-100 text-ink-600" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-ink-100 text-ink-600" };
  return (
    <span className={`badge ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

/** WhatsApp-style bubble, used by the editor preview and the simulator. */
export function Bubble({ out, children, meta }: { out?: boolean; children: ReactNode; meta?: string }) {
  return (
    <div className={`flex ${out ? "justify-end" : "justify-start"} animate-fade-up`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[13.5px] leading-snug shadow-sm ${
          out ? "rounded-tr-sm bg-wa-out" : "rounded-tl-sm bg-wa-in"
        }`}
      >
        {children}
        {meta && <div className="mt-1 text-right text-[10px] text-ink-400">{meta}</div>}
      </div>
    </div>
  );
}

/** Renders WhatsApp *bold* and _italic_ markers. */
export function WaText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\*[^*]+\*$/.test(p) ? <b key={i}>{p.slice(1, -1)}</b> : /^_[^_]+_$/.test(p) ? <i key={i}>{p.slice(1, -1)}</i> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-400">{children}</div>;
}

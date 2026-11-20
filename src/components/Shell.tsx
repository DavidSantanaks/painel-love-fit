"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api } from "./client";
import { ToastProvider } from "./ui";

const NAV = [
  { href: "/painel", label: "Visão geral", icon: "◎", admin: false },
  { href: "/painel/conversas", label: "Conversas", icon: "💬", admin: false },
  { href: "/painel/telas", label: "Telas e menus", icon: "▤", admin: false },
  { href: "/painel/simulador", label: "Simulador", icon: "▷", admin: false },
  { href: "/painel/configuracoes", label: "Configurações", icon: "⚙", admin: false },
  { href: "/painel/instancias", label: "WhatsApp", icon: "📱", admin: true },
  { href: "/painel/blacklist", label: "Blacklist", icon: "⛔", admin: true },
  { href: "/painel/log", label: "Log e auditoria", icon: "≡", admin: false },
];

interface Props {
  children: ReactNode;
  user: { name: string; email: string; role: string };
  isAdmin: boolean;
  franchise: { id: string; name: string };
  franchises: { id: string; name: string }[] | null;
  queueCount: number;
}

export function Shell({ children, user, isAdmin, franchise, franchises, queueCount }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => !n.admin || isAdmin).map((n) => {
        const active = n.href === "/painel" ? path === "/painel" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
              active ? "bg-white text-ink-900 shadow-sm" : "text-ink-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className={`w-5 text-center ${active ? "text-brand-600" : ""}`}>{n.icon}</span>
            <span className="flex-1">{n.label}</span>
            {n.href === "/painel/conversas" && queueCount > 0 && (
              <span className="rounded-full bg-brand-500 px-1.5 text-[11px] font-bold text-white">{queueCount}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen lg:pl-64">
        <aside
          className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-ink-950 p-4 transition-transform lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-6 flex items-center gap-3 px-2 pt-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 font-black text-white">♥</div>
            <div className="min-w-0">
              <div className="font-extrabold tracking-tight text-white">LOVE FIT</div>
              <div className="truncate text-xs text-ink-400">{franchise.name}</div>
            </div>
          </div>
          {franchises && franchises.length > 1 && (
            <select
              className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={franchise.id}
              onChange={async (e) => {
                await api("/api/panel/franchise", "POST", { franchiseId: e.target.value });
                window.location.reload();
              }}
            >
              {franchises.map((f) => (
                <option key={f.id} value={f.id} className="text-ink-900">
                  {f.name}
                </option>
              ))}
            </select>
          )}
          {nav}
          <div className="mt-auto rounded-xl bg-white/5 p-3">
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="truncate text-xs text-ink-400">{user.email}</div>
            <button
              className="mt-2 text-xs font-semibold text-brand-300 hover:text-brand-200"
              onClick={async () => {
                await api("/api/auth/logout", "POST");
                window.location.href = "/login";
              }}
            >
              Sair
            </button>
          </div>
        </aside>
        {open && <div className="fixed inset-0 z-20 bg-ink-950/40 lg:hidden" onClick={() => setOpen(false)} />}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-100 bg-[#f7f6f4]/80 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn-ghost px-2.5 py-1.5" onClick={() => setOpen(true)} aria-label="Menu">
            ☰
          </button>
          <span className="font-bold">LOVE FIT</span>
        </header>
        <main className="mx-auto max-w-6xl animate-fade-up p-4 sm:p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}

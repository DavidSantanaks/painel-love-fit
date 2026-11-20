"use client";

import { useState } from "react";
import { api } from "@/components/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", "POST", { email, password });
      window.location.href = "/painel";
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-amber-100/70 blur-3xl" />
      <form onSubmit={submit} className="card relative w-full max-w-sm animate-fade-up p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-lg font-black text-white shadow-lg shadow-brand-600/30">♥</div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">LOVE FIT</div>
            <div className="text-xs text-ink-500">Painel do bot de WhatsApp</div>
          </div>
        </div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" className="input mb-4" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="label" htmlFor="password">Senha</label>
        <input id="password" className="input mb-5" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

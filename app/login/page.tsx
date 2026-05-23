"use client";

import React, { useState } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      alert("Digite seu e-mail.");
      return;
    }

    if (!password.trim()) {
      alert("Digite sua senha.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      alert("E-mail ou senha inválidos.");
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020B0C] p-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_35%)]" />

      <div className="relative grid w-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07111B]/95 shadow-2xl shadow-black/40 backdrop-blur-xl md:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-emerald-500/20 via-[#07111B] to-[#020B0C] p-10 md:flex">
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/arenaflow-logo.png"
                alt="ArenaFlow"
                className="h-20 w-auto object-contain"
              />

              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">
                  ArenaFlow
                </p>
                <p className="font-bold text-slate-300">
                  Gestão premium para arenas
                </p>
              </div>
            </div>

            <div className="mt-16">
              <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-black uppercase tracking-widest text-emerald-300">
                Painel administrativo
              </div>

              <h1 className="mt-5 max-w-xl text-5xl font-black leading-tight tracking-tight">
                Controle sua arena com agenda, clientes e financeiro.
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300">
                Acesse reservas, mensalistas, quadras, pagamentos e o link público da sua arena em um só lugar.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FeatureCard title="Agenda" text="Reservas organizadas" />
            <FeatureCard title="Financeiro" text="Pagamentos e sinal" />
            <FeatureCard title="Clientes" text="Histórico completo" />
          </div>
        </section>

        <section className="flex min-h-[620px] items-center justify-center p-6 md:p-10">
          <form onSubmit={handleLogin} className="w-full max-w-md">
            <div className="mb-8 text-center md:hidden">
              <img
                src="/arenaflow-logo.png"
                alt="ArenaFlow"
                className="mx-auto h-24 w-auto object-contain"
              />
            </div>

            <div className="mb-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <LockKeyhole size={26} />
              </div>

              <h2 className="text-4xl font-black tracking-tight">
                Entrar no ArenaFlow
              </h2>

              <p className="mt-3 text-slate-400">
                Acesse o painel administrativo da sua arena.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-300">
                  E-mail
                </label>

                <input
                  type="email"
                  placeholder="seuemail@email.com"
                  className="w-full rounded-2xl border border-white/10 bg-[#0F172A] p-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-black text-slate-300">
                  Senha
                </label>

                <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] transition focus-within:border-emerald-400">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    className="w-full bg-transparent p-4 text-white outline-none placeholder:text-slate-600"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="flex w-14 items-center justify-center border-l border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-emerald-400"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 p-4 text-lg font-black text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Entrando...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    Entrar
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
              Problemas para acessar? Fale com o suporte ArenaFlow.
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{text}</p>
    </div>
  );
}
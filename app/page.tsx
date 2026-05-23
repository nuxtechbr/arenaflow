"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  LayoutDashboard,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

const WHATSAPP = "5522999270052";

export default function HomePage() {
  function openWhatsapp() {
    const message = `Olá! Tenho interesse no ArenaFlow para minha arena.

Quero saber como funciona a implementação, mensalidade e como colocar minha agenda online.`;

    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <main className="min-h-screen bg-[#020B0C] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_35%)]" />

      <header className="relative z-10 border-b border-white/10 bg-[#020B0C]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <img
              src="/arenaflow-logo.png"
              alt="ArenaFlow"
              className="h-14 w-auto object-contain"
            />

            <div>
              <p className="text-lg font-black leading-none">ArenaFlow</p>
              <p className="text-xs font-bold text-emerald-400">
                Gestão para arenas
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden rounded-2xl border border-white/10 px-5 py-3 font-bold text-slate-200 transition hover:border-emerald-400 hover:text-white md:block"
            >
              Entrar
            </Link>

            <button
              type="button"
              onClick={openWhatsapp}
              className="rounded-2xl bg-emerald-500 px-5 py-3 font-black text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Quero contratar
            </button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.08fr_0.92fr] md:px-8 md:py-24">
        <div>
          <div className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Agenda online para arenas esportivas
          </div>

          <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
            Sua arena vendendo horários pelo link.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl">
            O ArenaFlow organiza reservas, quadras, clientes, mensalistas,
            financeiro, sinal via Pix e link público para seus clientes
            agendarem sem bagunça no WhatsApp.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openWhatsapp}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-7 py-5 text-lg font-black text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Quero colocar minha arena online
              <ArrowRight size={20} />
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-7 py-5 text-lg font-black text-white transition hover:border-emerald-400"
            >
              Entrar no painel
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat value="24h" label="Link online" />
            <MiniStat value="Pix" label="Sinal manual" />
            <MiniStat value="100%" label="Responsivo" />
            <MiniStat value="Rápido" label="Implantação" />
          </div>
        </div>

        <div className="rounded-[2rem] border border-emerald-500/20 bg-[#07111B]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-6">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#0F172A] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-emerald-400">
                  Painel da arena
                </p>
                <h2 className="mt-1 text-2xl font-black">Agenda de hoje</h2>
              </div>

              <div className="rounded-2xl bg-emerald-500 p-3 text-black">
                <CalendarDays />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <FakeBooking time="18:00 - 19:00" name="João Carlos" status="Confirmada" />
              <FakeBooking time="19:00 - 21:00" name="Mensalista Fixo" status="Mensalista" />
              <FakeBooking time="21:00 - 22:00" name="Pedro Silva" status="Aguardando sinal" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <FakeMetric label="Reservas" value="18" />
              <FakeMetric label="Receita" value="R$ 890" />
              <FakeMetric label="Fixos" value="7" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <FeatureSmall icon={<Smartphone />} title="Link público" />
            <FeatureSmall icon={<Wallet />} title="Financeiro" />
            <FeatureSmall icon={<Users />} title="Clientes" />
            <FeatureSmall icon={<CreditCard />} title="Mensalistas" />
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-10 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<CalendarDays />}
            title="Agenda inteligente"
            text="Controle reservas avulsas, fixas, bloqueios manuais e horários disponíveis em tempo real."
          />

          <FeatureCard
            icon={<MessageCircle />}
            title="Menos bagunça no WhatsApp"
            text="O cliente escolhe quadra, data, horário e envia o comprovante pelo WhatsApp."
          />

          <FeatureCard
            icon={<Wallet />}
            title="Financeiro simples"
            text="Veja reservas pagas, pendentes, sinal, mensalistas e cobranças em um só painel."
          />

          <FeatureCard
            icon={<Trophy />}
            title="Reserva fixa"
            text="Controle mensalistas e horários recorrentes sem perder controle da agenda."
          />

          <FeatureCard
            icon={<ShieldCheck />}
            title="Bloqueio e controle"
            text="Você controla assinatura, acesso e cobrança dos clientes pelo painel master."
          />

          <FeatureCard
            icon={<LayoutDashboard />}
            title="Painel premium"
            text="Visual moderno para o dono da arena usar com facilidade no computador ou celular."
          />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-12 md:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-[#0F172A] to-[#07111B] p-8 md:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_0.8fr] md:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-300">
                Pronto para vender horários online
              </p>

              <h2 className="mt-3 text-4xl font-black md:text-5xl">
                Coloque sua arena no digital sem complicação.
              </h2>

              <p className="mt-4 max-w-2xl text-slate-300">
                Implantação rápida, configuração assistida e mensalidade simples.
                Ideal para society, beach tennis, futsal, vôlei, tênis e arenas esportivas.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
              <p className="text-sm font-bold text-slate-400">Implementação</p>
              <p className="mt-1 text-4xl font-black text-white">R$ 197</p>

              <div className="my-5 h-px bg-white/10" />

              <p className="text-sm font-bold text-slate-400">Mensalidade</p>
              <p className="mt-1 text-4xl font-black text-emerald-300">
                R$ 89,90
              </p>

              <button
                type="button"
                onClick={openWhatsapp}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 font-black text-black transition hover:bg-emerald-400"
              >
                Chamar no WhatsApp
                <MessageCircle size={20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 py-8 text-center text-sm text-slate-500">
        <p className="font-black text-white">ArenaFlow</p>
        <p className="mt-1">
          Sistema de gestão e reservas para arenas esportivas.
        </p>
      </footer>
    </main>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">{label}</p>
    </div>
  );
}

function FakeBooking({
  time,
  name,
  status,
}: {
  time: string;
  name: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#07111B] p-4">
      <div>
        <p className="font-black text-white">{time}</p>
        <p className="mt-1 text-sm text-slate-400">{name}</p>
      </div>

      <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
        {status}
      </span>
    </div>
  );
}

function FakeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function FeatureSmall({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="text-emerald-400">{icon}</span>
      <span className="font-black">{title}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/10">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
        {icon}
      </div>

      <h3 className="text-2xl font-black">{title}</h3>
      <p className="mt-3 leading-relaxed text-slate-400">{text}</p>

      <div className="mt-5 flex items-center gap-2 text-sm font-black text-emerald-400">
        <CheckCircle2 size={16} />
        Incluso no ArenaFlow
      </div>
    </div>
  );
}
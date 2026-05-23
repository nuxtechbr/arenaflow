"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  LayoutDashboard,
  Building2,
  CalendarDays,
  Users,
  Wallet,
  CreditCard,
  LogOut,
  MapPinned,
  ChevronRight,
  ChevronsUpDown,
  Check,
  Lock,
  MessageCircle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useActiveArena } from "../../hooks/use-active-arena";

type SubLink = {
  label: string;
  href: string;
  key: string;
};

type ActiveArenaBillingStatus = {
  id: string;
  name: string | null;
  subscription_status: string | null;
  blocked_reason: string | null;
};

const BILLING_WHATSAPP = "5522999270052";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050B12] text-white">
          Carregando painel...
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const arenaTab = searchParams.get("tab") || "visual";
  const bookingView = searchParams.get("view") || "agenda";
  const financeView = searchParams.get("view") || "resumo";

  const {
    arenas,
    activeArenaId,
    activeArenaInfo,
    setActiveArenaId,
    loading: arenasLoading,
  } = useActiveArena();

  const [arenaMenuOpen, setArenaMenuOpen] = useState(false);
  const [billingStatus, setBillingStatus] = useState<ActiveArenaBillingStatus | null>(null);
  const [checkingBilling, setCheckingBilling] = useState(false);

  useEffect(() => {
    loadActiveArenaBillingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArenaId]);

  const isBlocked = billingStatus?.subscription_status === "blocked";
  const isBillingPage = pathname.startsWith("/dashboard/billing");

  async function loadActiveArenaBillingStatus() {
    if (!activeArenaId) {
      setBillingStatus(null);
      return;
    }

    setCheckingBilling(true);

    const { data, error } = await supabase
      .from("arenas")
      .select("id, name, subscription_status, blocked_reason")
      .eq("id", activeArenaId)
      .maybeSingle();

    if (error) {
      console.error(error);
      setBillingStatus(null);
      setCheckingBilling(false);
      return;
    }

    setBillingStatus((data || null) as ActiveArenaBillingStatus | null);
    setCheckingBilling(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function changeArena(arenaId: string) {
    setActiveArenaId(arenaId);
    setArenaMenuOpen(false);
    window.location.href = "/dashboard";
  }

  const arenaSubLinks: SubLink[] = [
    { label: "Visual da Arena", href: "/dashboard/arena?tab=visual", key: "visual" },
    { label: "Dados da Arena", href: "/dashboard/arena?tab=info", key: "info" },
    { label: "Funcionamento", href: "/dashboard/arena?tab=hours", key: "hours" },
    { label: "Regras", href: "/dashboard/arena?tab=rules", key: "rules" },
    { label: "Reserva com Sinal", href: "/dashboard/arena?tab=deposit", key: "deposit" },
  ];

  const bookingSubLinks: SubLink[] = [
    { label: "Agenda do Dia", href: "/dashboard/bookings?view=agenda", key: "agenda" },
    { label: "Nova Reserva", href: "/dashboard/bookings?view=nova", key: "nova" },
    { label: "Nova Reserva Fixa", href: "/dashboard/bookings?view=fixa", key: "fixa" },
    { label: "Reservas Fixas", href: "/dashboard/bookings?view=fixas", key: "fixas" },
    { label: "Lista de Reservas", href: "/dashboard/bookings?view=lista", key: "lista" },
    { label: "Resumo", href: "/dashboard/bookings?view=resumo", key: "resumo" },
    { label: "Bloqueios", href: "/dashboard/bookings?view=bloqueios", key: "bloqueios" },
  ];

  const financeSubLinks: SubLink[] = [
    { label: "Resumo", href: "/dashboard/finance?view=resumo", key: "resumo" },
    { label: "Gráfico", href: "/dashboard/finance?view=grafico", key: "grafico" },
    { label: "Status", href: "/dashboard/finance?view=status", key: "status" },
    { label: "Relatório", href: "/dashboard/finance?view=relatorio", key: "relatorio" },
    { label: "Tabela", href: "/dashboard/finance?view=tabela", key: "tabela" },
    { label: "Mensalistas", href: "/dashboard/finance?view=mensalistas", key: "mensalistas" },
  ];

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(22,163,74,0.08),transparent_35%)]" />

      <div className="relative flex min-h-screen">
        <aside className="fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-emerald-500/10 bg-[#07111B]/95 px-5 py-5 backdrop-blur-xl">
          <Link href="/dashboard" className="mb-6 flex justify-center">
            <img
              src="/arenaflow-logo.png"
              alt="ArenaFlow"
              className="h-32 w-auto object-contain"
            />
          </Link>

          <div className="relative mb-4">
            <button
              type="button"
              onClick={() => setArenaMenuOpen((current) => !current)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.06]"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
                  Arena ativa
                </p>
                <p className="truncate text-sm font-bold text-white">
                  {arenasLoading
                    ? "Carregando..."
                    : activeArenaInfo?.name || "Selecionar arena"}
                </p>
              </div>

              <ChevronsUpDown size={18} className="text-slate-400" />
            </button>

            {arenaMenuOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] shadow-2xl shadow-black/40">
                {arenas.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400">
                    Nenhuma arena vinculada.
                  </div>
                ) : (
                  arenas.map((item) => {
                    const arena = item.arena;
                    const active = item.arena_id === activeArenaId;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => changeArena(item.arena_id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.05]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">
                            {arena?.name || "Arena sem nome"}
                          </p>
                          <p className="text-xs capitalize text-slate-500">
                            {item.role}
                          </p>
                        </div>

                        {active && <Check size={18} className="text-emerald-400" />}
                      </button>
                    );
                  })
                )}

                <Link
                  href="/dashboard/arena/new"
                  onClick={() => setArenaMenuOpen(false)}
                  className="block border-t border-white/10 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-white/[0.05]"
                >
                  + Nova arena
                </Link>
              </div>
            )}
          </div>

          {isBlocked && (
            <div className="mb-4 rounded-3xl border border-red-500/30 bg-red-500/10 p-4">
              <div className="flex items-start gap-3">
                <Lock size={18} className="mt-1 shrink-0 text-red-300" />
                <div>
                  <p className="font-black text-red-200">Acesso bloqueado</p>
                  <p className="mt-1 text-xs leading-relaxed text-red-100/75">
                    Regularize a mensalidade para liberar o painel.
                  </p>
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard size={18} />}
              active={pathname === "/dashboard"}
            >
              Dashboard
            </NavLink>

            <NavGroup
              title="Minha Arena"
              href="/dashboard/arena?tab=visual"
              icon={<Building2 size={18} />}
              active={pathname.startsWith("/dashboard/arena")}
              items={arenaSubLinks}
              activeKey={arenaTab}
            />

            <NavLink
              href="/dashboard/fields"
              icon={<MapPinned size={18} />}
              active={pathname.startsWith("/dashboard/fields")}
            >
              Quadras
            </NavLink>

            <NavGroup
              title="Reservas"
              href="/dashboard/bookings?view=agenda"
              icon={<CalendarDays size={18} />}
              active={pathname.startsWith("/dashboard/bookings")}
              items={bookingSubLinks}
              activeKey={bookingView}
            />

            <NavLink
              href="/dashboard/customers"
              icon={<Users size={18} />}
              active={pathname.startsWith("/dashboard/customers")}
            >
              Clientes
            </NavLink>

            <NavGroup
              title="Financeiro"
              href="/dashboard/finance?view=resumo"
              icon={<Wallet size={18} />}
              active={pathname.startsWith("/dashboard/finance")}
              items={financeSubLinks}
              activeKey={financeView}
            />

            <NavLink
              href="/dashboard/billing"
              icon={<CreditCard size={18} />}
              active={pathname.startsWith("/dashboard/billing")}
            >
              Minha mensalidade
            </NavLink>
          </nav>

          <div className="mt-4 rounded-3xl border border-emerald-500/10 bg-gradient-to-br from-white/[0.04] to-emerald-500/[0.03] p-4">
            <p className="font-bold text-white">ArenaFlow Premium</p>
            <p className="mt-1 text-xs text-slate-400">
              Gestão premium para arenas esportivas.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500 hover:text-white"
          >
            <LogOut size={18} />
            Sair
          </button>
        </aside>

        <main className="ml-72 min-h-screen flex-1 p-8">
          <div className="mx-auto max-w-[1500px]">
            {checkingBilling ? (
              <div className="flex min-h-[70vh] items-center justify-center">
                <div className="rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4 text-sm font-bold text-slate-300">
                  Verificando assinatura...
                </div>
              </div>
            ) : isBlocked && !isBillingPage ? (
              <BlockedPanel
                arenaName={billingStatus?.name || activeArenaInfo?.name || "sua arena"}
                reason={billingStatus?.blocked_reason || "Mensalidade em atraso."}
              />
            ) : (
              children
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function BlockedPanel({ arenaName, reason }: { arenaName: string; reason: string }) {
  function openWhatsapp() {
    const message = `Olá, quero regularizar minha mensalidade do ArenaFlow.

Arena: ${arenaName}
Motivo: ${reason}

Vou fazer o Pix e enviar o comprovante por aqui.`;

    window.open(
      `https://wa.me/${BILLING_WHATSAPP}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  }

  return (
    <section className="flex min-h-[75vh] items-center justify-center">
      <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-red-500/30 bg-[#0F172A] shadow-2xl shadow-black/30">
        <div className="relative p-8 md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.18),transparent_35%)]" />

          <div className="relative">
            <div className="mb-6 inline-flex rounded-3xl bg-red-500/15 p-4 text-red-300">
              <Lock size={36} />
            </div>

            <p className="text-sm font-black uppercase tracking-[0.25em] text-red-300">
              Acesso temporariamente bloqueado
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
              Regularize sua mensalidade
            </h1>

            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">
              O painel da arena <strong className="text-white">{arenaName}</strong> foi bloqueado temporariamente. Para voltar a usar o ArenaFlow, faça o pagamento e envie o comprovante pelo WhatsApp.
            </p>

            <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-5">
              <div className="flex gap-3">
                <AlertTriangle className="mt-1 shrink-0 text-red-300" />
                <div>
                  <p className="font-black text-red-100">Motivo do bloqueio</p>
                  <p className="mt-1 text-sm leading-relaxed text-red-100/75">{reason}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Link
                href="/dashboard/billing"
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-5 text-lg font-black text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                <CreditCard />
                Ver mensalidade
              </Link>

              <button
                type="button"
                onClick={openWhatsapp}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 text-lg font-black text-white transition hover:border-emerald-400 hover:text-emerald-300"
              >
                <MessageCircle />
                Falar no WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-4 py-3 font-bold text-[#04110A] shadow-lg shadow-emerald-500/20"
          : "flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
      }
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

function NavGroup({
  title,
  href,
  active,
  icon,
  items,
  activeKey,
}: {
  title: string;
  href: string;
  active: boolean;
  icon: React.ReactNode;
  items: SubLink[];
  activeKey: string;
}) {
  return (
    <div>
      <Link
        href={href}
        className={
          active
            ? "flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-4 py-3 font-bold text-[#04110A] shadow-lg shadow-emerald-500/20"
            : "flex items-center justify-between rounded-2xl px-4 py-3 font-semibold text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
        }
      >
        <span className="flex items-center gap-3">
          {icon}
          {title}
        </span>
        <ChevronRight size={16} className={active ? "rotate-90 transition" : "transition"} />
      </Link>

      {active && (
        <div className="ml-5 mt-2 space-y-1 border-l border-white/10 pl-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                activeKey === item.key
                  ? "block rounded-xl bg-white/[0.06] px-3 py-2 text-sm font-bold text-[#22C55E]"
                  : "block rounded-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              }
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

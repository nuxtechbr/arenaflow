"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  Clock,
  ChevronRight,
  ChevronsUpDown,
  CreditCard,
  Crown,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Sparkles,
  Users,
  Wallet,
  X,
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

type SubscriptionPlanStatus = {
  id: string;
  plan_key: string | null;
  status: string | null;
  lifecycle_stage: string | null;
  billing_provider: string | null;
  allow_multi_arena: boolean | null;
  max_arenas: number | null;
  asaas_status: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  asaas_subscription_id: string | null;
};

const BILLING_WHATSAPP = "5522999270052";
const today = new Date().toISOString().slice(0, 10);

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingStatus, setBillingStatus] = useState<ActiveArenaBillingStatus | null>(null);
  const [planStatus, setPlanStatus] = useState<SubscriptionPlanStatus | null>(null);
  const [checkingBilling, setCheckingBilling] = useState(false);

  useEffect(() => {
    loadActiveArenaBillingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArenaId]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setArenaMenuOpen(false);
  }, [pathname, searchParams]);

  const isBlocked = billingStatus?.subscription_status === "blocked";
  const isBillingPage = pathname.startsWith("/dashboard/billing");
  const isProPlan = Boolean(planStatus?.allow_multi_arena);
  const planKey = planStatus?.plan_key || "essential";
  const maxArenas = Number(planStatus?.max_arenas || 1);
  const businessStatus = getSubscriptionBusinessStatus(planStatus);
  const isTrialExpired = businessStatus === "trial_expired";
  const isTrialing = businessStatus === "trialing";
  const trialDaysLeft = planStatus?.trial_ends_at ? daysBetween(today, planStatus.trial_ends_at.slice(0, 10)) : null;

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

  const navContent = (
    <SidebarContent
      pathname={pathname}
      arenaTab={arenaTab}
      bookingView={bookingView}
      financeView={financeView}
      arenas={arenas}
      activeArenaId={activeArenaId}
      activeArenaInfo={activeArenaInfo}
      arenasLoading={arenasLoading}
      arenaMenuOpen={arenaMenuOpen}
      setArenaMenuOpen={setArenaMenuOpen}
      changeArena={changeArena}
      handleLogout={handleLogout}
      arenaSubLinks={arenaSubLinks}
      bookingSubLinks={bookingSubLinks}
      financeSubLinks={financeSubLinks}
      planKey={planKey}
      isProPlan={isProPlan}
      maxArenas={maxArenas}
    />
  );

  async function loadActiveArenaBillingStatus() {
    if (!activeArenaId) {
      setBillingStatus(null);
      setPlanStatus(null);
      return;
    }

    setCheckingBilling(true);

    const [arenaRes, subscriptionRes] = await Promise.all([
      supabase
        .from("arenas")
        .select("id, name, subscription_status, blocked_reason")
        .eq("id", activeArenaId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, plan_key, status, lifecycle_stage, billing_provider, allow_multi_arena, max_arenas, asaas_status, trial_started_at, trial_ends_at, asaas_subscription_id")
        .eq("arena_id", activeArenaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (arenaRes.error) {
      console.error(arenaRes.error);
      setBillingStatus(null);
    } else {
      setBillingStatus((arenaRes.data || null) as ActiveArenaBillingStatus | null);
    }

    if (subscriptionRes.error) {
      console.error(subscriptionRes.error);
      setPlanStatus(null);
    } else {
      setPlanStatus((subscriptionRes.data || null) as SubscriptionPlanStatus | null);
    }

    setCheckingBilling(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function changeArena(arenaId: string) {
    if (!isProPlan && arenaId !== activeArenaId) {
      setArenaMenuOpen(false);
      setMobileMenuOpen(false);
      window.location.href = "/dashboard/billing";
      return;
    }

    setActiveArenaId(arenaId);
    setArenaMenuOpen(false);
    setMobileMenuOpen(false);
    window.location.href = "/dashboard";
  }

  function openBillingWhatsapp() {
    const arenaName = activeArenaInfo?.name || "Minha arena";
    const message = `Olá, quero regularizar minha mensalidade do ArenaFlow.\n\nArena: ${arenaName}`;
    window.open(`https://wa.me/${BILLING_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-[#050B12] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(22,163,74,0.08),transparent_35%)]" />

      <aside className="fixed left-0 top-0 z-50 hidden h-screen w-72 flex-col border-r border-emerald-500/10 bg-[#07111B]/95 px-5 py-5 backdrop-blur-xl lg:flex">
        {navContent}
      </aside>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#07111B]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white"
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>

          <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
            <img src="/arenaflow-logo.png" alt="ArenaFlow" className="h-10 w-auto object-contain" />
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400">Arena ativa</p>
              <p className="truncate text-sm font-black text-white">
                {arenasLoading ? "Carregando..." : activeArenaInfo?.name || "Selecionar arena"}
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard/billing"
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
            aria-label="Minha mensalidade"
          >
            <CreditCard size={20} />
          </Link>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Fechar menu"
          />

          <aside className="absolute left-0 top-0 flex h-full w-[88vw] max-w-[340px] flex-col border-r border-white/10 bg-[#07111B] px-5 py-5 shadow-2xl shadow-black">
            <div className="mb-4 flex items-center justify-between">
              <img src="/arenaflow-logo.png" alt="ArenaFlow" className="h-16 w-auto object-contain" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-slate-300"
                aria-label="Fechar menu"
              >
                <X size={22} />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}

      <main className="relative min-h-screen pb-24 lg:ml-72 lg:pb-0">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-5 md:px-6 lg:p-8">
          {checkingBilling && !isBillingPage ? (
            <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 text-sm text-slate-300">
              Verificando assinatura...
            </div>
          ) : isBlocked && !isBillingPage ? (
            <BlockedPanel
              reason={billingStatus?.blocked_reason || "Sua mensalidade está pendente."}
              onWhatsapp={openBillingWhatsapp}
            />
          ) : isTrialExpired && !isBillingPage ? (
            <TrialExpiredPanel
              trialEndsAt={planStatus?.trial_ends_at || null}
              onWhatsapp={openBillingWhatsapp}
            />
          ) : (
            <>
              {isTrialing && !isBillingPage && (
                <TrialWarningBanner daysLeft={trialDaysLeft} trialEndsAt={planStatus?.trial_ends_at || null} />
              )}
              {children}
            </>
          )}
        </div>
      </main>

      <MobileBottomNav pathname={pathname} />
    </div>
  );
}

function SidebarContent({
  pathname,
  arenaTab,
  bookingView,
  financeView,
  arenas,
  activeArenaId,
  activeArenaInfo,
  arenasLoading,
  arenaMenuOpen,
  setArenaMenuOpen,
  changeArena,
  handleLogout,
  arenaSubLinks,
  bookingSubLinks,
  financeSubLinks,
  planKey,
  isProPlan,
  maxArenas,
}: {
  pathname: string;
  arenaTab: string;
  bookingView: string;
  financeView: string;
  arenas: any[];
  activeArenaId: string;
  activeArenaInfo: { id: string; name: string; logo_url: string | null } | null;
  arenasLoading: boolean;
  arenaMenuOpen: boolean;
  setArenaMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  changeArena: (arenaId: string) => void;
  handleLogout: () => void;
  arenaSubLinks: SubLink[];
  bookingSubLinks: SubLink[];
  financeSubLinks: SubLink[];
  planKey: string;
  isProPlan: boolean;
  maxArenas: number;
}) {
  return (
    <>
      <Link href="/dashboard" className="mb-5 hidden justify-center lg:flex">
        <img src="/arenaflow-logo.png" alt="ArenaFlow" className="h-28 w-auto object-contain" />
      </Link>

      <div className="relative mb-4">
        <button
          type="button"
          onClick={() => isProPlan && setArenaMenuOpen((current) => !current)}
          className={
            isProPlan
              ? "flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left hover:bg-white/[0.06]"
              : "flex w-full items-center justify-between rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-left"
          }
        >
          <div className="min-w-0">
            <p className={isProPlan ? "text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400" : "text-xs font-semibold uppercase tracking-[0.18em] text-yellow-300"}>
              {isProPlan ? "Arena ativa" : "Essencial • 1 arena"}
            </p>
            <p className="truncate text-sm font-bold text-white">
              {arenasLoading ? "Carregando..." : activeArenaInfo?.name || "Selecionar arena"}
            </p>
          </div>
          {isProPlan ? <ChevronsUpDown size={18} className="shrink-0 text-slate-400" /> : <Lock size={18} className="shrink-0 text-yellow-300" />}
        </button>

        {!isProPlan && (
          <Link
            href="/dashboard/billing"
            className="mt-2 flex items-center justify-between rounded-2xl border border-white/10 bg-[#0F172A] px-4 py-3 text-xs font-bold text-slate-300 transition hover:border-emerald-400"
          >
            <span>Multiarenas disponível no Pro</span>
            <Crown size={16} className="text-emerald-300" />
          </Link>
        )}

        {arenaMenuOpen && isProPlan && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0F172A] shadow-2xl shadow-black/40">
            {arenas.length === 0 ? (
              <div className="p-4 text-sm text-slate-400">Nenhuma arena vinculada.</div>
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
                      <p className="truncate text-sm font-bold text-white">{arena?.name || "Arena sem nome"}</p>
                      <p className="text-xs capitalize text-slate-500">{item.role}</p>
                    </div>
                    {active && <Check size={18} className="shrink-0 text-emerald-400" />}
                  </button>
                );
              })
            )}

            <Link href="/dashboard/arena/new" className="block border-t border-white/10 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-white/[0.05]">
              + Nova arena
            </Link>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLink href="/dashboard" icon={<LayoutDashboard size={18} />} active={pathname === "/dashboard"}>
          Dashboard
        </NavLink>

        <NavLink
          href="/dashboard/onboarding"
          icon={<Sparkles size={18} />}
          active={pathname.startsWith("/dashboard/onboarding")}
        >
          Implantação
        </NavLink>

        <NavLink
          href="/dashboard/messages"
          icon={<MessageCircle size={18} />}
          active={pathname.startsWith("/dashboard/messages")}
        >
          Mensagens
        </NavLink>

        <NavGroup
          title="Minha Arena"
          href="/dashboard/arena?tab=visual"
          icon={<Building2 size={18} />}
          active={pathname.startsWith("/dashboard/arena")}
          items={arenaSubLinks}
          activeKey={arenaTab}
        />

        <NavLink href="/dashboard/fields" icon={<MapPinned size={18} />} active={pathname.startsWith("/dashboard/fields")}>
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

        <NavLink href="/dashboard/customers" icon={<Users size={18} />} active={pathname.startsWith("/dashboard/customers")}>
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

        <NavLink href="/dashboard/billing" icon={<CreditCard size={18} />} active={pathname.startsWith("/dashboard/billing")}>
          Minha mensalidade
        </NavLink>
      </nav>

      <div className="mt-4 rounded-3xl border border-emerald-500/10 bg-gradient-to-br from-white/[0.04] to-emerald-500/[0.03] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-white">{isProPlan ? "ArenaFlow Pro" : "ArenaFlow Essencial"}</p>
            <p className="mt-1 text-xs text-slate-400">
              {isProPlan ? `Multiarenas liberado • até ${maxArenas} arenas` : "1 arena ativa • upgrade libera multiarenas"}
            </p>
          </div>
          {isProPlan ? <Crown size={20} className="text-emerald-300" /> : <Lock size={20} className="text-yellow-300" />}
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-bold text-red-300 transition hover:bg-red-500 hover:text-white"
      >
        <LogOut size={18} />
        Sair
      </button>
    </>
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

function MobileBottomNav({ pathname }: { pathname: string }) {
  const items = useMemo(
    () => [
      { href: "/dashboard", label: "Início", icon: <LayoutDashboard size={20} />, active: pathname === "/dashboard" },
      { href: "/dashboard/onboarding", label: "Implantação", icon: <Sparkles size={20} />, active: pathname.startsWith("/dashboard/onboarding") },
      { href: "/dashboard/messages", label: "Msgs", icon: <MessageCircle size={20} />, active: pathname.startsWith("/dashboard/messages") },
      { href: "/dashboard/bookings?view=agenda", label: "Agenda", icon: <CalendarDays size={20} />, active: pathname.startsWith("/dashboard/bookings") },
      { href: "/dashboard/finance?view=resumo", label: "Financeiro", icon: <Wallet size={20} />, active: pathname.startsWith("/dashboard/finance") },
      { href: "/dashboard/billing", label: "Plano", icon: <CreditCard size={20} />, active: pathname.startsWith("/dashboard/billing") },
    ],
    [pathname]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#07111B]/95 px-2 py-2 backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-6 gap-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              item.active
                ? "flex flex-col items-center justify-center gap-1 rounded-2xl bg-emerald-500 px-2 py-2 text-[11px] font-black text-black"
                : "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold text-slate-400"
            }
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}


function TrialWarningBanner({
  daysLeft,
  trialEndsAt,
}: {
  daysLeft: number | null;
  trialEndsAt: string | null;
}) {
  const urgent = daysLeft !== null && daysLeft <= 1;

  return (
    <div
      className={
        urgent
          ? "mb-5 rounded-[1.5rem] border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-50"
          : "mb-5 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-50"
      }
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <div className={urgent ? "rounded-2xl bg-yellow-500/20 p-3 text-yellow-300" : "rounded-2xl bg-emerald-500/20 p-3 text-emerald-300"}>
            <Clock size={22} />
          </div>

          <div>
            <p className="font-black">
              {urgent
                ? "Seu teste está terminando"
                : "Você está usando o teste grátis do ArenaFlow"}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {daysLeft === null
                ? "Ative a assinatura quando estiver pronto para continuar."
                : daysLeft <= 0
                  ? "Seu teste termina hoje. Ative a assinatura para evitar bloqueio."
                  : daysLeft === 1
                    ? "Falta 1 dia para acabar seu teste."
                    : `Faltam ${daysLeft} dias para acabar seu teste.`}
              {trialEndsAt ? ` Vence em ${formatDate(trialEndsAt)}.` : ""}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/billing"
          className={urgent ? "rounded-2xl bg-yellow-400 px-5 py-3 text-center font-black text-black" : "rounded-2xl bg-emerald-500 px-5 py-3 text-center font-black text-black"}
        >
          Ativar assinatura
        </Link>
      </div>
    </div>
  );
}

function TrialExpiredPanel({
  trialEndsAt,
  onWhatsapp,
}: {
  trialEndsAt: string | null;
  onWhatsapp: () => void;
}) {
  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded-[2rem] border border-yellow-500/20 bg-[#0F172A] p-6 text-center shadow-2xl shadow-black/30 md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-500/10 text-yellow-300">
          <Clock size={34} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-white md:text-4xl">Seu teste grátis terminou</h1>
        <p className="mx-auto mt-3 max-w-lg leading-relaxed text-slate-300">
          {trialEndsAt
            ? `Seu período de teste terminou em ${formatDate(trialEndsAt)}.`
            : "Seu período de teste terminou."}
          {" "}Para continuar usando o ArenaFlow, ative sua assinatura mensal pelo Asaas.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Link href="/dashboard/billing" className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black">
            Ativar assinatura
          </Link>
          <button
            type="button"
            onClick={onWhatsapp}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
          >
            <MessageCircle size={18} />
            Falar no WhatsApp
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100/90">
          Sua assinatura só começa quando você clicar em ativar. A recorrência é gerada automaticamente no Asaas.
        </div>
      </div>
    </section>
  );
}

function getSubscriptionBusinessStatus(subscription: SubscriptionPlanStatus | null) {
  if (!subscription) return "pending";

  const status = String(subscription.status || "").toLowerCase();
  const lifecycle = String(subscription.lifecycle_stage || "").toLowerCase();
  const asaas = String(subscription.asaas_status || "").toUpperCase();

  if (status === "blocked") return "blocked";
  if (status === "overdue" || asaas === "OVERDUE") return "overdue";
  if (status === "active" || lifecycle === "active" || ["RECEIVED", "CONFIRMED", "ACTIVE"].includes(asaas)) return "active";

  if (status === "trialing" || lifecycle === "trial") {
    if (subscription.trial_ends_at && daysBetween(today, subscription.trial_ends_at.slice(0, 10)) < 0) {
      return "trial_expired";
    }

    return "trialing";
  }

  return "pending";
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function formatDate(date: string) {
  if (!date) return "-";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}


function BlockedPanel({ reason, onWhatsapp }: { reason: string; onWhatsapp: () => void }) {
  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded-[2rem] border border-red-500/20 bg-[#0F172A] p-6 text-center shadow-2xl shadow-black/30 md:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10 text-red-300">
          <Lock size={34} />
        </div>

        <h1 className="mt-6 text-3xl font-black text-white md:text-4xl">Acesso temporariamente bloqueado</h1>
        <p className="mx-auto mt-3 max-w-lg leading-relaxed text-slate-300">
          {reason || "Sua mensalidade do ArenaFlow está pendente. Regularize para voltar a usar o painel."}
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <Link href="/dashboard/billing" className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black">
            Ver mensalidade
          </Link>
          <button
            type="button"
            onClick={onWhatsapp}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
          >
            <MessageCircle size={18} />
            Falar no WhatsApp
          </button>
        </div>

        <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100/90">
          <div className="flex items-center justify-center gap-2 font-black text-yellow-100">
            <AlertTriangle size={18} />
            Regularização pelo Asaas
          </div>
          <p className="mt-2">Após a confirmação do pagamento, o webhook do Asaas libera o acesso automaticamente.</p>
        </div>
      </div>
    </section>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  Wallet,
  Zap,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useActiveArena } from "../../hooks/use-active-arena";

type Arena = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  cover_url: string | null;
  subscription_status?: string | null;
};

type Booking = {
  id: string;
  arena_id: string;
  customer_name: string;
  customer_whatsapp: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  status: string;
  fields?: FieldRelation;
};

type RecurringInvoice = {
  id: string;
  arena_id: string;
  customer_name: string;
  customer_whatsapp: string | null;
  reference_month: string | null;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string;
};

type RecurringBooking = {
  id: string;
  arena_id: string;
  customer_name: string;
  customer_whatsapp: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  status: string;
  monthly_amount: number | null;
  next_due_date: string | null;
  fields?: FieldRelation;
};

type MessageQueueItem = {
  id: string;
  arena_id: string;
  customer_name: string | null;
  phone: string;
  message_type: string;
  message_body: string;
  status: string;
  created_at: string;
};

type OnboardingChecklist = {
  has_logo: boolean;
  has_cover: boolean;
  has_gallery: boolean;
  has_fields: boolean;
  has_prices: boolean;
  has_hours: boolean;
  has_pix: boolean;
  public_link_tested: boolean;
};

type FieldRelation = { name: string } | { name: string }[] | null | undefined;

const today = new Date().toISOString().slice(0, 10);
const currentMonth = new Date().toISOString().slice(0, 7);
const tomorrow = addDays(today, 1);
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function DashboardHomePage() {
  const { activeArenaId, loading: arenaLoading } = useActiveArena();

  const [loading, setLoading] = useState(true);
  const [arena, setArena] = useState<Arena | null>(null);
  const [todayBookings, setTodayBookings] = useState<Booking[]>([]);
  const [tomorrowBookings, setTomorrowBookings] = useState<Booking[]>([]);
  const [monthBookings, setMonthBookings] = useState<Booking[]>([]);
  const [recurringBookings, setRecurringBookings] = useState<RecurringBooking[]>([]);
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoice[]>([]);
  const [messages, setMessages] = useState<MessageQueueItem[]>([]);
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);

  useEffect(() => {
    if (!arenaLoading && activeArenaId) loadDashboard();
    if (!arenaLoading && !activeArenaId) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaLoading, activeArenaId]);

  const onboardingProgress = useMemo(() => {
    if (!checklist) return 0;

    const values = [
      checklist.has_logo,
      checklist.has_cover,
      checklist.has_gallery,
      checklist.has_fields,
      checklist.has_prices,
      checklist.has_hours,
      checklist.has_pix,
      checklist.public_link_tested,
    ];

    const done = values.filter(Boolean).length;

    return Math.round((done / values.length) * 100);
  }, [checklist]);

  const overdueInvoices = useMemo(() => {
    return recurringInvoices.filter((invoice) => invoice.status !== "paid" && invoice.due_date < today);
  }, [recurringInvoices]);

  const dueSoonInvoices = useMemo(() => {
    return recurringInvoices.filter((invoice) => {
      if (invoice.status === "paid") return false;
      const days = daysBetween(today, invoice.due_date);
      return days >= 0 && days <= 5;
    });
  }, [recurringInvoices]);

  const pendingMessages = useMemo(() => {
    return messages.filter((message) => message.status === "pending");
  }, [messages]);

  const metrics = useMemo(() => {
    const todayRevenue = todayBookings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthRevenue = monthBookings.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthlyMrr = recurringBookings
      .filter((item) => item.status === "active")
      .reduce((sum, item) => sum + Number(item.monthly_amount || 0), 0);
    const overdueAmount = overdueInvoices.reduce(
      (sum, invoice) => sum + Math.max(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0), 0),
      0
    );

    return {
      todayRevenue,
      monthRevenue,
      monthlyMrr,
      overdueAmount,
      activeMonthly: recurringBookings.filter((item) => item.status === "active").length,
    };
  }, [todayBookings, monthBookings, recurringBookings, overdueInvoices]);

  async function loadDashboard() {
    if (!activeArenaId) return;

    setLoading(true);

    const [
      arenaRes,
      todayBookingsRes,
      tomorrowBookingsRes,
      monthBookingsRes,
      recurringBookingsRes,
      recurringInvoicesRes,
      messagesRes,
      checklistRes,
    ] = await Promise.all([
      supabase
        .from("arenas")
        .select("id, name, slug, logo_url, cover_url, subscription_status")
        .eq("id", activeArenaId)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select("*, fields(name)")
        .eq("arena_id", activeArenaId)
        .eq("booking_date", today)
        .neq("status", "cancelada")
        .order("start_time", { ascending: true }),
      supabase
        .from("bookings")
        .select("*, fields(name)")
        .eq("arena_id", activeArenaId)
        .eq("booking_date", tomorrow)
        .neq("status", "cancelada")
        .order("start_time", { ascending: true }),
      supabase
        .from("bookings")
        .select("*, fields(name)")
        .eq("arena_id", activeArenaId)
        .gte("booking_date", `${currentMonth}-01`)
        .neq("status", "cancelada")
        .order("booking_date", { ascending: false }),
      supabase
        .from("recurring_bookings")
        .select("*, fields(name)")
        .eq("arena_id", activeArenaId)
        .order("customer_name", { ascending: true }),
      supabase
        .from("recurring_invoices")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("due_date", { ascending: true })
        .limit(200),
      supabase
        .from("message_queue")
        .select("*")
        .eq("arena_id", activeArenaId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("onboarding_checklists")
        .select("has_logo, has_cover, has_gallery, has_fields, has_prices, has_hours, has_pix, public_link_tested")
        .eq("arena_id", activeArenaId)
        .maybeSingle(),
    ]);

    setLoading(false);

    if (arenaRes.error) console.error(arenaRes.error);
    if (todayBookingsRes.error) console.error(todayBookingsRes.error);
    if (tomorrowBookingsRes.error) console.error(tomorrowBookingsRes.error);
    if (monthBookingsRes.error) console.error(monthBookingsRes.error);
    if (recurringBookingsRes.error) console.error(recurringBookingsRes.error);
    if (recurringInvoicesRes.error) console.error(recurringInvoicesRes.error);
    if (messagesRes.error) console.error(messagesRes.error);
    if (checklistRes.error) console.error(checklistRes.error);

    setArena((arenaRes.data || null) as Arena | null);
    setTodayBookings((todayBookingsRes.data || []) as Booking[]);
    setTomorrowBookings((tomorrowBookingsRes.data || []) as Booking[]);
    setMonthBookings((monthBookingsRes.data || []) as Booking[]);
    setRecurringBookings((recurringBookingsRes.data || []) as RecurringBooking[]);
    setRecurringInvoices((recurringInvoicesRes.data || []) as RecurringInvoice[]);
    setMessages((messagesRes.data || []) as MessageQueueItem[]);
    setChecklist((checklistRes.data || null) as OnboardingChecklist | null);
  }

  function publicArenaUrl() {
    if (!arena?.slug) return "#";
    if (typeof window === "undefined") return `/arena/${arena.slug}`;
    return `${window.location.origin}/arena/${arena.slug}`;
  }

  function openMessageWhatsapp(message: MessageQueueItem) {
    const phone = normalizePhone(message.phone);
    if (!phone) return alert("Mensagem sem telefone válido.");

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message.message_body)}`, "_blank");
  }

  if (arenaLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando dashboard...
        </div>
      </main>
    );
  }

  if (!activeArenaId) {
    return (
      <main className="min-h-screen text-white">
        <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-8">
          <h1 className="text-3xl font-black">Nenhuma arena selecionada</h1>
          <p className="mt-2 text-slate-400">
            Selecione ou cadastre uma arena para começar a usar o ArenaFlow.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-24 text-white md:pb-0">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-6 md:p-8">
          {arena?.cover_url && (
            <img
              src={arena.cover_url}
              alt={arena.name}
              className="absolute inset-0 h-full w-full object-cover opacity-20"
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-r from-[#0F172A] via-[#0F172A]/95 to-[#0F172A]/75" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_35%)]" />

          <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <Zap size={16} />
                Painel operacional
              </div>

              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white/10">
                  {arena?.logo_url ? (
                    <img src={arena.logo_url} alt={arena.name} className="h-full w-full object-cover" />
                  ) : (
                    <ShieldCheck className="text-emerald-400" size={30} />
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-black tracking-tight md:text-5xl">
                    {arena?.name || "Arena"}
                  </h1>
                  <p className="mt-2 text-sm text-slate-400 md:text-base">
                    Visão rápida de reservas, financeiro, implantação e mensagens.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/dashboard/bookings"
                  className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400"
                >
                  Abrir agenda
                  <ArrowRight size={18} />
                </Link>

                <Link
                  href="/dashboard/messages"
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
                >
                  Mensagens
                  <MessageCircle size={18} />
                </Link>

                {arena?.slug && (
                  <a
                    href={publicArenaUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
                  >
                    Link público
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#07111B]/90 p-5 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-400">Implantação</p>
                  <p className="mt-1 text-4xl font-black">{onboardingProgress}%</p>
                </div>

                <div
                  className={
                    onboardingProgress >= 100
                      ? "rounded-2xl bg-emerald-500 p-4 text-black"
                      : "rounded-2xl bg-yellow-500/10 p-4 text-yellow-300"
                  }
                >
                  {onboardingProgress >= 100 ? <CheckCircle2 size={28} /> : <Sparkles size={28} />}
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${onboardingProgress}%` }}
                />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-sm text-slate-400">
                  {onboardingProgress >= 100 ? "Arena pronta para divulgar." : "Complete para vender melhor."}
                </p>

                <Link
                  href="/dashboard/onboarding"
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-emerald-300 transition hover:border-emerald-400"
                >
                  Ver checklist
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Reservas hoje"
          value={todayBookings.length}
          description={`R$ ${formatMoney(metrics.todayRevenue)} previstos hoje`}
          icon={<CalendarDays />}
          tone="emerald"
        />
        <MetricCard
          title="Receita do mês"
          value={`R$ ${formatMoney(metrics.monthRevenue)}`}
          description={`${monthBookings.length} reservas avulsas no mês`}
          icon={<TrendingUp />}
          tone="blue"
        />
        <MetricCard
          title="MRR da arena"
          value={`R$ ${formatMoney(metrics.monthlyMrr)}`}
          description={`${metrics.activeMonthly} mensalista(s) ativo(s)`}
          icon={<CreditCard />}
          tone="purple"
        />
        <MetricCard
          title="Atrasado"
          value={`R$ ${formatMoney(metrics.overdueAmount)}`}
          description={`${overdueInvoices.length} cobrança(s) vencida(s)`}
          icon={<AlertTriangle />}
          tone="red"
        />
      </section>

      {(overdueInvoices.length > 0 || pendingMessages.length > 0 || onboardingProgress < 100 || dueSoonInvoices.length > 0) && (
        <section className="grid gap-4 lg:grid-cols-3">
          {onboardingProgress < 100 && (
            <ActionAlert
              tone="yellow"
              title="Implantação incompleta"
              description="Finalize fotos, quadras, preços, horários e link público."
              href="/dashboard/onboarding"
              action="Completar"
            />
          )}

          {pendingMessages.length > 0 && (
            <ActionAlert
              tone="emerald"
              title={`${pendingMessages.length} mensagem(ns) pendente(s)`}
              description="Existem cobranças e lembretes prontos para enviar no WhatsApp."
              href="/dashboard/messages"
              action="Ver mensagens"
            />
          )}

          {overdueInvoices.length > 0 && (
            <ActionAlert
              tone="red"
              title={`${overdueInvoices.length} cobrança(s) atrasada(s)`}
              description="Veja os mensalistas em atraso e cobre direto pelo WhatsApp."
              href="/dashboard/finance"
              action="Cobrar agora"
            />
          )}

          {dueSoonInvoices.length > 0 && (
            <ActionAlert
              tone="blue"
              title={`${dueSoonInvoices.length} vencimento(s) próximo(s)`}
              description="Mensalistas com cobrança vencendo nos próximos 5 dias."
              href="/dashboard/finance"
              action="Ver financeiro"
            />
          )}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel
          title="Agenda de hoje"
          description="Próximos horários confirmados ou pendentes."
          icon={<Clock />}
          href="/dashboard/bookings"
          action="Ver agenda"
        >
          {todayBookings.length === 0 ? (
            <EmptyPanel title="Nenhuma reserva para hoje" description="Quando houver reservas, elas aparecerão aqui." />
          ) : (
            <div className="space-y-3">
              {todayBookings.slice(0, 6).map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Mensagens prontas"
          description="Fila operacional gerada pelas automações."
          icon={<MessageCircle />}
          href="/dashboard/messages"
          action="Ver todas"
        >
          {pendingMessages.length === 0 ? (
            <EmptyPanel title="Nenhuma mensagem pendente" description="Execute automações para gerar lembretes e cobranças." />
          ) : (
            <div className="space-y-3">
              {pendingMessages.slice(0, 5).map((message) => (
                <MessageRow
                  key={message.id}
                  message={message}
                  onWhatsapp={() => openMessageWhatsapp(message)}
                />
              ))}
            </div>
          )}
        </DashboardPanel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <DashboardPanel
          title="Mensalistas ativos"
          description="Resumo da recorrência da arena."
          icon={<UserRound />}
          href="/dashboard/finance"
          action="Ver financeiro"
        >
          {recurringBookings.length === 0 ? (
            <EmptyPanel title="Nenhum mensalista ativo" description="Cadastre reservas fixas para criar receita recorrente." />
          ) : (
            <div className="space-y-3">
              {recurringBookings.slice(0, 5).map((item) => (
                <RecurringRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Amanhã"
          description="Reservas do próximo dia."
          icon={<CalendarDays />}
          href="/dashboard/bookings"
          action="Abrir agenda"
        >
          {tomorrowBookings.length === 0 ? (
            <EmptyPanel title="Nenhuma reserva amanhã" description="Os horários de amanhã aparecerão aqui." />
          ) : (
            <div className="space-y-3">
              {tomorrowBookings.slice(0, 5).map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Atalhos rápidos"
          description="Ações mais usadas no dia a dia."
          icon={<Zap />}
        >
          <div className="grid gap-2">
            <QuickLink href="/dashboard/bookings" icon={<CalendarDays size={18} />} label="Nova reserva" />
            <QuickLink href="/dashboard/customers" icon={<UserRound size={18} />} label="Clientes" />
            <QuickLink href="/dashboard/finance" icon={<Wallet size={18} />} label="Financeiro" />
            <QuickLink href="/dashboard/arena" icon={<ShieldCheck size={18} />} label="Configurar arena" />
            <QuickLink href="/dashboard/onboarding" icon={<Sparkles size={18} />} label="Implantação" />
          </div>
        </DashboardPanel>
      </section>
    </main>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  tone: "emerald" | "blue" | "purple" | "red";
}) {
  const color =
    tone === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : tone === "blue"
        ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
        : tone === "purple"
          ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
          : "border-red-500/20 bg-red-500/10 text-red-300";

  return (
    <div className={`rounded-[2rem] border p-5 ${color}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold opacity-80">{title}</p>
          <p className="mt-2 text-3xl font-black md:text-4xl">{value}</p>
          <p className="mt-2 text-xs font-bold opacity-70">{description}</p>
        </div>

        <div className="rounded-2xl bg-black/10 p-3">{icon}</div>
      </div>
    </div>
  );
}

function ActionAlert({
  tone,
  title,
  description,
  href,
  action,
}: {
  tone: "emerald" | "yellow" | "red" | "blue";
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  const color =
    tone === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
      : tone === "yellow"
        ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-100"
        : tone === "blue"
          ? "border-blue-500/20 bg-blue-500/10 text-blue-100"
          : "border-red-500/20 bg-red-500/10 text-red-100";

  return (
    <Link href={href} className={`rounded-[2rem] border p-5 transition hover:scale-[1.01] ${color}`}>
      <h3 className="text-xl font-black">{title}</h3>
      <p className="mt-2 text-sm opacity-80">{description}</p>
      <span className="mt-4 flex items-center gap-2 text-sm font-black">
        {action}
        <ArrowRight size={16} />
      </span>
    </Link>
  );
}

function DashboardPanel({
  title,
  description,
  icon,
  href,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href?: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <span className="text-emerald-400">{icon}</span>
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>

        {href && action && (
          <Link
            href={href}
            className="hidden rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-emerald-300 transition hover:border-emerald-400 md:block"
          >
            {action}
          </Link>
        )}
      </div>

      {children}
    </section>
  );
}

function BookingRow({ booking }: { booking: Booking }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111B] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-white">{booking.customer_name}</p>
          <p className="mt-1 text-sm text-slate-400">
            {getFieldName(booking.fields)} • {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={booking.status} />
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
            R$ {formatMoney(booking.amount)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecurringRow({ item }: { item: RecurringBooking }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111B] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-black text-white">{item.customer_name}</p>
          <p className="mt-1 text-sm text-slate-400">
            {getFieldName(item.fields)} • {weekDays[item.weekday]} • {item.start_time.slice(0, 5)}
          </p>
        </div>

        <span className="w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
          R$ {formatMoney(item.monthly_amount || 0)}
        </span>
      </div>
    </div>
  );
}

function MessageRow({ message, onWhatsapp }: { message: MessageQueueItem; onWhatsapp: () => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111B] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-white">{message.customer_name || "Cliente"}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{message.message_body}</p>
        </div>

        <button
          type="button"
          onClick={onWhatsapp}
          className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black transition hover:bg-emerald-400"
        >
          <MessageCircle size={18} />
          Enviar
        </button>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-3xl border border-white/10 bg-[#07111B] p-4 font-black text-white transition hover:border-emerald-400 hover:bg-emerald-500/10"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-2xl bg-emerald-500/10 p-2 text-emerald-300">{icon}</span>
        {label}
      </span>

      <ArrowRight size={18} className="text-slate-500" />
    </Link>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
      <BarChart3 className="mx-auto text-slate-600" size={36} />
      <h3 className="mt-3 text-lg font-black text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "confirmada" || status === "paid" || status === "active"
      ? "bg-emerald-500/10 text-emerald-300"
      : status === "cancelada" || status === "overdue"
        ? "bg-red-500/10 text-red-300"
        : status === "aguardando_sinal"
          ? "bg-yellow-500/10 text-yellow-300"
          : "bg-blue-500/10 text-blue-300";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>
      {translateStatus(status)}
    </span>
  );
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    aguardando_sinal: "Sinal",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
    concluida: "Concluída",
    active: "Ativo",
    paid: "Pago",
    pending: "Pendente",
    overdue: "Atrasado",
  };

  return labels[status] || status;
}

function getFieldName(fields: FieldRelation) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);

  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

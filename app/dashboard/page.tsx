"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  DollarSign,
  MapPinned,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useActiveArena } from "../../hooks/use-active-arena";

type FieldRelation = { name: string } | { name: string }[] | null | undefined;

type Booking = {
  id: string;
  customer_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  status: string;
  fields?: FieldRelation;
};

type Field = {
  id: string;
  status: string;
};

type Customer = {
  id: string;
};

export default function DashboardPage() {
  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (activeArenaId) {
      loadData(activeArenaId);
    }
  }, [activeArenaId]);

  const todayBookings = useMemo(() => {
    return bookings
      .filter(
        (booking) =>
          booking.booking_date === today && booking.status !== "cancelada"
      )
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [bookings, today]);

  const todayRevenue = todayBookings
    .filter(isPaidBooking)
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

  const monthRevenue = bookings
    .filter((booking) => {
      const month = today.slice(0, 7);
      return booking.booking_date.startsWith(month) && isPaidBooking(booking);
    })
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

  const pendingCount = bookings.filter(
    (booking) =>
      booking.status === "pendente" || booking.status === "aguardando_sinal"
  ).length;

  async function loadData(arenaId: string) {
    setLoading(true);

    const [bookingsRes, fieldsRes, customersRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, customer_name, booking_date, start_time, end_time, amount, status, fields(name)"
        )
        .eq("arena_id", arenaId)
        .order("booking_date", { ascending: false }),

      supabase
        .from("fields")
        .select("id, status")
        .eq("arena_id", arenaId),

      supabase
        .from("customers")
        .select("id")
        .eq("arena_id", arenaId),
    ]);

    setBookings((bookingsRes.data || []) as Booking[]);
    setFields((fieldsRes.data || []) as Field[]);
    setCustomers((customersRes.data || []) as Customer[]);
    setLoading(false);
  }

  if (arenaLoading || loading) {
    return <p className="text-white">Carregando dashboard...</p>;
  }

  if (!activeArenaId) {
    return (
      <div className="rounded-3xl border border-white/10 bg-[#0F172A]/80 p-8">
        <h1 className="text-3xl font-black text-white">Nenhuma arena selecionada</h1>
        <p className="mt-2 text-slate-400">
          Selecione uma arena no menu lateral para continuar.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#22C55E]">Dashboard</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-white">
            {activeArenaInfo?.name || "Arena"}
          </h1>
          <p className="mt-2 text-slate-400">
            Visão operacional da arena selecionada.
          </p>
        </div>

        <a
          href="/dashboard/bookings?view=nova"
          className="rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-5 py-3 font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
        >
          + Nova reserva
        </a>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Faturamento hoje"
          value={`R$ ${formatMoney(todayRevenue)}`}
          helper="Reservas confirmadas"
          icon={<DollarSign size={22} />}
        />

        <StatCard
          title="Faturamento mês"
          value={`R$ ${formatMoney(monthRevenue)}`}
          helper="Receita confirmada"
          icon={<TrendingUp size={22} />}
        />

        <StatCard
          title="Reservas hoje"
          value={String(todayBookings.length)}
          helper="Agenda do dia"
          icon={<CalendarDays size={22} />}
        />

        <StatCard
          title="Pendências"
          value={String(pendingCount)}
          helper="Sinal ou confirmação"
          icon={<Clock size={22} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-white/10 bg-[#0F172A]/80 p-6 shadow-2xl shadow-black/20">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Agenda de hoje</h2>
              <p className="mt-1 text-sm text-slate-400">
                Próximas reservas do dia.
              </p>
            </div>

            <a
              href="/dashboard/bookings?view=agenda"
              className="text-sm font-bold text-[#22C55E] transition hover:text-white"
            >
              Ver agenda
            </a>
          </div>

          {todayBookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#07111B] p-8 text-center">
              <h3 className="text-xl font-bold text-white">
                Nenhuma reserva hoje
              </h3>
              <p className="mt-2 text-slate-400">
                Sua agenda está livre para novas reservas.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayBookings.slice(0, 6).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#07111B] p-4"
                >
                  <div>
                    <h3 className="font-bold text-white">
                      {booking.customer_name}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {getFieldName(booking.fields)} •{" "}
                      {booking.start_time.slice(0, 5)} às{" "}
                      {booking.end_time.slice(0, 5)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-white">
                      R$ {formatMoney(booking.amount)}
                    </p>
                    <span className="text-xs font-semibold text-[#22C55E]">
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <InfoCard
            title="Quadras cadastradas"
            value={String(fields.length)}
            helper={`${
              fields.filter((field) => field.status === "active").length
            } ativas`}
            icon={<MapPinned size={22} />}
          />

          <InfoCard
            title="Clientes"
            value={String(customers.length)}
            helper="Base cadastrada automaticamente"
            icon={<Users size={22} />}
          />

          <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-5">
            <h2 className="text-xl font-bold text-white">Arena no automático</h2>
            <p className="mt-2 text-sm text-slate-400">
              Continue configurando sua arena para liberar o link público de
              agendamento.
            </p>

            <a
              href="/dashboard/arena?tab=visual"
              className="mt-5 inline-block rounded-2xl bg-[#22C55E] px-4 py-3 font-bold text-black"
            >
              Configurar arena
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0F172A]/80 p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-[#22C55E]">
        {icon}
      </div>

      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-1 text-3xl font-black text-white">{value}</h2>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function InfoCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0F172A]/80 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h2 className="mt-1 text-3xl font-black text-white">{value}</h2>
          <p className="mt-2 text-xs text-slate-500">{helper}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-[#22C55E]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function isPaidBooking(booking: Booking) {
  return booking.status === "confirmada" || booking.status === "concluida";
}

function getFieldName(fields: FieldRelation) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}
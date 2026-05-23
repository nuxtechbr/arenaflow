"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Download,
  DollarSign,
  FileText,
  MessageCircle,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";
import jsPDF from "jspdf";

type FieldRelation = { name: string } | { name: string }[] | null | undefined;

type Booking = {
  id: string;
  customer_name: string;
  customer_whatsapp?: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  status: string;
  source: string | null;
  fields?: FieldRelation;
};

type RecurringInvoice = {
  id: string;
  arena_id: string;
  recurring_booking_id: string | null;
  customer_id: string | null;
  customer_name: string;
  description: string | null;
  reference_month: string | null;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string;
  paid_at: string | null;
  created_at?: string | null;
  recurring_bookings?: {
    customer_whatsapp: string | null;
    fields?: FieldRelation;
  } | null;
};

type ArenaSettings = {
  pix_key: string | null;
  pix_key_type: string | null;
  pix_receiver_name: string | null;
};

type PeriodType =
  | "today"
  | "yesterday"
  | "last7"
  | "thisMonth"
  | "lastMonth"
  | "custom";

type ViewType = "resumo" | "mensalistas" | "grafico" | "status" | "relatorio" | "tabela";

export default function FinancePage() {
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") || "resumo") as ViewType;

  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();
  const [arenaName, setArenaName] = useState("ArenaFlow");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [invoices, setInvoices] = useState<RecurringInvoice[]>([]);
  const [settings, setSettings] = useState<ArenaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>("thisMonth");

  const today = new Date().toISOString().slice(0, 10);
  const initialRange = getRangeByPeriod("thisMonth");

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);

  useEffect(() => {
    if (activeArenaId) loadData();
    if (!activeArenaId && !arenaLoading) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeArenaId, arenaLoading]);

  useEffect(() => {
    if (period !== "custom") {
      const range = getRangeByPeriod(period);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  }, [period]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(
      (booking) =>
        booking.booking_date >= startDate && booking.booking_date <= endDate
    );
  }, [bookings, startDate, endDate]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(
      (invoice) => invoice.due_date >= startDate && invoice.due_date <= endDate
    );
  }, [invoices, startDate, endDate]);

  const confirmedBookings = filteredBookings.filter(isPaidBooking);
  const pendingBookings = filteredBookings.filter((booking) =>
    ["pendente", "aguardando_sinal"].includes(booking.status)
  );
  const canceledBookings = filteredBookings.filter(
    (booking) => booking.status === "cancelada"
  );

  const paidInvoices = filteredInvoices.filter((invoice) => invoice.status === "paid");
  const pendingInvoices = filteredInvoices.filter((invoice) => invoice.status !== "paid");
  const overdueInvoices = invoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.due_date < today
  );
  const dueTodayInvoices = invoices.filter(
    (invoice) => invoice.status !== "paid" && invoice.due_date === today
  );

  const bookingsRevenue = confirmedBookings.reduce(
    (sum, booking) => sum + Number(booking.amount || 0),
    0
  );

  const invoiceReceived = paidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0),
    0
  );

  const invoiceExpected = filteredInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );

  const invoicePendingAmount = pendingInvoices.reduce(
    (sum, invoice) => sum + Math.max(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0), 0),
    0
  );

  const totalRevenue = bookingsRevenue + invoiceReceived;
  const expectedRevenue = bookingsRevenue + invoiceExpected;

  const ticketAverage =
    confirmedBookings.length > 0 ? bookingsRevenue / confirmedBookings.length : 0;

  const todayRevenue = bookings
    .filter((booking) => booking.booking_date === today && isPaidBooking(booking))
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0)
    + invoices
      .filter((invoice) => invoice.paid_at?.slice(0, 10) === today || (invoice.status === "paid" && invoice.due_date === today))
      .reduce((sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0), 0);

  const weekRevenue = bookings
    .filter((booking) => {
      const range = getRangeByPeriod("last7");
      return (
        booking.booking_date >= range.start &&
        booking.booking_date <= range.end &&
        isPaidBooking(booking)
      );
    })
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0)
    + invoices
      .filter((invoice) => {
        const range = getRangeByPeriod("last7");
        return invoice.status === "paid" && invoice.due_date >= range.start && invoice.due_date <= range.end;
      })
      .reduce((sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0), 0);

  const monthRevenue = bookings
    .filter((booking) => {
      const range = getRangeByPeriod("thisMonth");
      return (
        booking.booking_date >= range.start &&
        booking.booking_date <= range.end &&
        isPaidBooking(booking)
      );
    })
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0)
    + invoices
      .filter((invoice) => {
        const range = getRangeByPeriod("thisMonth");
        return invoice.status === "paid" && invoice.due_date >= range.start && invoice.due_date <= range.end;
      })
      .reduce((sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0), 0);

  const chartData = useMemo(() => {
    return getLastDays(7).map((date) => {
      const bookingTotal = bookings
        .filter((booking) => booking.booking_date === date && isPaidBooking(booking))
        .reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

      const invoiceTotal = invoices
        .filter((invoice) => invoice.status === "paid" && invoice.due_date === date)
        .reduce((sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0), 0);

      return {
        date,
        label: date.slice(5).split("-").reverse().join("/"),
        total: bookingTotal + invoiceTotal,
      };
    });
  }, [bookings, invoices]);

  const maxChartValue = Math.max(...chartData.map((item) => item.total), 1);

  async function loadData() {
    if (!activeArenaId) return;
    setLoading(true);

    if (activeArenaInfo?.name) setArenaName(activeArenaInfo.name);

    const [bookingsRes, invoicesRes, settingsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id, customer_name, customer_whatsapp, booking_date, start_time, end_time, amount, status, source, fields(name)"
        )
        .eq("arena_id", activeArenaId)
        .order("booking_date", { ascending: false })
        .order("start_time", { ascending: true }),

      supabase
        .from("recurring_invoices")
        .select(
          "*, recurring_bookings(customer_whatsapp, fields(name))"
        )
        .eq("arena_id", activeArenaId)
        .order("due_date", { ascending: false }),

      supabase
        .from("arena_settings")
        .select("pix_key, pix_key_type, pix_receiver_name")
        .eq("arena_id", activeArenaId)
        .maybeSingle(),
    ]);

    if (bookingsRes.error) {
      alert(bookingsRes.error.message);
      setLoading(false);
      return;
    }

    if (invoicesRes.error) {
      alert(invoicesRes.error.message);
      setLoading(false);
      return;
    }

    setBookings((bookingsRes.data || []) as Booking[]);
    setInvoices((invoicesRes.data || []) as unknown as RecurringInvoice[]);
    setSettings((settingsRes.data || null) as ArenaSettings | null);
    setLoading(false);
  }

  async function markInvoicePaid(invoice: RecurringInvoice) {
    const { error } = await supabase
      .from("recurring_invoices")
      .update({
        status: "paid",
        paid_amount: Number(invoice.amount || 0),
        paid_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    if (error) return alert(error.message);

    if (invoice.recurring_booking_id) {
      await supabase
        .from("recurring_bookings")
        .update({
          payment_status: "paid",
          paid_amount: Number(invoice.amount || 0),
          next_due_date: invoice.due_date,
        })
        .eq("id", invoice.recurring_booking_id);
    }

    await loadData();
  }

  async function markInvoicePartial(invoice: RecurringInvoice) {
    const value = prompt("Qual valor foi pago parcialmente?", String(invoice.paid_amount || ""));
    if (value === null) return;

    const paid = Number(value.replace(",", ".") || 0);
    if (paid <= 0) return alert("Informe um valor válido.");

    const finalStatus = paid >= Number(invoice.amount || 0) ? "paid" : "partial";

    const { error } = await supabase
      .from("recurring_invoices")
      .update({
        status: finalStatus,
        paid_amount: paid,
        paid_at: finalStatus === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", invoice.id);

    if (error) return alert(error.message);

    if (invoice.recurring_booking_id) {
      await supabase
        .from("recurring_bookings")
        .update({
          payment_status: finalStatus,
          paid_amount: paid,
          next_due_date: invoice.due_date,
        })
        .eq("id", invoice.recurring_booking_id);
    }

    await loadData();
  }

  function chargeOnWhatsapp(invoice: RecurringInvoice) {
    const whatsapp = invoice.recurring_bookings?.customer_whatsapp || "";
    if (!whatsapp) {
      alert("Esse mensalista não tem WhatsApp cadastrado.");
      return;
    }

    const pending = Math.max(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0), 0);
    const pixLine = settings?.pix_key
      ? `\n\nChave Pix: ${settings.pix_key}${settings.pix_receiver_name ? `\nRecebedor: ${settings.pix_receiver_name}` : ""}`
      : "";

    const message = `Olá ${invoice.customer_name}! 👋\n\nPassando para lembrar da mensalidade da ${arenaName}.\n\n${invoice.description || "Mensalista"}\nVencimento: ${formatDate(invoice.due_date)}\nValor em aberto: R$ ${formatMoney(pending)}${pixLine}\n\nQualquer dúvida é só responder por aqui. 🙏`;

    const cleanWhatsapp = whatsapp.replace(/\D/g, "");
    const finalWhatsapp = cleanWhatsapp.startsWith("55") ? cleanWhatsapp : `55${cleanWhatsapp}`;

    window.open(`https://wa.me/${finalWhatsapp}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function downloadPdf() {
    const doc = new jsPDF();
    const periodText = `${formatDate(startDate)} até ${formatDate(endDate)}`;

    doc.setFontSize(18);
    doc.text("Relatório Financeiro ArenaFlow", 14, 18);

    doc.setFontSize(11);
    doc.text(`Arena: ${arenaName}`, 14, 28);
    doc.text(`Período: ${periodText}`, 14, 36);
    doc.text(`Gerado em: ${formatDate(today)}`, 14, 44);

    doc.setFontSize(13);
    doc.text("Resumo", 14, 58);

    doc.setFontSize(10);
    doc.text(`Receita confirmada: R$ ${formatMoney(totalRevenue)}`, 14, 68);
    doc.text(`Receita prevista: R$ ${formatMoney(expectedRevenue)}`, 14, 76);
    doc.text(`Mensalistas em aberto: R$ ${formatMoney(invoicePendingAmount)}`, 14, 84);
    doc.text(`Reservas confirmadas/concluídas: ${confirmedBookings.length}`, 14, 92);
    doc.text(`Mensalidades no período: ${filteredInvoices.length}`, 14, 100);

    doc.setFontSize(13);
    doc.text("Reservas", 14, 116);

    let y = 126;
    doc.setFontSize(8);
    doc.text("Cliente", 14, y);
    doc.text("Quadra", 58, y);
    doc.text("Data", 95, y);
    doc.text("Hora", 120, y);
    doc.text("Status", 145, y);
    doc.text("Valor", 178, y);
    y += 6;

    filteredBookings.forEach((booking) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }

      doc.text(cutText(booking.customer_name, 22), 14, y);
      doc.text(cutText(getFieldName(booking.fields), 18), 58, y);
      doc.text(formatDate(booking.booking_date), 95, y);
      doc.text(`${booking.start_time.slice(0, 5)}-${booking.end_time.slice(0, 5)}`, 120, y);
      doc.text(cutText(booking.status, 15), 145, y);
      doc.text(`R$ ${formatMoney(booking.amount)}`, 178, y);
      y += 6;
    });

    doc.addPage();
    y = 18;
    doc.setFontSize(13);
    doc.text("Mensalistas", 14, y);
    y += 10;
    doc.setFontSize(8);
    doc.text("Cliente", 14, y);
    doc.text("Vencimento", 68, y);
    doc.text("Status", 100, y);
    doc.text("Valor", 135, y);
    doc.text("Pago", 165, y);
    y += 6;

    filteredInvoices.forEach((invoice) => {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }

      doc.text(cutText(invoice.customer_name, 28), 14, y);
      doc.text(formatDate(invoice.due_date), 68, y);
      doc.text(cutText(invoice.status, 15), 100, y);
      doc.text(`R$ ${formatMoney(invoice.amount)}`, 135, y);
      doc.text(`R$ ${formatMoney(invoice.paid_amount || 0)}`, 165, y);
      y += 6;
    });

    doc.save(`relatorio-financeiro-${startDate}-a-${endDate}.pdf`);
  }

  if (arenaLoading || loading) {
    return <p className="text-white">Carregando financeiro...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-400">
            Gestão financeira
          </p>
          <h1 className="mt-1 text-4xl font-bold text-white">
            {getViewTitle(view)}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            {getViewDescription(view)} • {arenaName}
          </p>
        </div>

        {(view === "relatorio" || view === "tabela") && (
          <button
            onClick={downloadPdf}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
          >
            <Download size={18} />
            Baixar PDF
          </button>
        )}
      </div>

      {view === "resumo" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Recebido hoje" value={`R$ ${formatMoney(todayRevenue)}`} helper="Reservas + mensalistas" icon={<CalendarDays size={22} />} />
            <StatCard title="Últimos 7 dias" value={`R$ ${formatMoney(weekRevenue)}`} helper="Receita confirmada" icon={<TrendingUp size={22} />} />
            <StatCard title="Recebido no mês" value={`R$ ${formatMoney(monthRevenue)}`} helper="Mês atual" icon={<DollarSign size={22} />} />
            <StatCard title="Em aberto" value={`R$ ${formatMoney(invoicePendingAmount)}`} helper="Mensalistas pendentes" icon={<Wallet size={22} />} />
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StatusCard title="Vencem hoje" value={dueTodayInvoices.length} color="amber" />
            <StatusCard title="Atrasados" value={overdueInvoices.length} color="red" />
            <StatusCard title="Pagos no período" value={paidInvoices.length} color="emerald" />
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
            <h2 className="text-2xl font-bold text-white">Resumo do período</h2>
            <p className="mt-1 text-sm text-slate-400">Receita confirmada, prevista e pendências.</p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
              <SummaryCard label="Receita confirmada" value={`R$ ${formatMoney(totalRevenue)}`} />
              <SummaryCard label="Receita prevista" value={`R$ ${formatMoney(expectedRevenue)}`} />
              <SummaryCard label="Reservas no período" value={String(filteredBookings.length)} />
              <SummaryCard label="Ticket médio" value={`R$ ${formatMoney(ticketAverage)}`} />
            </div>
          </div>

          <InvoicePreview invoices={overdueInvoices.slice(0, 5)} onPaid={markInvoicePaid} onPartial={markInvoicePartial} onCharge={chargeOnWhatsapp} />
        </div>
      )}

      {view === "mensalistas" && (
        <section className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
          <div className="mb-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <h2 className="text-2xl font-bold text-white">Mensalistas e cobranças</h2>
              <p className="mt-1 text-sm text-slate-400">Controle mensalidades, atrasos, parciais e cobrança por WhatsApp.</p>
            </div>
            <PeriodFilter period={period} setPeriod={setPeriod} startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
          </div>
          <InvoiceTable invoices={filteredInvoices} onPaid={markInvoicePaid} onPartial={markInvoicePartial} onCharge={chargeOnWhatsapp} />
        </section>
      )}

      {view === "grafico" && (
        <section className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
          <h2 className="text-2xl font-bold text-white">Receita dos últimos 7 dias</h2>
          <p className="mt-1 text-sm text-slate-400">Reservas + mensalistas pagos.</p>
          <div className="mt-5 flex h-72 items-end gap-3 rounded-2xl bg-slate-950/60 p-4">
            {chartData.map((item) => {
              const height = Math.max((item.total / maxChartValue) * 100, 5);
              return (
                <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-48 w-full items-end">
                    <div className="w-full rounded-t-xl bg-emerald-500/80" style={{ height: `${height}%` }} title={`R$ ${formatMoney(item.total)}`} />
                  </div>
                  <span className="text-xs text-slate-400">{item.label}</span>
                  <strong className="text-xs text-white">R$ {formatMoney(item.total)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {view === "status" && (
        <section className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
          <h2 className="text-2xl font-bold text-white">Status financeiro</h2>
          <p className="mt-1 text-sm text-slate-400">Reservas e mensalistas no período selecionado.</p>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
            <StatusCard title="Reservas confirmadas" value={confirmedBookings.length} color="emerald" />
            <StatusCard title="Reservas pendentes" value={pendingBookings.length} color="amber" />
            <StatusCard title="Mensalidades atrasadas" value={overdueInvoices.length} color="red" />
          </div>
        </section>
      )}

      {view === "relatorio" && (
        <section className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
          <div className="mb-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <h2 className="text-2xl font-bold text-white">Relatório financeiro</h2>
              <p className="mt-1 text-sm text-slate-400">Escolha o período e baixe o relatório em PDF.</p>
            </div>
            <PeriodFilter period={period} setPeriod={setPeriod} startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SummaryCard label="Receita confirmada" value={`R$ ${formatMoney(totalRevenue)}`} />
            <SummaryCard label="Receita prevista" value={`R$ ${formatMoney(expectedRevenue)}`} />
            <SummaryCard label="Mensalidades" value={String(filteredInvoices.length)} />
            <SummaryCard label="Reservas" value={String(filteredBookings.length)} />
          </div>
        </section>
      )}

      {view === "tabela" && (
        <section className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
          <div className="mb-5 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
            <div>
              <h2 className="text-2xl font-bold text-white">Tabela de lançamentos</h2>
              <p className="mt-1 text-sm text-slate-400">Reservas e mensalidades no período filtrado.</p>
            </div>
            <PeriodFilter period={period} setPeriod={setPeriod} startDate={startDate} endDate={endDate} setStartDate={setStartDate} setEndDate={setEndDate} />
          </div>
          <BookingTable bookings={filteredBookings} />
          <div className="mt-6">
            <h3 className="mb-3 text-xl font-bold text-white">Mensalidades</h3>
            <InvoiceTable invoices={filteredInvoices} onPaid={markInvoicePaid} onPartial={markInvoicePartial} onCharge={chargeOnWhatsapp} />
          </div>
        </section>
      )}
    </div>
  );
}

function InvoicePreview({ invoices, onPaid, onPartial, onCharge }: { invoices: RecurringInvoice[]; onPaid: (invoice: RecurringInvoice) => void; onPartial: (invoice: RecurringInvoice) => void; onCharge: (invoice: RecurringInvoice) => void }) {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-red-300" size={22} />
        <h2 className="text-2xl font-bold text-white">Atrasos importantes</h2>
      </div>
      <p className="mt-1 text-sm text-slate-400">Mensalistas com cobrança vencida.</p>
      <div className="mt-5 space-y-3">
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5 text-slate-400">Nenhum mensalista atrasado.</div>
        ) : (
          invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} onPaid={onPaid} onPartial={onPartial} onCharge={onCharge} />)
        )}
      </div>
    </div>
  );
}

function InvoiceTable({ invoices, onPaid, onPartial, onCharge }: { invoices: RecurringInvoice[]; onPaid: (invoice: RecurringInvoice) => void; onPartial: (invoice: RecurringInvoice) => void; onCharge: (invoice: RecurringInvoice) => void }) {
  return (
    <div className="space-y-3">
      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">Nenhuma mensalidade no período.</div>
      ) : (
        invoices.map((invoice) => <InvoiceRow key={invoice.id} invoice={invoice} onPaid={onPaid} onPartial={onPartial} onCharge={onCharge} />)
      )}
    </div>
  );
}

function InvoiceRow({ invoice, onPaid, onPartial, onCharge }: { invoice: RecurringInvoice; onPaid: (invoice: RecurringInvoice) => void; onPartial: (invoice: RecurringInvoice) => void; onCharge: (invoice: RecurringInvoice) => void }) {
  const pending = Math.max(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0), 0);
  const overdue = invoice.status !== "paid" && invoice.due_date < new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-white">{invoice.customer_name}</h3>
            <InvoiceStatusBadge status={overdue ? "overdue" : invoice.status} />
          </div>
          <p className="mt-1 text-sm text-slate-400">{invoice.description || "Mensalista"}</p>
          <p className="mt-1 text-xs text-slate-500">Vencimento: {formatDate(invoice.due_date)}</p>
        </div>
        <div className="text-left lg:text-right">
          <p className="text-lg font-black text-white">R$ {formatMoney(invoice.amount)}</p>
          <p className="text-xs text-slate-400">Pago: R$ {formatMoney(invoice.paid_amount || 0)} • Aberto: R$ {formatMoney(pending)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={invoice.status === "paid"}
            onClick={() => onPaid(invoice)}
            className="flex items-center gap-1 rounded-xl border border-emerald-500/30 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckCircle2 size={15} /> Pago
          </button>
          <button
            disabled={invoice.status === "paid"}
            onClick={() => onPartial(invoice)}
            className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Parcial
          </button>
          <button
            disabled={invoice.status === "paid"}
            onClick={() => onCharge(invoice)}
            className="flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MessageCircle size={15} /> Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingTable({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) {
    return <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">Nenhuma reserva no período.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-950 text-slate-300">
          <tr>
            <th className="p-4">Cliente</th>
            <th className="p-4">Quadra</th>
            <th className="p-4">Data</th>
            <th className="p-4">Horário</th>
            <th className="p-4">Origem</th>
            <th className="p-4">Status</th>
            <th className="p-4 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id} className="border-t border-slate-800">
              <td className="p-4 font-semibold text-white">{booking.customer_name}</td>
              <td className="p-4 text-slate-400">{getFieldName(booking.fields)}</td>
              <td className="p-4 text-slate-400">{formatDate(booking.booking_date)}</td>
              <td className="p-4 text-slate-400">{booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}</td>
              <td className="p-4 text-slate-400">{booking.source || "manual"}</td>
              <td className="p-4"><StatusBadge status={booking.status} /></td>
              <td className="p-4 text-right font-bold text-white">R$ {formatMoney(booking.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PeriodFilter({ period, setPeriod, startDate, endDate, setStartDate, setEndDate }: { period: PeriodType; setPeriod: (value: PeriodType) => void; startDate: string; endDate: string; setStartDate: (value: string) => void; setEndDate: (value: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <label>
        <span className="text-xs font-medium text-slate-400">Período</span>
        <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodType)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400">
          <option value="today">Hoje</option>
          <option value="yesterday">Ontem</option>
          <option value="last7">Últimos 7 dias</option>
          <option value="thisMonth">Este mês</option>
          <option value="lastMonth">Mês passado</option>
          <option value="custom">Personalizado</option>
        </select>
      </label>
      <label>
        <span className="text-xs font-medium text-slate-400">Início</span>
        <input type="date" value={startDate} disabled={period !== "custom"} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60" />
      </label>
      <label>
        <span className="text-xs font-medium text-slate-400">Fim</span>
        <input type="date" value={endDate} disabled={period !== "custom"} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400 disabled:opacity-60" />
      </label>
    </div>
  );
}

function StatCard({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">{icon}</div>
      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-1 text-3xl font-bold text-white">{value}</h2>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function StatusCard({ title, value, color }: { title: string; value: number; color: "emerald" | "amber" | "red" }) {
  const classes = {
    emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    red: "border-red-500/20 bg-red-500/10 text-red-300",
  };
  return <div className={`rounded-2xl border p-5 ${classes[color]}`}><p className="text-sm font-semibold">{title}</p><h3 className="mt-1 text-4xl font-bold">{value}</h3></div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-950/60 p-4"><p className="text-sm text-slate-400">{label}</p><h3 className="mt-1 text-2xl font-bold text-white">{value}</h3></div>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    confirmada: "bg-emerald-500/10 text-emerald-300",
    concluida: "bg-emerald-500/10 text-emerald-300",
    pendente: "bg-amber-500/10 text-amber-300",
    aguardando_sinal: "bg-amber-500/10 text-amber-300",
    cancelada: "bg-red-500/10 text-red-300",
    em_andamento: "bg-blue-500/10 text-blue-300",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[status] || "bg-slate-800 text-slate-300"}`}>{status}</span>;
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-300",
    partial: "bg-blue-500/10 text-blue-300",
    pending: "bg-amber-500/10 text-amber-300",
    overdue: "bg-red-500/10 text-red-300",
  };
  const labels: Record<string, string> = { paid: "Pago", partial: "Parcial", pending: "Pendente", overdue: "Atrasado" };
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${styles[status] || styles.pending}`}>{labels[status] || status}</span>;
}

function isPaidBooking(booking: Booking) {
  return booking.status === "confirmada" || booking.status === "concluida";
}

function getFieldName(fields: FieldRelation) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function getRangeByPeriod(period: PeriodType) {
  const todayDate = new Date();
  const today = toDateInput(todayDate);
  if (period === "today") return { start: today, end: today };
  if (period === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const value = toDateInput(date);
    return { start: value, end: value };
  }
  if (period === "last7") {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { start: toDateInput(start), end: today };
  }
  if (period === "lastMonth") {
    const firstDayLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0);
    return { start: toDateInput(firstDayLastMonth), end: toDateInput(lastDayLastMonth) };
  }
  const firstDayMonth = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
  return { start: toDateInput(firstDayMonth), end: today };
}

function getLastDays(days: number) {
  const dates: string[] = [];
  for (let index = days - 1; index >= 0; index--) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    dates.push(toDateInput(date));
  }
  return dates;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getViewTitle(view: ViewType) {
  const titles: Record<ViewType, string> = {
    resumo: "Resumo financeiro",
    mensalistas: "Mensalistas",
    grafico: "Gráfico financeiro",
    status: "Status financeiro",
    relatorio: "Relatório financeiro",
    tabela: "Tabela financeira",
  };
  return titles[view] || "Financeiro";
}

function getViewDescription(view: ViewType) {
  const descriptions: Record<ViewType, string> = {
    resumo: "Veja dinheiro recebido, pendências e mensalistas.",
    mensalistas: "Controle cobranças, atrasos e pagamentos recorrentes.",
    grafico: "Acompanhe a receita recente em gráfico.",
    status: "Entenda a situação financeira da arena.",
    relatorio: "Escolha um período e baixe o PDF financeiro.",
    tabela: "Consulte lançamentos financeiros detalhados.",
  };
  return descriptions[view] || "";
}

function cutText(text: string, max: number) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

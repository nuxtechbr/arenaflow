"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type Subscription = {
  id: string;
  arena_id: string;
  plan_name: string | null;
  monthly_amount: number | null;
  due_day: number | null;
  status: string | null;
  next_due_date: string | null;
  last_paid_at: string | null;
  blocked_at: string | null;
  payment_pix_key: string | null;
  payment_whatsapp: string | null;
  notes: string | null;
  created_at: string;
};

type SubscriptionInvoice = {
  id: string;
  arena_id: string;
  subscription_id: string | null;
  reference_month: string | null;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
};

const DEFAULT_PLAN = "ArenaFlow Start";
const DEFAULT_AMOUNT = 89.9;
const DEFAULT_DUE_DAY = 10;
const DEFAULT_PIX_KEY = "5522999270052";
const DEFAULT_PAYMENT_WHATSAPP = "5522999270052";

export default function BillingPage() {
  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);

  useEffect(() => {
    if (!arenaLoading && activeArenaId) {
      loadBilling();
    }

    if (!arenaLoading && !activeArenaId) {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaLoading, activeArenaId]);

  const currentInvoice = useMemo(() => {
    const pending = invoices.find((invoice) =>
      ["pending", "overdue", "partial"].includes(String(invoice.status || "pending"))
    );

    return pending || invoices[0] || null;
  }, [invoices]);

  const subscriptionStatus = useMemo(() => {
    if (!subscription) return "not_configured";
    if (subscription.status === "blocked") return "blocked";
    if (subscription.status === "cancelled") return "cancelled";

    if (currentInvoice?.status === "paid") return "active";
    if (currentInvoice?.status === "partial") return "partial";
    if (currentInvoice?.status === "overdue") return "overdue";

    if (currentInvoice?.status === "pending") {
      if (isPastDue(currentInvoice.due_date)) return "overdue";
      return "pending";
    }

    return subscription.status || "active";
  }, [subscription, currentInvoice]);

  const totalPaid = useMemo(() => {
    return invoices
      .filter((invoice) => invoice.status === "paid")
      .reduce((sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0), 0);
  }, [invoices]);

  const totalPending = useMemo(() => {
    return invoices
      .filter((invoice) => ["pending", "overdue", "partial"].includes(String(invoice.status || "pending")))
      .reduce((sum, invoice) => {
        const amount = Number(invoice.amount || 0);
        const paid = Number(invoice.paid_amount || 0);

        return sum + Math.max(amount - paid, 0);
      }, 0);
  }, [invoices]);

  async function loadBilling() {
    if (!activeArenaId) return;

    setLoading(true);

    const { data: subData, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("arena_id", activeArenaId)
      .maybeSingle();

    if (subError) {
      console.error(subError);
      alert(subError.message);
      setLoading(false);
      return;
    }

    const activeSubscription = subData as Subscription | null;

    if (!activeSubscription) {
      setSubscription(null);
      setInvoices([]);
      setLoading(false);
      return;
    }

    setSubscription(activeSubscription);

    const { data: invoiceData, error: invoiceError } = await supabase
      .from("subscription_invoices")
      .select("*")
      .eq("arena_id", activeArenaId)
      .order("due_date", { ascending: false });

    if (invoiceError) {
      console.error(invoiceError);
      alert(invoiceError.message);
    }

    setInvoices((invoiceData || []) as SubscriptionInvoice[]);
    setLoading(false);
  }

  async function copyPix() {
    const pix = subscription?.payment_pix_key || DEFAULT_PIX_KEY;

    await navigator.clipboard.writeText(pix);
    alert("Chave Pix copiada!");
  }

  function openWhatsappPayment() {
    const phone = normalizePhone(subscription?.payment_whatsapp || DEFAULT_PAYMENT_WHATSAPP);
    const invoice = currentInvoice;

    const amount = invoice?.amount || subscription?.monthly_amount || DEFAULT_AMOUNT;
    const dueDate = invoice?.due_date || subscription?.next_due_date || "";
    const plan = subscription?.plan_name || DEFAULT_PLAN;
    const arenaName = activeArenaInfo?.name || "Minha arena";

    const message = `Olá, quero pagar minha mensalidade do ArenaFlow.

Arena: ${arenaName}
Plano: ${plan}
Valor: R$ ${formatMoney(amount)}
Vencimento: ${dueDate ? formatDate(dueDate) : "A confirmar"}

Chave Pix: ${subscription?.payment_pix_key || DEFAULT_PIX_KEY}

Vou fazer o Pix e enviar o comprovante por aqui.`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  if (arenaLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando mensalidade...
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
            Selecione ou cadastre uma arena para visualizar sua mensalidade.
          </p>
        </div>
      </main>
    );
  }

  if (!subscription) {
    return (
      <main className="space-y-6 text-white">
        <section className="overflow-hidden rounded-[2rem] border border-yellow-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
          <div className="relative p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(234,179,8,0.16),transparent_35%)]" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-yellow-300">
                  <AlertTriangle size={16} />
                  Mensalidade não configurada
                </div>

                <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                  Fale com o suporte ArenaFlow
                </h1>

                <p className="mt-3 max-w-2xl text-slate-400">
                  Sua assinatura ainda não foi configurada pelo Admin Master. Assim que o plano for criado, sua mensalidade aparecerá aqui.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const message = `Olá, minha mensalidade do ArenaFlow ainda não aparece no painel.

Arena: ${activeArenaInfo?.name || "Minha arena"}`;
                  window.open(`https://wa.me/${DEFAULT_PAYMENT_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 font-black text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                <MessageCircle />
                Falar com suporte
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 text-white">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />

          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                <CreditCard size={16} />
                Minha mensalidade
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Plano ArenaFlow
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Confira sua mensalidade, vencimento, histórico e faça o pagamento direto pelo Pix/WhatsApp.
              </p>
            </div>

            <StatusBadge status={subscriptionStatus} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/10">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
                  Plano atual
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {subscription.plan_name || DEFAULT_PLAN}
                </h2>

                <p className="mt-2 text-slate-400">
                  Arena:{" "}
                  <span className="font-bold text-white">
                    {activeArenaInfo?.name || "Arena selecionada"}
                  </span>
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-left md:text-right">
                <p className="text-sm font-bold text-emerald-300">Valor mensal</p>
                <p className="mt-1 text-4xl font-black text-white">
                  R$ {formatMoney(subscription.monthly_amount || DEFAULT_AMOUNT)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Vencimento todo dia {subscription.due_day || DEFAULT_DUE_DAY}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <InfoCard
                icon={<CalendarDays />}
                label="Próximo vencimento"
                value={
                  currentInvoice?.due_date
                    ? formatDate(currentInvoice.due_date)
                    : subscription.next_due_date
                    ? formatDate(subscription.next_due_date)
                    : "Não definido"
                }
              />

              <InfoCard
                icon={<CheckCircle2 />}
                label="Último pagamento"
                value={
                  subscription.last_paid_at
                    ? formatDateTime(subscription.last_paid_at)
                    : "Ainda não pago"
                }
              />

              <InfoCard
                icon={<Wallet />}
                label="Pendente"
                value={`R$ ${formatMoney(totalPending)}`}
              />
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/10">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-black">Pagamento manual</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Faça o Pix e envie o comprovante pelo WhatsApp para baixa manual.
                </p>
              </div>

              <StatusBadge status={subscriptionStatus} small />
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-[#07111B] p-5">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                Chave Pix
              </p>

              <div className="mt-3 flex flex-col gap-3 md:flex-row">
                <div className="flex-1 rounded-2xl border border-white/10 bg-[#0F172A] p-4 font-bold text-white">
                  {subscription.payment_pix_key || DEFAULT_PIX_KEY}
                </div>

                <button
                  type="button"
                  onClick={copyPix}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400 hover:text-emerald-300"
                >
                  <Copy size={18} />
                  Copiar Pix
                </button>
              </div>

              <button
                type="button"
                onClick={openWhatsappPayment}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-5 text-lg font-black text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                <MessageCircle />
                Pagar pelo WhatsApp
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/10">
            <h2 className="text-2xl font-black">Resumo</h2>

            <div className="mt-5 space-y-3">
              <SummaryRow label="Status do plano" value={translateStatus(subscriptionStatus)} />
              <SummaryRow label="Mensalidades pagas" value={`${invoices.filter((i) => i.status === "paid").length}`} />
              <SummaryRow label="Mensalidades pendentes" value={`${invoices.filter((i) => ["pending", "overdue", "partial"].includes(String(i.status))).length}`} />
              <SummaryRow label="Total já pago" value={`R$ ${formatMoney(totalPaid)}`} />
              <SummaryRow label="Total pendente" value={`R$ ${formatMoney(totalPending)}`} />
            </div>
          </div>

          <div className="rounded-[2rem] border border-yellow-500/20 bg-yellow-500/10 p-6">
            <div className="flex gap-3">
              <AlertTriangle className="mt-1 shrink-0 text-yellow-300" />
              <div>
                <h3 className="font-black text-yellow-100">Pagamento confirmado manualmente</h3>
                <p className="mt-2 text-sm leading-relaxed text-yellow-100/80">
                  Após enviar o comprovante, a equipe ArenaFlow confirma o pagamento e atualiza sua mensalidade no sistema.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/10">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-black">Histórico de mensalidades</h2>
            <p className="mt-2 text-sm text-slate-400">
              Acompanhe os pagamentos do seu plano ArenaFlow.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#07111B] px-4 py-3 text-sm font-bold text-slate-300">
            {invoices.length} registro(s)
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          <div className="hidden grid-cols-[1fr_1fr_1fr_1fr_1fr] bg-white/[0.03] px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-500 md:grid">
            <div>Referência</div>
            <div>Vencimento</div>
            <div>Valor</div>
            <div>Pago</div>
            <div>Status</div>
          </div>

          {invoices.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              Nenhuma mensalidade encontrada.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {invoices.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatusBadge({ status, small = false }: { status: string; small?: boolean }) {
  const config = getStatusConfig(status);

  return (
    <div
      className={
        small
          ? `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${config.className}`
          : `inline-flex items-center gap-3 rounded-2xl border px-5 py-4 font-black ${config.className}`
      }
    >
      {config.icon}
      {config.label}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111B] p-5">
      <div className="mb-3 text-emerald-400">{icon}</div>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#07111B] px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: SubscriptionInvoice }) {
  const status = String(invoice.status || "pending");
  const paid = Number(invoice.paid_amount || 0);
  const pending = Math.max(Number(invoice.amount || 0) - paid, 0);

  return (
    <div className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_1fr_1fr_1fr_1fr] md:items-center">
      <div>
        <p className="font-black text-white">{formatReference(invoice.reference_month)}</p>
        <p className="text-xs text-slate-500 md:hidden">Referência</p>
      </div>

      <div>
        <p className="font-bold text-slate-300">{formatDate(invoice.due_date)}</p>
        <p className="text-xs text-slate-500 md:hidden">Vencimento</p>
      </div>

      <div>
        <p className="font-bold text-white">R$ {formatMoney(invoice.amount)}</p>
        <p className="text-xs text-slate-500 md:hidden">Valor</p>
      </div>

      <div>
        <p className="font-bold text-emerald-300">R$ {formatMoney(paid)}</p>
        {pending > 0 && (
          <p className="text-xs text-red-300">Falta R$ {formatMoney(pending)}</p>
        )}
      </div>

      <div>
        <StatusBadge status={status} small />
      </div>
    </div>
  );
}

function getStatusConfig(status: string) {
  const current = String(status || "pending");

  if (current === "not_configured") {
    return {
      label: "Não configurado",
      icon: <AlertTriangle size={18} />,
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    };
  }

  if (current === "active" || current === "paid") {
    return {
      label: current === "paid" ? "Pago" : "Em dia",
      icon: <CheckCircle2 size={18} />,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (current === "pending") {
    return {
      label: "Pendente",
      icon: <Clock size={18} />,
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    };
  }

  if (current === "partial") {
    return {
      label: "Parcial",
      icon: <Wallet size={18} />,
      className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    };
  }

  if (current === "overdue") {
    return {
      label: "Atrasado",
      icon: <AlertTriangle size={18} />,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  if (current === "blocked") {
    return {
      label: "Bloqueado",
      icon: <XCircle size={18} />,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  return {
    label: translateStatus(current),
    icon: <ShieldCheck size={18} />,
    className: "border-white/10 bg-white/5 text-slate-300",
  };
}

function isPastDue(date: string) {
  return new Date(`${date}T23:59:59`) < new Date();
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    active: "Em dia",
    pending: "Pendente",
    paid: "Pago",
    overdue: "Atrasado",
    blocked: "Bloqueado",
    cancelled: "Cancelado",
    partial: "Parcial",
    not_configured: "Não configurado",
  };

  return labels[status] || status;
}

function formatMoney(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  if (!date) return "-";

  const [year, month, day] = date.slice(0, 10).split("-");

  return `${day}/${month}/${year}`;
}

function formatDateTime(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  return parsed.toLocaleDateString("pt-BR");
}

function formatReference(reference: string | null) {
  if (!reference) return "-";

  const [year, month] = reference.split("-");

  const months: Record<string, string> = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro",
  };

  return `${months[month] || month}/${year}`;
}

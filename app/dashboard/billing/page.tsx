"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  CreditCard,
  Crown,
  ExternalLink,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Timer,
  Wallet,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type Plan = {
  id: string;
  plan_key: "essential" | "pro" | string;
  name: string;
  description: string | null;
  monthly_price: number;
  implementation_price: number;
  max_arenas: number;
  allow_multi_arena: boolean;
  is_active: boolean;
  sort_order: number;
};

type Subscription = {
  id: string;
  arena_id: string;
  status: string | null;
  lifecycle_stage: string | null;
  plan_key: string | null;
  billing_provider: string | null;
  amount: number | null;
  next_due_date: string | null;
  current_period_end: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  asaas_status: string | null;
  asaas_last_invoice_url: string | null;
  asaas_last_bank_slip_url: string | null;
  asaas_last_pix_qr_code: string | null;
  asaas_last_pix_payload: string | null;
  asaas_next_due_date: string | null;
  max_arenas: number | null;
  allow_multi_arena: boolean | null;
};

type AsaasPayment = {
  id: string;
  arena_id: string | null;
  subscription_id: string | null;
  asaas_payment_id: string;
  status: string | null;
  billing_type: string | null;
  value: number | null;
  due_date: string | null;
  payment_date: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_payload: string | null;
  created_at: string;
};

type BillingInvoice = {
  id: string;
  arena_id: string;
  subscription_id: string | null;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
  payment_url: string | null;
  pix_payload: string | null;
  notes: string | null;
  created_at: string;
};

const ARENAFLOW_WHATSAPP = "5522999270052";
const today = new Date().toISOString().slice(0, 10);


export default function BillingPage() {
  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [asaasPayments, setAsaasPayments] = useState<AsaasPayment[]>([]);
  const [latestPix, setLatestPix] = useState<{ qrCode: string | null; payload: string | null; dueDate: string | null } | null>(null);
  const [savingPlan, setSavingPlan] = useState("") 

async function payBillingInvoice(invoiceId: string) {
  try {
    const response = await fetch("/api/billing-invoices/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        invoice_id: invoiceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || "Erro ao gerar pagamento.");
    }

    if (data.payment_url) {
      window.open(data.payment_url, "_blank");
    }

    await loadBilling();
  } catch {
    alert("Não foi possível gerar o pagamento agora.");
  }
}
  useEffect(() => {
    if (!arenaLoading && activeArenaId) loadBilling();
    if (!arenaLoading && !activeArenaId) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaLoading, activeArenaId]);

  const currentPlan = useMemo(() => {
    const key = subscription?.plan_key || "essential";
    return plans.find((plan) => plan.plan_key === key) || plans.find((plan) => plan.plan_key === "essential") || null;
  }, [plans, subscription]);

  const latestAsaasPayment = useMemo(() => asaasPayments[0] || null, [asaasPayments]);

  const businessStatus = useMemo(() => getBusinessStatus(subscription), [subscription]);
  const isTrial = businessStatus === "trialing";
  const isTrialExpired = businessStatus === "trial_expired";
  const isActive = businessStatus === "active";
  const shouldShowActivationCta = !isActive && !subscription?.activated_at && !subscription?.asaas_subscription_id;
  const trialDaysLeft = subscription?.trial_ends_at ? daysBetween(today, subscription.trial_ends_at.slice(0, 10)) : null;
  const trialProgress = subscription?.trial_started_at && subscription?.trial_ends_at
    ? getTrialProgress(subscription.trial_started_at, subscription.trial_ends_at)
    : 0;
  const firstDuePreview = addMonths(new Date(), 1).toISOString().slice(0, 10);

  const openBillingInvoices = billingInvoices.filter(
    (invoice: BillingInvoice) => String(invoice.status || "").toLowerCase() !== "paid"
  );

  const paidBillingInvoices = billingInvoices.filter(
    (invoice: BillingInvoice) => String(invoice.status || "").toLowerCase() === "paid"
  );

  const fallbackNextDueDate = subscription?.activated_at
    ? addMonths(new Date(subscription.activated_at), 1).toISOString().slice(0, 10)
    : firstDuePreview;

  const currentBillingInvoice = openBillingInvoices[0] || null;

  const nextDueDate =
    currentBillingInvoice?.due_date ||
    subscription?.next_due_date ||
    subscription?.current_period_end ||
    latestAsaasPayment?.due_date ||
    subscription?.asaas_next_due_date ||
    fallbackNextDueDate ||
    "";


  async function loadBilling() {
    if (!activeArenaId) return;

    setLoading(true);

    const [plansRes, subscriptionRes, paymentsRes, invoicesRes] = await Promise.all([
      supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("asaas_payments")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("billing_invoices")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("due_date", { ascending: true }),
    ]);

    setLoading(false);

    if (plansRes.error) return alert(plansRes.error.message);
    if (subscriptionRes.error) return alert(subscriptionRes.error.message);
    if (paymentsRes.error) return alert(paymentsRes.error.message);
    if (invoicesRes.error) return alert(invoicesRes.error.message);

    setPlans((plansRes.data || []) as Plan[]);
    setSubscription((subscriptionRes.data || null) as Subscription | null);
    setAsaasPayments((paymentsRes.data || []) as AsaasPayment[]);
    setBillingInvoices((invoicesRes.data || []) as BillingInvoice[]);
  }

  async function activateSubscription(plan?: Plan | null) {
    if (!activeArenaId) return;

    const selectedPlan = plan || currentPlan || plans.find((item) => item.plan_key === "essential");

    if (!selectedPlan) return alert("Plano não encontrado.");

    setSavingPlan(selectedPlan.plan_key);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch("/api/asaas/create-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          arena_id: activeArenaId,
          plan_key: selectedPlan.plan_key,
        }),
      });

      const data = await response.json().catch(() => null);

      setSavingPlan("");

      if (!response.ok) {
        alert(data?.error || "Não foi possível criar a assinatura no Asaas.");
        return;
      }

      if (data?.pix_qr_code || data?.pix_payload) {
        setLatestPix({
          qrCode: data.pix_qr_code || null,
          payload: data.pix_payload || null,
          dueDate: data.due_date || data.first_due_date || null,
        });
      }

      await loadBilling();
    } catch {
      setSavingPlan("");
      alert("Não foi possível conectar ao Asaas agora.");
    }
  }

  function openImplementationWhatsapp() {
    const message = `Olá! Quero falar sobre a implementação do ArenaFlow da arena ${activeArenaInfo?.name || ""}.`;
    window.open(`https://wa.me/${ARENAFLOW_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function openSupportWhatsapp() {
    const message = `Olá! Preciso de ajuda com a assinatura Asaas do ArenaFlow da arena ${activeArenaInfo?.name || ""}.`;
    window.open(`https://wa.me/${ARENAFLOW_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
  }

  async function copyPix() {
    const pix = latestPix?.payload || subscription?.asaas_last_pix_payload || latestAsaasPayment?.pix_payload || "";
    if (!pix) return alert("Nenhum Pix Asaas disponível ainda.");

    await navigator.clipboard.writeText(pix);
    alert("Pix Asaas copiado!");
  }

  if (arenaLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando assinatura...
        </div>
      </main>
    );
  }

  if (!activeArenaId) {
    return (
      <main className="min-h-screen text-white">
        <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-8">
          <h1 className="text-3xl font-black">Nenhuma arena selecionada</h1>
          <p className="mt-2 text-slate-400">Selecione uma arena para ver assinatura e mensalidade.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-24 text-white md:pb-0">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />

          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <CreditCard size={16} />
                Assinatura ArenaFlow
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                {isTrial || isTrialExpired ? "Teste grátis ArenaFlow" : "Mensalidade via Asaas"}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
                {isTrial || isTrialExpired
                  ? "Seu acesso está em teste. Ao ativar, sua assinatura começa agora e a primeira mensalidade vence daqui 1 mês."
                  : "Sua mensalidade é controlada automaticamente pelo Asaas."}
              </p>
            </div>

            <button
              type="button"
              onClick={loadBilling}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400"
            >
              <RefreshCw size={18} />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      {(isTrial || isTrialExpired) && (
        <TrialActivationPanel
          plan={currentPlan}
          daysLeft={trialDaysLeft}
          progress={trialProgress}
          expired={isTrialExpired}
          firstDuePreview={firstDuePreview}
          saving={Boolean(savingPlan)}
          onActivate={() => activateSubscription(currentPlan)}
          onWhatsapp={openSupportWhatsapp}
        />
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-white/10 bg-[#0F172A] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <Sparkles size={22} />
          </div>
          <h3 className="mt-4 text-lg font-black">Implementação</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            A implantação, configuração e entrega inicial são combinadas diretamente com o suporte ArenaFlow.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#0F172A] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
            <CreditCard size={22} />
          </div>
          <h3 className="mt-4 text-lg font-black">Mensalidade</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            A recorrência mensal é criada no Asaas quando você ativa. A primeira cobrança vence 1 mês depois da ativação.
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#0F172A] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-500/10 text-yellow-300">
            <Timer size={22} />
          </div>
          <h3 className="mt-4 text-lg font-black">Teste grátis</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Durante o teste, você usa o sistema sem recorrência ativa. Ao ativar, o primeiro Pix vence daqui 1 mês.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 md:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={businessStatus} />
                {isActive ? (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                    {subscription?.asaas_subscription_id ? "Asaas conectado" : "Assinatura manual ativa"}
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
                    Sem recorrência ativa
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-3xl font-black text-white">
                {currentPlan?.name || "ArenaFlow Essencial"}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                {currentPlan?.description || "Plano atual da sua arena."}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-5 lg:min-w-[260px]">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Valor mensal</p>
              <p className="mt-2 text-4xl font-black text-white">
                R$ {formatMoney(currentPlan?.monthly_price || subscription?.amount || 0)}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {isActive ? `Próximo vencimento: ${nextDueDate ? formatDate(nextDueDate) : "-"}` : `1º vencimento: ${formatDate(firstDuePreview)}`}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <PlanFeature
              enabled
              title="Teste grátis"
              description="Use o sistema antes da recorrência mensal."
            />
            <PlanFeature
              enabled
              title="Ativação pelo cliente"
              description="A assinatura nasce hoje, mas o primeiro Pix vence em 1 mês."
            />
            <PlanFeature
              enabled={Boolean(currentPlan?.allow_multi_arena)}
              title="Multiarenas"
              description={currentPlan?.allow_multi_arena ? "Liberado no plano Pro." : "Bloqueado no Essencial."}
            />
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 md:p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <Wallet size={28} />
          </div>

          <h2 className="mt-4 text-2xl font-black">Cobrança atual</h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {isActive
              ? "Sua assinatura está ativa. A mensalidade atual aparece abaixo."
              : "Você ainda não possui recorrência ativa. Ative a assinatura para começar."}
          </p>

          {isActive && currentBillingInvoice && (
            <div className="mt-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Mensalidade atual</p>
              <p className="mt-2 text-2xl font-black text-white">R$ {formatMoney(currentBillingInvoice.amount || currentPlan?.monthly_price || 89.9)}</p>
              <p className="mt-1 text-sm text-slate-300">Vencimento: {formatDate(currentBillingInvoice.due_date)}</p>
              <span className="mt-3 inline-flex rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
                {translateStatus(currentBillingInvoice.status || "open")}
              </span>
            </div>
          )}

          <div className="mt-5 space-y-3">
            {(latestPix?.qrCode || subscription?.asaas_last_pix_qr_code || latestAsaasPayment?.pix_qr_code) && (
              <div className="rounded-3xl border border-emerald-500/20 bg-white p-4">
                <img
                  src={`data:image/png;base64,${latestPix?.qrCode || subscription?.asaas_last_pix_qr_code || latestAsaasPayment?.pix_qr_code}`}
                  alt="QR Code Pix Asaas"
                  className="mx-auto h-52 w-52 object-contain"
                />
              </div>
            )}

            {(latestPix?.payload || subscription?.asaas_last_pix_payload || latestAsaasPayment?.pix_payload) && (
              <button
                type="button"
                onClick={copyPix}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 font-black text-emerald-300"
              >
                <Copy size={18} />
                Copiar Pix copia e cola
              </button>
            )}

            {shouldShowActivationCta && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-100">
                Ao ativar hoje, sua assinatura começa agora, mas o primeiro Pix vence em {formatDate(firstDuePreview)}.
              </div>
            )}

            {shouldShowActivationCta && (
              <button
                type="button"
                disabled={Boolean(savingPlan)}
                onClick={() => activateSubscription(currentPlan)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {savingPlan ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                Ativar assinatura
              </button>
            )}

            <button
              type="button"
              onClick={openImplementationWhatsapp}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
            >
              <MessageCircle size={18} />
              Falar com suporte
            </button>
          </div>
        </aside>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-2xl font-black">Planos ArenaFlow</h2>
          <p className="mt-1 text-sm text-slate-400">
            Seu plano foi definido na implantação. Para trocar, fale com o suporte ou solicite upgrade.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              active={(subscription?.plan_key || "essential") === plan.plan_key}
              saving={savingPlan === plan.plan_key}
              canActivate={shouldShowActivationCta && (subscription?.plan_key || "essential") === plan.plan_key}
              onChoose={() => activateSubscription(plan)}
              onWhatsapp={openSupportWhatsapp}
            />
          ))}
        </div>
      </section>

      <BillingHistoryPanel
        title="Mensalidades ArenaFlow"
        empty="Nenhuma mensalidade registrada ainda."
      >
        {currentBillingInvoice && (
          <PaymentRow
            key={currentBillingInvoice.id}
            title="Mensalidade atual"
            status={currentBillingInvoice.status || "open"}
            amount={currentBillingInvoice.amount || currentPlan?.monthly_price || 89.9}
            dueDate={currentBillingInvoice.due_date}
            paidDate={currentBillingInvoice.paid_at}
            invoiceUrl={currentBillingInvoice.payment_url}
            onPay={() => payBillingInvoice(currentBillingInvoice.id)}
          />
        )}

        {paidBillingInvoices.map((invoice) => (
          <PaymentRow
            key={invoice.id}
            title="Mensalidade paga"
            status={invoice.status || "paid"}
            amount={invoice.amount || currentPlan?.monthly_price || 89.9}
            dueDate={invoice.due_date}
            paidDate={invoice.paid_at}
            invoiceUrl={invoice.payment_url}
          />
        ))}
      </BillingHistoryPanel>

      <BillingHistoryPanel
        title="Pagamentos Asaas"
        empty="Nenhum pagamento Asaas registrado ainda."
      >
        {asaasPayments.map((payment) => (
          <PaymentRow
            key={payment.id}
            title={`Cobrança ${payment.asaas_payment_id}`}
            status={payment.status || "pending"}
            amount={payment.value || 0}
            dueDate={payment.due_date}
            paidDate={payment.payment_date}
            invoiceUrl={payment.invoice_url}
          />
        ))}
      </BillingHistoryPanel>
    </main>
  );
}

function TrialActivationPanel({
  plan,
  daysLeft,
  progress,
  expired,
  firstDuePreview,
  saving,
  onActivate,
  onWhatsapp,
}: {
  plan: Plan | null;
  daysLeft: number | null;
  progress: number;
  expired: boolean;
  firstDuePreview: string;
  saving: boolean;
  onActivate: () => void;
  onWhatsapp: () => void;
}) {
  const urgent = expired || (daysLeft !== null && daysLeft <= 1);

  return (
    <section
      className={
        urgent
          ? "overflow-hidden rounded-[2rem] border border-yellow-500/30 bg-yellow-500/10 p-5 shadow-2xl shadow-yellow-950/20 md:p-7"
          : "overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-5 md:p-7"
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_360px] xl:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={urgent ? "rounded-full bg-yellow-500 px-3 py-1 text-xs font-black text-black" : "rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-black"}>
              {expired ? "Teste expirado" : "Teste grátis ativo"}
            </span>
            <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-black text-white">
              {plan?.name || "ArenaFlow"}
            </span>
          </div>

          <h2 className="mt-4 text-3xl font-black md:text-4xl">
            {expired
              ? "Seu teste terminou. Ative para continuar usando."
              : daysLeft === 1
                ? "Falta 1 dia para acabar seu teste."
                : `Faltam ${daysLeft ?? 0} dias para acabar seu teste.`}
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-200/90 md:text-base">
            A implementação é combinada separadamente com o suporte. Ao ativar, sua assinatura começa hoje no ArenaFlow. A primeira mensalidade será cobrada pelo Asaas via Pix somente daqui 1 mês.
          </p>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/20">
            <div
              className={urgent ? "h-full rounded-full bg-yellow-400" : "h-full rounded-full bg-emerald-400"}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-[#07111B] p-5">
          <p className="text-sm font-black uppercase tracking-widest text-slate-500">Assinatura mensal</p>
          <p className="mt-2 text-4xl font-black text-white">R$ {formatMoney(plan?.monthly_price || 0)}</p>
          <p className="mt-1 text-sm text-slate-400">Primeiro vencimento: {formatDate(firstDuePreview)}</p>

          <button
            type="button"
            disabled={saving}
            onClick={onActivate}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            Ativar assinatura agora
          </button>

          <button
            type="button"
            onClick={onWhatsapp}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
          >
            <MessageCircle size={18} />
            Falar com suporte
          </button>
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  active,
  saving,
  canActivate,
  onChoose,
  onWhatsapp,
}: {
  plan: Plan;
  active: boolean;
  saving: boolean;
  canActivate: boolean;
  onChoose: () => void;
  onWhatsapp: () => void;
}) {
  const isPro = plan.plan_key === "pro";

  return (
    <article
      className={
        active
          ? "relative overflow-hidden rounded-[2rem] border border-emerald-500/30 bg-[#0F172A] p-6 shadow-2xl shadow-emerald-950/20"
          : "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 opacity-75"
      }
    >
      {active && (
        <div className="absolute right-5 top-5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-black">
          Plano atual
        </div>
      )}

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
        {isPro ? <Crown size={28} /> : <ShieldCheck size={28} />}
      </div>

      <h3 className="mt-5 text-3xl font-black">{plan.name}</h3>

      <p className="mt-2 min-h-[48px] text-sm leading-relaxed text-slate-400">{plan.description}</p>

      <div className="mt-5">
        <span className="text-5xl font-black">R$ {formatMoney(plan.monthly_price)}</span>
        <span className="text-slate-400"> /mês</span>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        Implementação paga por fora, direto com o suporte
      </p>

      <div className="mt-6 space-y-3">
        <PlanFeature enabled title="Agenda visual" description="Reservas, bloqueios e horários." />
        <PlanFeature enabled title="Link público" description="Página de agendamento mobile." />
        <PlanFeature enabled title="Financeiro e mensalistas" description="Cobranças, mensagens e automações." />
        <PlanFeature
          enabled={plan.allow_multi_arena}
          title="Múltiplas arenas"
          description={plan.allow_multi_arena ? "Crie e alterne entre várias arenas." : "Limite de 1 arena/estabelecimento."}
        />
      </div>

      {canActivate ? (
        <button
          type="button"
          disabled={saving}
          onClick={onChoose}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          Ativar assinatura
        </button>
      ) : active ? (
        <div className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 font-black text-emerald-300">
          <CheckCircle2 size={18} />
          Plano selecionado
        </div>
      ) : (
        <button
          type="button"
          onClick={onWhatsapp}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
        >
          <MessageCircle size={18} />
          Solicitar troca
        </button>
      )}
    </article>
  );
}

function PlanFeature({
  enabled,
  title,
  description,
}: {
  enabled: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#07111B] p-4">
      <div
        className={
          enabled
            ? "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"
            : "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-700/40 text-slate-500"
        }
      >
        {enabled ? <CheckCircle2 size={17} /> : <Lock size={17} />}
      </div>

      <div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function BillingHistoryPanel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5">
      <h2 className="text-2xl font-black">{title}</h2>

      <div className="mt-4 space-y-3">
        {items.length > 0 ? items : (
          <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-slate-500">
            {empty}
          </div>
        )}
      </div>
    </section>
  );
}

function PaymentRow({
  title,
  status,
  amount,
  dueDate,
  paidDate,
  invoiceUrl,
  onPay,
}: {
  title: string;
  status: string;
  amount: number;
  dueDate: string | null;
  paidDate: string | null;
  invoiceUrl?: string | null;
  onPay?: () => void;
}) {

  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111B] p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black text-white">{title}</p>
            <StatusBadge status={status} />
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Vencimento: {dueDate ? formatDate(dueDate) : "-"} {paidDate ? `• Pago em ${formatDate(paidDate)}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-black text-emerald-300">R$ {formatMoney(amount)}</span>

          {invoiceUrl ? (
  <a
    href={invoiceUrl}
    target="_blank"
    rel="noreferrer"
    className="rounded-xl border border-white/10 px-3 py-2 text-sm font-black text-white hover:border-emerald-400"
  >
    Pagar
  </a>
) : onPay ? (
  <button
    type="button"
    onClick={onPay}
    className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-black text-black hover:bg-emerald-400"
  >
    Gerar Pix
  </button>
) : null}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-emerald-500/10 text-emerald-300"
      : status === "trialing"
        ? "bg-yellow-500/10 text-yellow-300"
        : status === "trial_expired" || status === "overdue" || status === "blocked"
          ? "bg-red-500/10 text-red-300"
          : "bg-blue-500/10 text-blue-300";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{translateStatus(status)}</span>;
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    trialing: "Teste grátis",
    trial_expired: "Teste expirado",
    pending: "Pendente",
    open: "Em aberto",
    overdue: "Atrasado",
    blocked: "Bloqueado",
    RECEIVED: "Recebido",
    CONFIRMED: "Confirmado",
    PENDING: "Pendente",
    OVERDUE: "Atrasado",
  };

  return labels[status] || status || "Pendente";
}

function getBusinessStatus(subscription: Subscription | null) {
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

function getTrialProgress(start: string, end: string) {
  const startDate = new Date(start).getTime();
  const endDate = new Date(end).getTime();
  const now = new Date().getTime();

  if (!startDate || !endDate || endDate <= startDate) return 0;

  const progress = ((now - startDate) / (endDate - startDate)) * 100;
  return Math.max(5, Math.min(100, Math.round(progress)));
}

function daysBetween(dateA: string, dateB: string) {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  if (!date) return "-";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}


function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  const originalDay = copy.getDate();

  copy.setMonth(copy.getMonth() + months);

  if (copy.getDate() < originalDay) {
    copy.setDate(0);
  }

  return copy;
}
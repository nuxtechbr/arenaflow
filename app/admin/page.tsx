"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  CreditCard,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlock,
  Wallet,
  XCircle,
  Plus,
  UserPlus,
  X,
  KeyRound,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type Arena = {
  id: string;
  name: string;
  slug: string | null;
  whatsapp: string | null;
  subscription_status: string | null;
  blocked_reason: string | null;
  created_at: string;
};

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

type AdminRow = {
  arena: Arena;
  subscription: Subscription | null;
  currentInvoice: SubscriptionInvoice | null;
  invoices: SubscriptionInvoice[];
  status: string;
};

const DEFAULT_PLAN = "ArenaFlow Start";
const DEFAULT_AMOUNT = 89.9;
const DEFAULT_PIX_KEY = "5522999270052";
const DEFAULT_PAYMENT_WHATSAPP = "5522999270052";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");

  const [arenas, setArenas] = useState<Arena[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([]);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [creatingClient, setCreatingClient] = useState(false);
  const [createdClientResult, setCreatedClientResult] = useState<any>(null);

  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerWhatsapp, setNewOwnerWhatsapp] = useState("");
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [newArenaName, setNewArenaName] = useState("");
  const [newArenaSlug, setNewArenaSlug] = useState("");
  const [newPlanName, setNewPlanName] = useState(DEFAULT_PLAN);
  const [newMonthlyAmount, setNewMonthlyAmount] = useState(String(DEFAULT_AMOUNT));

  useEffect(() => {
    loadAdminData();
  }, []);

  const rows = useMemo<AdminRow[]>(() => {
    return arenas
      .map((arena) => {
        const subscription = subscriptions.find((item) => item.arena_id === arena.id) || null;

        const arenaInvoices = invoices
          .filter((invoice) => invoice.arena_id === arena.id)
          .sort((a, b) => String(b.due_date).localeCompare(String(a.due_date)));

        const currentInvoice =
          arenaInvoices.find((invoice) =>
            ["pending", "overdue", "partial"].includes(String(invoice.status || "pending"))
          ) ||
          arenaInvoices[0] ||
          null;

        const status = getRealStatus(arena, subscription, currentInvoice);

        return {
          arena,
          subscription,
          currentInvoice,
          invoices: arenaInvoices,
          status,
        };
      })
      .filter((row) => {
        const q = search.trim().toLowerCase();

        if (!q) return true;

        return (
          row.arena.name.toLowerCase().includes(q) ||
          String(row.arena.slug || "").toLowerCase().includes(q) ||
          String(row.arena.whatsapp || "").toLowerCase().includes(q)
        );
      });
  }, [arenas, subscriptions, invoices, search]);

  const stats = useMemo(() => {
    const subscribedRows = rows.filter((row) => row.subscription);

    const active = subscribedRows.filter((row) => row.status === "active").length;
    const pending = subscribedRows.filter((row) => row.status === "pending").length;
    const overdue = subscribedRows.filter((row) => row.status === "overdue").length;
    const blocked = subscribedRows.filter((row) => row.status === "blocked").length;

    const mrr = subscribedRows
      .filter((row) => row.status !== "cancelled" && row.status !== "blocked")
      .reduce((sum, row) => sum + Number(row.subscription?.monthly_amount || 0), 0);

    const pendingAmount = subscribedRows.reduce((sum, row) => {
      const invoice = row.currentInvoice;

      if (!invoice) return sum;

      if (!["pending", "overdue", "partial"].includes(String(invoice.status || "pending"))) {
        return sum;
      }

      return sum + Math.max(Number(invoice.amount || 0) - Number(invoice.paid_amount || 0), 0);
    }, 0);

    return {
      total: rows.length,
      subscribers: subscribedRows.length,
      active,
      pending,
      overdue,
      blocked,
      mrr,
      pendingAmount,
    };
  }, [rows]);

  async function loadAdminData() {
    setLoading(true);

    const [arenasRes, subscriptionsRes, invoicesRes] = await Promise.all([
      supabase
        .from("arenas")
        .select("id, name, slug, whatsapp, subscription_status, blocked_reason, created_at")
        .order("created_at", { ascending: false }),

      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),

      supabase
        .from("subscription_invoices")
        .select("*")
        .order("due_date", { ascending: false }),
    ]);

    if (arenasRes.error) alert(arenasRes.error.message);
    if (subscriptionsRes.error) alert(subscriptionsRes.error.message);
    if (invoicesRes.error) alert(invoicesRes.error.message);

    setArenas((arenasRes.data || []) as Arena[]);
    setSubscriptions((subscriptionsRes.data || []) as Subscription[]);
    setInvoices((invoicesRes.data || []) as SubscriptionInvoice[]);

    setLoading(false);
  }

  async function createSubscriptionForArena(arena: Arena) {
    const ok = confirm(
      `Criar uma assinatura NOVA para esta arena?\n\nArena: ${arena.name}\nValor: R$ ${formatMoney(DEFAULT_AMOUNT)}\n\nUse isso apenas quando essa arena for um cliente/assinante separado. Se for segunda arena do mesmo dono, NÃO crie outra assinatura.`
    );

    if (!ok) return;

    setSavingId(arena.id);

    const dueDay = new Date().getDate();
    const nextDueDate = getNextMonthDueDate(dueDay);

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .insert({
        arena_id: arena.id,
        plan_name: DEFAULT_PLAN,
        monthly_amount: DEFAULT_AMOUNT,
        due_day: dueDay,
        status: "active",
        next_due_date: nextDueDate,
        last_paid_at: new Date().toISOString(),
        payment_pix_key: DEFAULT_PIX_KEY,
        payment_whatsapp: DEFAULT_PAYMENT_WHATSAPP,
        notes:
          "Assinatura criada pelo Admin Master. Implementação paga. Primeira mensalidade para o próximo mês.",
      })
      .select("*")
      .single();

    if (error) {
      setSavingId("");
      return alert(error.message);
    }

    const referenceMonth = nextDueDate.slice(0, 7);

    const invoiceInsert = await supabase.from("subscription_invoices").insert({
      arena_id: arena.id,
      subscription_id: subscription.id,
      reference_month: referenceMonth,
      due_date: nextDueDate,
      amount: DEFAULT_AMOUNT,
      paid_amount: 0,
      status: "pending",
      notes: "Primeira mensalidade após período inicial.",
    });

    if (invoiceInsert.error) {
      setSavingId("");
      return alert(invoiceInsert.error.message);
    }

    await supabase
      .from("arenas")
      .update({
        subscription_status: "active",
        blocked_reason: null,
      })
      .eq("id", arena.id);

    setSavingId("");
    await loadAdminData();
  }

  async function markInvoicePaid(row: AdminRow) {
    if (!row.subscription || !row.currentInvoice) {
      return alert("Essa arena ainda não tem mensalidade criada.");
    }

    const ok = confirm(
      `Marcar como pago?\n\nArena: ${row.arena.name}\nValor: R$ ${formatMoney(row.currentInvoice.amount)}`
    );

    if (!ok) return;

    setSavingId(row.arena.id);

    const nextDueDate = getNextMonthDueDate(
      Number(row.subscription.due_day || new Date(row.currentInvoice.due_date).getDate()),
      row.currentInvoice.due_date
    );

    const nextReferenceMonth = nextDueDate.slice(0, 7);

    const paidRes = await supabase
      .from("subscription_invoices")
      .update({
        status: "paid",
        paid_amount: row.currentInvoice.amount,
        paid_at: new Date().toISOString(),
      })
      .eq("id", row.currentInvoice.id);

    if (paidRes.error) {
      setSavingId("");
      return alert(paidRes.error.message);
    }

    const subRes = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        last_paid_at: new Date().toISOString(),
        next_due_date: nextDueDate,
        blocked_at: null,
      })
      .eq("id", row.subscription.id);

    if (subRes.error) {
      setSavingId("");
      return alert(subRes.error.message);
    }

    await supabase
      .from("arenas")
      .update({
        subscription_status: "active",
        blocked_reason: null,
      })
      .eq("id", row.arena.id);

    const { data: existingNext } = await supabase
      .from("subscription_invoices")
      .select("id")
      .eq("arena_id", row.arena.id)
      .eq("reference_month", nextReferenceMonth)
      .maybeSingle();

    if (!existingNext) {
      const nextInvoiceRes = await supabase.from("subscription_invoices").insert({
        arena_id: row.arena.id,
        subscription_id: row.subscription.id,
        reference_month: nextReferenceMonth,
        due_date: nextDueDate,
        amount: Number(row.subscription.monthly_amount || DEFAULT_AMOUNT),
        paid_amount: 0,
        status: "pending",
        notes: "Mensalidade gerada após confirmação de pagamento.",
      });

      if (nextInvoiceRes.error) {
        setSavingId("");
        return alert(nextInvoiceRes.error.message);
      }
    }

    setSavingId("");
    await loadAdminData();
  }

  async function markInvoiceOverdue(row: AdminRow) {
    if (!row.subscription || !row.currentInvoice) {
      return alert("Essa arena ainda não tem mensalidade criada.");
    }

    const ok = confirm(`Marcar mensalidade da ${row.arena.name} como atrasada?`);
    if (!ok) return;

    setSavingId(row.arena.id);

    const invoiceRes = await supabase
      .from("subscription_invoices")
      .update({ status: "overdue" })
      .eq("id", row.currentInvoice.id);

    if (invoiceRes.error) {
      setSavingId("");
      return alert(invoiceRes.error.message);
    }

    const subRes = await supabase
      .from("subscriptions")
      .update({ status: "overdue" })
      .eq("id", row.subscription.id);

    if (subRes.error) {
      setSavingId("");
      return alert(subRes.error.message);
    }

    setSavingId("");
    await loadAdminData();
  }

  async function blockArena(row: AdminRow) {
    const reason =
      prompt(
        `Motivo do bloqueio da arena ${row.arena.name}:`,
        "Mensalidade em atraso. Regularize para voltar a usar o ArenaFlow."
      ) || "Mensalidade em atraso.";

    setSavingId(row.arena.id);

    const arenaRes = await supabase
      .from("arenas")
      .update({
        subscription_status: "blocked",
        blocked_reason: reason,
      })
      .eq("id", row.arena.id);

    if (arenaRes.error) {
      setSavingId("");
      return alert(arenaRes.error.message);
    }

    if (row.subscription) {
      const subRes = await supabase
        .from("subscriptions")
        .update({
          status: "blocked",
          blocked_at: new Date().toISOString(),
          notes: reason,
        })
        .eq("id", row.subscription.id);

      if (subRes.error) {
        setSavingId("");
        return alert(subRes.error.message);
      }
    }

    setSavingId("");
    await loadAdminData();
  }

  async function unblockArena(row: AdminRow) {
    const ok = confirm(`Desbloquear a arena ${row.arena.name}?`);
    if (!ok) return;

    setSavingId(row.arena.id);

    const arenaRes = await supabase
      .from("arenas")
      .update({
        subscription_status: "active",
        blocked_reason: null,
      })
      .eq("id", row.arena.id);

    if (arenaRes.error) {
      setSavingId("");
      return alert(arenaRes.error.message);
    }

    if (row.subscription) {
      const subRes = await supabase
        .from("subscriptions")
        .update({
          status: "active",
          blocked_at: null,
        })
        .eq("id", row.subscription.id);

      if (subRes.error) {
        setSavingId("");
        return alert(subRes.error.message);
      }
    }

    setSavingId("");
    await loadAdminData();
  }

  async function copyPix() {
    await navigator.clipboard.writeText(DEFAULT_PIX_KEY);
    alert("Chave Pix copiada!");
  }

  function openChargeWhatsapp(row: AdminRow) {
    if (!row.subscription) {
      return alert("Essa arena ainda não tem assinatura. Crie assinatura apenas se for um cliente pagante separado.");
    }

    const phone = normalizePhone(row.subscription.payment_whatsapp || DEFAULT_PAYMENT_WHATSAPP);
    const amount = row.currentInvoice?.amount || row.subscription.monthly_amount || DEFAULT_AMOUNT;
    const dueDate = row.currentInvoice?.due_date || row.subscription.next_due_date || "";
    const plan = row.subscription.plan_name || DEFAULT_PLAN;

    const message = `Olá! Passando para lembrar sobre a mensalidade do ArenaFlow.

Arena: ${row.arena.name}
Plano: ${plan}
Valor: R$ ${formatMoney(amount)}
Vencimento: ${dueDate ? formatDate(dueDate) : "A confirmar"}

Chave Pix: ${DEFAULT_PIX_KEY}

Após o pagamento, envie o comprovante por aqui para confirmação.`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }


  function generatePassword() {
    const password = Math.random().toString(36).slice(-8) + "A1";
    setNewOwnerPassword(password);
  }

  function handleArenaNameChange(value: string) {
    setNewArenaName(value);

    if (!newArenaSlug.trim()) {
      setNewArenaSlug(slugifyLocal(value));
    }
  }

  function resetNewClientForm() {
    setNewOwnerName("");
    setNewOwnerWhatsapp("");
    setNewOwnerEmail("");
    setNewOwnerPassword("");
    setNewArenaName("");
    setNewArenaSlug("");
    setNewPlanName(DEFAULT_PLAN);
    setNewMonthlyAmount(String(DEFAULT_AMOUNT));
    setCreatedClientResult(null);
  }

  async function createNewClient(event: React.FormEvent) {
    event.preventDefault();

    if (!newOwnerName.trim()) return alert("Informe o nome do dono.");
    if (!newOwnerEmail.trim()) return alert("Informe o e-mail do dono.");
    if (!newOwnerPassword.trim()) return alert("Informe uma senha inicial.");
    if (!newArenaName.trim()) return alert("Informe o nome da arena.");
    if (!newArenaSlug.trim()) return alert("Informe o slug da arena.");

    setCreatingClient(true);
    setCreatedClientResult(null);

    const response = await fetch("/api/admin/create-client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ownerName: newOwnerName,
        ownerWhatsapp: newOwnerWhatsapp,
        ownerEmail: newOwnerEmail,
        ownerPassword: newOwnerPassword,
        arenaName: newArenaName,
        arenaSlug: newArenaSlug,
        planName: newPlanName,
        monthlyAmount: Number(newMonthlyAmount || DEFAULT_AMOUNT),
      }),
    });

    const result = await response.json();
    setCreatingClient(false);

    if (!response.ok) {
      alert(result.error || "Erro ao criar cliente.");
      return;
    }

    setCreatedClientResult(result);
    await loadAdminData();
  }

  async function copyCreatedAccess() {
    if (!createdClientResult) return;

    const text = `Seu ArenaFlow está pronto.

Painel:
${window.location.origin}/login

E-mail:
${createdClientResult.login.email}

Senha inicial:
${createdClientResult.login.password}

Link público da arena:
${window.location.origin}${createdClientResult.public_url}

Sua mensalidade começa somente no próximo mês.`;

    await navigator.clipboard.writeText(text);
    alert("Mensagem copiada!");
  }

  function openCreatedAccessWhatsapp() {
    if (!createdClientResult) return;

    const phone = normalizePhone(newOwnerWhatsapp);

    const text = `Seu ArenaFlow está pronto.

Painel:
${window.location.origin}/login

E-mail:
${createdClientResult.login.email}

Senha inicial:
${createdClientResult.login.password}

Link público da arena:
${window.location.origin}${createdClientResult.public_url}

Sua mensalidade começa somente no próximo mês.`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#050B12] text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando Admin Master...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050B12] p-6 text-white">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/30">
          <div className="relative p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.18),transparent_35%)]" />

            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                  <ShieldCheck size={16} />
                  Admin Master
                </div>

                <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                  Controle do ArenaFlow
                </h1>

                <p className="mt-3 max-w-3xl text-slate-400">
                  Gerencie assinantes, mensalidades, cobranças pelo WhatsApp, pagamentos manuais e bloqueio das arenas.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetNewClientForm();
                    setNewClientOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-black transition hover:bg-emerald-400"
                >
                  <UserPlus size={18} />
                  Novo cliente
                </button>

                <button
                  type="button"
                  onClick={copyPix}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 font-black text-white transition hover:border-emerald-400"
                >
                  <Copy size={18} />
                  Copiar Pix
                </button>

                <button
                  type="button"
                  onClick={loadAdminData}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-black transition hover:bg-emerald-400"
                >
                  <RefreshCw size={18} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
          <StatCard icon={<Building2 />} label="Arenas" value={stats.total} />
          <StatCard icon={<CreditCard />} label="Assinaturas" value={stats.subscribers} />
          <StatCard icon={<CheckCircle2 />} label="Ativas" value={stats.active} />
          <StatCard icon={<CalendarDays />} label="Pendentes" value={stats.pending} />
          <StatCard icon={<AlertTriangle />} label="Atrasadas" value={stats.overdue} />
          <StatCard icon={<Lock />} label="Bloqueadas" value={stats.blocked} />
          <StatCard icon={<Wallet />} label="MRR previsto" value={`R$ ${formatMoney(stats.mrr)}`} />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
              Valor pendente
            </p>
            <p className="mt-2 text-4xl font-black">R$ {formatMoney(stats.pendingAmount)}</p>
            <p className="mt-2 text-sm text-slate-400">
              Soma apenas de assinaturas criadas, não de todas as arenas cadastradas.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
              Pix / WhatsApp de cobrança
            </p>
            <p className="mt-2 text-2xl font-black">{DEFAULT_PIX_KEY}</p>
            <p className="mt-2 text-sm text-slate-400">
              Esse número será usado nos avisos e comprovantes.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6 shadow-xl shadow-black/20">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-black">Assinantes</h2>
              <p className="mt-1 text-sm text-slate-400">
                Uma assinatura = um cliente pagante. Arenas extras do mesmo dono não entram no MRR automaticamente.
              </p>
            </div>

            <div className="relative w-full md:w-96">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar arena, slug ou WhatsApp..."
                className="w-full rounded-2xl border border-white/10 bg-[#07111B] py-4 pl-11 pr-4 text-white outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
            <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr] bg-white/[0.03] px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-500 xl:grid">
              <div>Arena</div>
              <div>Plano</div>
              <div>Mensalidade</div>
              <div>Status</div>
              <div>Ações</div>
            </div>

            {rows.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Nenhuma arena encontrada.</div>
            ) : (
              <div className="divide-y divide-white/10">
                {rows.map((row) => (
                  <ArenaRow
                    key={row.arena.id}
                    row={row}
                    saving={savingId === row.arena.id}
                    onCreate={() => createSubscriptionForArena(row.arena)}
                    onCharge={() => openChargeWhatsapp(row)}
                    onPaid={() => markInvoicePaid(row)}
                    onOverdue={() => markInvoiceOverdue(row)}
                    onBlock={() => blockArena(row)}
                    onUnblock={() => unblockArena(row)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {newClientOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0F172A] shadow-2xl shadow-black">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[#0F172A] p-6">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-400">
                  Admin Master
                </p>
                <h2 className="mt-1 text-3xl font-black text-white">
                  Novo cliente ArenaFlow
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setNewClientOpen(false)}
                className="rounded-2xl border border-white/10 p-3 text-slate-300 transition hover:border-red-400 hover:text-red-300"
              >
                <X size={20} />
              </button>
            </div>

            {!createdClientResult ? (
              <form onSubmit={createNewClient} className="space-y-6 p-6">
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                  <h3 className="text-xl font-black text-white">Como funciona</h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/80">
                    Esse formulário cria o usuário do dono, cria a arena, vincula o acesso,
                    cria a assinatura e gera a primeira mensalidade para o próximo mês.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <h3 className="mb-3 flex items-center gap-2 text-xl font-black text-white">
                      <UserPlus className="text-emerald-400" />
                      Dados do dono
                    </h3>
                  </div>

                  <AdminInput
                    label="Nome do dono"
                    value={newOwnerName}
                    onChange={setNewOwnerName}
                    placeholder="Ex: João Silva"
                  />

                  <AdminInput
                    label="WhatsApp do dono"
                    value={newOwnerWhatsapp}
                    onChange={(value) => setNewOwnerWhatsapp(value.replace(/\D/g, ""))}
                    placeholder="22999999999"
                  />

                  <AdminInput
                    label="E-mail de acesso"
                    value={newOwnerEmail}
                    onChange={setNewOwnerEmail}
                    placeholder="cliente@email.com"
                    type="email"
                  />

                  <div>
                    <label className="mb-2 block text-sm font-black text-slate-300">
                      Senha inicial
                    </label>

                    <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-[#07111B] focus-within:border-emerald-400">
                      <input
                        value={newOwnerPassword}
                        onChange={(event) => setNewOwnerPassword(event.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-transparent p-4 text-white outline-none"
                      />

                      <button
                        type="button"
                        onClick={generatePassword}
                        className="flex items-center gap-2 border-l border-white/10 px-4 font-black text-emerald-300 hover:bg-white/5"
                      >
                        <KeyRound size={16} />
                        Gerar
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="mb-3 mt-4 flex items-center gap-2 text-xl font-black text-white">
                      <Building2 className="text-emerald-400" />
                      Dados da arena
                    </h3>
                  </div>

                  <AdminInput
                    label="Nome da arena"
                    value={newArenaName}
                    onChange={handleArenaNameChange}
                    placeholder="Ex: Arena São Pedro"
                  />

                  <AdminInput
                    label="Slug do link público"
                    value={newArenaSlug}
                    onChange={(value) => setNewArenaSlug(slugifyLocal(value))}
                    placeholder="arena-sao-pedro"
                  />

                  <div className="md:col-span-2">
                    <div className="rounded-2xl border border-white/10 bg-[#07111B] p-4">
                      <p className="text-sm text-slate-400">Link público previsto</p>
                      <p className="mt-1 break-all font-black text-emerald-300">
                        {typeof window !== "undefined"
                          ? `${window.location.origin}/arena/${newArenaSlug || "slug-da-arena"}`
                          : `/arena/${newArenaSlug || "slug-da-arena"}`}
                      </p>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <h3 className="mb-3 mt-4 flex items-center gap-2 text-xl font-black text-white">
                      <CreditCard className="text-emerald-400" />
                      Assinatura
                    </h3>
                  </div>

                  <AdminInput
                    label="Plano"
                    value={newPlanName}
                    onChange={setNewPlanName}
                    placeholder="ArenaFlow Start"
                  />

                  <AdminInput
                    label="Valor mensal"
                    value={newMonthlyAmount}
                    onChange={setNewMonthlyAmount}
                    placeholder="89.90"
                    type="number"
                  />
                </div>

                <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5">
                  <p className="font-black text-yellow-100">Regra comercial aplicada</p>
                  <p className="mt-2 text-sm leading-relaxed text-yellow-100/80">
                    O cliente pagou a implementação agora. A assinatura será criada como ativa
                    e a primeira mensalidade ficará para o próximo mês.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={creatingClient}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-5 text-lg font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {creatingClient ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Criando cliente...
                    </>
                  ) : (
                    <>
                      <Plus />
                      Criar cliente completo
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-6 p-6">
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-emerald-500 p-3 text-black">
                      <CheckCircle2 />
                    </div>

                    <div>
                      <h3 className="text-2xl font-black text-white">
                        Cliente criado com sucesso!
                      </h3>
                      <p className="mt-2 text-slate-300">
                        Acesso, arena, vínculo, assinatura e primeira mensalidade foram criados.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <ResultBox
                    label="Painel"
                    value={
                      typeof window !== "undefined"
                        ? `${window.location.origin}/login`
                        : "/login"
                    }
                  />

                  <ResultBox
                    label="Link público"
                    value={
                      typeof window !== "undefined"
                        ? `${window.location.origin}${createdClientResult.public_url}`
                        : createdClientResult.public_url
                    }
                  />

                  <ResultBox label="E-mail" value={createdClientResult.login.email} />
                  <ResultBox label="Senha" value={createdClientResult.login.password} />
                  <ResultBox label="Próximo vencimento" value={formatDate(createdClientResult.subscription.next_due_date)} />
                  <ResultBox label="Mensalidade" value={`R$ ${formatMoney(createdClientResult.subscription.monthly_amount)}`} />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={copyCreatedAccess}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400 hover:text-emerald-300"
                  >
                    <Copy />
                    Copiar mensagem de acesso
                  </button>

                  <button
                    type="button"
                    onClick={openCreatedAccessWhatsapp}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400"
                  >
                    <MessageCircle />
                    Enviar no WhatsApp
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewClientOpen(false);
                    resetNewClientForm();
                  }}
                  className="w-full rounded-2xl border border-white/10 px-5 py-4 font-black text-slate-300 transition hover:border-emerald-400 hover:text-white"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}

function ArenaRow({
  row,
  saving,
  onCreate,
  onCharge,
  onPaid,
  onOverdue,
  onBlock,
  onUnblock,
}: {
  row: AdminRow;
  saving: boolean;
  onCreate: () => void;
  onCharge: () => void;
  onPaid: () => void;
  onOverdue: () => void;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const { arena, subscription, currentInvoice, status } = row;

  return (
    <div className="grid gap-5 px-5 py-5 xl:grid-cols-[1.2fr_1fr_1fr_1fr_1.4fr] xl:items-center">
      <div>
        <p className="text-lg font-black text-white">{arena.name}</p>

        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
          {arena.slug && <span>/arena/{arena.slug}</span>}
          {arena.whatsapp && <span>• {arena.whatsapp}</span>}
        </div>

        {!subscription && (
          <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">
            Sem assinatura. Não entra no MRR e não gera cobrança até você criar uma assinatura manualmente.
          </p>
        )}

        {arena.blocked_reason && (
          <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {arena.blocked_reason}
          </p>
        )}
      </div>

      <div>
        <p className="font-black text-white">{subscription?.plan_name || "Sem assinatura"}</p>
        <p className="mt-1 text-sm text-slate-500">
          {subscription ? `Vence dia ${subscription.due_day || "-"}` : "Não cobra"}
        </p>
      </div>

      <div>
        <p className="text-xl font-black text-white">
          {subscription ? `R$ ${formatMoney(subscription.monthly_amount || DEFAULT_AMOUNT)}` : "-"}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          Próx: {currentInvoice?.due_date ? formatDate(currentInvoice.due_date) : subscription?.next_due_date ? formatDate(subscription.next_due_date) : "-"}
        </p>
      </div>

      <div>
        <StatusBadge status={status} />

        {currentInvoice && (
          <p className="mt-2 text-xs text-slate-500">Ref: {formatReference(currentInvoice.reference_month)}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {saving ? (
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-slate-300"
          >
            <Loader2 size={16} className="animate-spin" />
            Salvando...
          </button>
        ) : !subscription ? (
          <ActionButton onClick={onCreate} icon={<CreditCard size={16} />}>
            Criar assinatura separada
          </ActionButton>
        ) : (
          <>
            <ActionButton onClick={onCharge} icon={<MessageCircle size={16} />}>
              Cobrar
            </ActionButton>

            <ActionButton onClick={onPaid} icon={<CheckCircle2 size={16} />}>
              Pago
            </ActionButton>

            <ActionButton onClick={onOverdue} icon={<AlertTriangle size={16} />}>
              Atrasar
            </ActionButton>

            {status === "blocked" ? (
              <ActionButton onClick={onUnblock} icon={<Unlock size={16} />}>
                Desbloquear
              </ActionButton>
            ) : (
              <DangerButton onClick={onBlock} icon={<Lock size={16} />}>
                Bloquear
              </DangerButton>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 shadow-xl shadow-black/10">
      <div className="mb-4 text-emerald-400">{icon}</div>
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function ActionButton({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white transition hover:border-emerald-400 hover:text-emerald-300"
    >
      {icon}
      {children}
    </button>
  );
}

function DangerButton({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-black text-red-300 transition hover:bg-red-500 hover:text-white"
    >
      {icon}
      {children}
    </button>
  );
}


function AdminInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-black text-slate-300">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-[#07111B] p-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400"
      />
    </div>
  );
}

function ResultBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07111B] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-all font-black text-white">{value}</p>
    </div>
  );
}

function slugifyLocal(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function getStatusConfig(status: string) {
  if (status === "active") {
    return {
      label: "Em dia",
      icon: <CheckCircle2 size={14} />,
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (status === "pending") {
    return {
      label: "Pendente",
      icon: <CalendarDays size={14} />,
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
    };
  }

  if (status === "overdue") {
    return {
      label: "Atrasado",
      icon: <AlertTriangle size={14} />,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  if (status === "blocked") {
    return {
      label: "Bloqueado",
      icon: <XCircle size={14} />,
      className: "border-red-500/30 bg-red-500/10 text-red-300",
    };
  }

  if (status === "partial") {
    return {
      label: "Parcial",
      icon: <Wallet size={14} />,
      className: "border-blue-500/30 bg-blue-500/10 text-blue-300",
    };
  }

  if (status === "no_subscription") {
    return {
      label: "Sem assinatura",
      icon: <ShieldCheck size={14} />,
      className: "border-white/10 bg-white/5 text-slate-400",
    };
  }

  return {
    label: status || "Indefinido",
    icon: <ShieldCheck size={14} />,
    className: "border-white/10 bg-white/5 text-slate-300",
  };
}

function getRealStatus(arena: Arena, subscription: Subscription | null, invoice: SubscriptionInvoice | null) {
  if (arena.subscription_status === "blocked") return "blocked";
  if (subscription?.status === "blocked") return "blocked";

  if (!subscription) return "no_subscription";

  if (invoice?.status === "paid") return "active";
  if (invoice?.status === "partial") return "partial";
  if (invoice?.status === "overdue") return "overdue";

  if (invoice?.status === "pending") {
    if (isPastDue(invoice.due_date)) return "overdue";
    return "pending";
  }

  return subscription.status || "active";
}

function getNextMonthDueDate(day: number, baseDate?: string) {
  const base = baseDate ? new Date(`${baseDate}T00:00:00`) : new Date();
  const due = new Date(base.getFullYear(), base.getMonth() + 1, day);
  return due.toISOString().slice(0, 10);
}

function isPastDue(date: string) {
  return new Date(`${date}T23:59:59`) < new Date();
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function formatMoney(value: string | number | null | undefined) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  if (!date) return "-";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function formatReference(reference: string | null) {
  if (!reference) return "-";

  const [year, month] = reference.split("-");

  const months: Record<string, string> = {
    "01": "Jan",
    "02": "Fev",
    "03": "Mar",
    "04": "Abr",
    "05": "Mai",
    "06": "Jun",
    "07": "Jul",
    "08": "Ago",
    "09": "Set",
    "10": "Out",
    "11": "Nov",
    "12": "Dez",
  };

  return `${months[month] || month}/${year}`;
}

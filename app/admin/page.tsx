"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  Crown,
  Edit3,
  Eye,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type PlanKey = "essential" | "pro";
type AdminView = "overview" | "trial" | "trial_expired" | "active" | "overdue" | "blocked" | "essential" | "pro";

type Arena = {
  id: string;
  name: string;
  slug: string | null;
  whatsapp: string | null;
  phone: string | null;
  subscription_status: string | null;
  blocked_reason: string | null;
  created_at: string;
};

type Plan = {
  id: string;
  plan_key: PlanKey | string;
  name: string;
  description: string | null;
  monthly_price: number;
  implementation_price: number;
  max_arenas: number;
  allow_multi_arena: boolean;
  is_active: boolean;
};

type Subscription = {
  id: string;
  arena_id: string;
  plan_key: PlanKey | string | null;
  billing_provider: string | null;
  status: string | null;
  lifecycle_stage: string | null;
  asaas_status: string | null;
  monthly_amount: number | null;
  next_due_date: string | null;
  asaas_next_due_date: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  asaas_last_payment_id: string | null;
  asaas_last_pix_payload: string | null;
  max_arenas: number | null;
  allow_multi_arena: boolean | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  activated_at: string | null;
  blocked_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_cpf_cnpj: string | null;
  created_at: string;
};

type Payment = {
  id: string;
  arena_id: string | null;
  subscription_id: string | null;
  status: string | null;
  value: number | null;
  due_date: string | null;
  payment_date: string | null;
  created_at: string;
};

type AdminRow = {
  arena: Arena;
  subscription: Subscription | null;
  plan: Plan | null;
  payments: Payment[];
  status: string;
  trialDaysLeft: number | null;
};

const today = new Date().toISOString().slice(0, 10);

const initialCreateForm = {
  owner_name: "",
  owner_email: "",
  owner_whatsapp: "",
  owner_cpf_cnpj: "",
  owner_password: "",
  arena_name: "",
  arena_slug: "",
  plan_key: "essential" as PlanKey,
  trial_days: "7",
};

type EditForm = {
  arena_id: string;
  subscription_id: string | null;
  arena_name: string;
  arena_slug: string;
  owner_name: string;
  owner_email: string;
  owner_whatsapp: string;
  owner_cpf_cnpj: string;
  plan_key: PlanKey;
  status: string;
};

export default function AdminMasterPage() {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<AdminView>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsRow, setDetailsRow] = useState<AdminRow | null>(null);
  const [editRow, setEditRow] = useState<AdminRow | null>(null);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [createdClient, setCreatedClient] = useState<any>(null);

  const [arenas, setArenas] = useState<Arena[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    loadAdmin();
  }, []);

  const rows = useMemo<AdminRow[]>(() => {
    return arenas.map((arena) => {
      const subscription = subscriptions.find((item) => item.arena_id === arena.id) || null;
      const planKey = subscription?.plan_key || "essential";
      const plan =
        plans.find((item) => item.plan_key === planKey) ||
        plans.find((item) => item.plan_key === "essential") ||
        null;
      const arenaPayments = payments.filter((payment) => payment.arena_id === arena.id || payment.subscription_id === subscription?.id);
      const trialDaysLeft = subscription?.trial_ends_at ? daysBetween(today, subscription.trial_ends_at.slice(0, 10)) : null;

      return {
        arena,
        subscription,
        plan,
        payments: arenaPayments,
        trialDaysLeft,
        status: getBusinessStatus(arena, subscription, arenaPayments),
      };
    });
  }, [arenas, subscriptions, plans, payments]);

  const metrics = useMemo(() => {
    const active = rows.filter((row) => row.status === "active");
    const trial = rows.filter((row) => row.status === "trialing");
    const trialEnding = rows.filter((row) => row.status === "trialing" && row.trialDaysLeft !== null && row.trialDaysLeft <= 1);
    const trialExpired = rows.filter((row) => row.status === "trial_expired");
    const overdue = rows.filter((row) => row.status === "overdue");
    const blocked = rows.filter((row) => row.status === "blocked");
    const essential = rows.filter((row) => (row.subscription?.plan_key || "essential") === "essential");
    const pro = rows.filter((row) => row.subscription?.plan_key === "pro");

    const mrr = active.reduce((sum, row) => sum + Number(row.subscription?.monthly_amount || row.plan?.monthly_price || 0), 0);

    const receivedMonth = payments
      .filter((payment) => String(payment.payment_date || "").slice(0, 7) === today.slice(0, 7))
      .reduce((sum, payment) => sum + Number(payment.value || 0), 0);

    return {
      total: rows.length,
      active: active.length,
      trial: trial.length,
      trialEnding: trialEnding.length,
      trialExpired: trialExpired.length,
      overdue: overdue.length,
      blocked: blocked.length,
      essential: essential.length,
      pro: pro.length,
      mrr,
      receivedMonth,
    };
  }, [rows, payments]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const numeric = onlyDigits(search);

    return rows.filter((row) => {
      const matchesView =
        view === "overview" ||
        row.status === view ||
        (view === "trial" && row.status === "trialing") ||
        (view === "essential" && (row.subscription?.plan_key || "essential") === "essential") ||
        (view === "pro" && row.subscription?.plan_key === "pro");

      if (!matchesView) return false;

      if (!term && !numeric) return true;

      return (
        row.arena.name.toLowerCase().includes(term) ||
        String(row.arena.slug || "").toLowerCase().includes(term) ||
        String(row.subscription?.customer_name || "").toLowerCase().includes(term) ||
        String(row.subscription?.customer_email || "").toLowerCase().includes(term) ||
        String(row.arena.whatsapp || "").includes(numeric) ||
        String(row.subscription?.customer_phone || "").includes(numeric) ||
        String(row.subscription?.customer_cpf_cnpj || "").includes(numeric) ||
        String(row.subscription?.asaas_subscription_id || "").toLowerCase().includes(term)
      );
    });
  }, [rows, search, view]);

  async function loadAdmin() {
    setLoading(true);

    const [arenasRes, subscriptionsRes, plansRes, paymentsRes] = await Promise.all([
      supabase
        .from("arenas")
        .select("id, name, slug, whatsapp, phone, subscription_status, blocked_reason, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("plans")
        .select("*")
        .order("sort_order", { ascending: true }),
      supabase
        .from("asaas_payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(400),
    ]);

    setLoading(false);

    if (arenasRes.error) return alert(arenasRes.error.message);
    if (subscriptionsRes.error) return alert(subscriptionsRes.error.message);
    if (plansRes.error) return alert(plansRes.error.message);
    if (paymentsRes.error) return alert(paymentsRes.error.message);

    setArenas((arenasRes.data || []) as Arena[]);
    setSubscriptions((subscriptionsRes.data || []) as Subscription[]);
    setPlans((plansRes.data || []) as Plan[]);
    setPayments((paymentsRes.data || []) as Payment[]);
  }

  async function createClient(event: React.FormEvent) {
    event.preventDefault();

    if (!createForm.owner_name.trim()) return alert("Informe o nome do responsável.");
    if (!createForm.owner_email.trim()) return alert("Informe o e-mail do responsável.");
    if (!isValidCpfCnpj(createForm.owner_cpf_cnpj)) return alert("Informe CPF ou CNPJ válido.");
    if (!createForm.owner_password.trim() || createForm.owner_password.length < 6) return alert("A senha precisa ter pelo menos 6 caracteres.");
    if (!createForm.arena_name.trim()) return alert("Informe o nome da arena.");

    setActionLoading("create");
    setCreatedClient(null);

    try {
      const token = await getSessionToken();

      const response = await fetch("/api/admin/create-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...createForm,
          owner_whatsapp: onlyDigits(createForm.owner_whatsapp),
          owner_cpf_cnpj: onlyDigits(createForm.owner_cpf_cnpj),
          arena_slug: slugify(createForm.arena_slug),
          trial_days: Number(createForm.trial_days || 7),
        }),
      });

      const data = await response.json().catch(() => null);

      setActionLoading("");

      if (!response.ok) return alert(data?.error || "Erro ao criar cliente.");

      setCreatedClient(data);
      setCreateForm(initialCreateForm);
      await loadAdmin();
    } catch {
      setActionLoading("");
      alert("Erro ao criar cliente agora.");
    }
  }

  function openEdit(row: AdminRow) {
    setEditRow(row);
  }

  async function saveEdit(form: EditForm) {
    if (!form.arena_name.trim()) return alert("Informe o nome da arena.");
    if (!form.owner_name.trim()) return alert("Informe o nome do responsável.");
    if (!form.owner_email.trim()) return alert("Informe o e-mail.");
    if (!isValidCpfCnpj(form.owner_cpf_cnpj)) return alert("Informe CPF ou CNPJ válido.");

    setActionLoading(`edit:${form.arena_id}`);

    try {
      const token = await getSessionToken();

      const response = await fetch("/api/admin/update-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...form,
          owner_whatsapp: onlyDigits(form.owner_whatsapp),
          owner_cpf_cnpj: onlyDigits(form.owner_cpf_cnpj),
          arena_slug: slugify(form.arena_slug),
        }),
      });

      const data = await response.json().catch(() => null);

      setActionLoading("");

      if (!response.ok) return alert(data?.error || "Erro ao atualizar cliente.");

      setEditRow(null);
      await loadAdmin();
    } catch {
      setActionLoading("");
      alert("Erro ao salvar edição.");
    }
  }

  async function deleteClient(row: AdminRow) {
    const confirmed = window.confirm(
      `Excluir ${row.arena.name}? Essa ação remove arena, vínculo, assinatura e usuário de acesso.`
    );

    if (!confirmed) return;

    setActionLoading(`delete:${row.arena.id}`);

    try {
      const token = await getSessionToken();

      const response = await fetch("/api/admin/delete-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          arena_id: row.arena.id,
        }),
      });

      const data = await response.json().catch(() => null);

      setActionLoading("");

      if (!response.ok) return alert(data?.error || "Erro ao excluir cliente.");

      if (detailsRow?.arena.id === row.arena.id) setDetailsRow(null);
      await loadAdmin();
    } catch {
      setActionLoading("");
      alert("Erro ao excluir cliente.");
    }
  }

  async function quickStatus(row: AdminRow, status: "trialing" | "active" | "blocked") {
    const form: EditForm = {
      arena_id: row.arena.id,
      subscription_id: row.subscription?.id || null,
      arena_name: row.arena.name,
      arena_slug: row.arena.slug || "",
      owner_name: row.subscription?.customer_name || row.arena.name,
      owner_email: row.subscription?.customer_email || "",
      owner_whatsapp: row.subscription?.customer_phone || row.arena.whatsapp || "",
      owner_cpf_cnpj: row.subscription?.customer_cpf_cnpj || "",
      plan_key: ((row.subscription?.plan_key || "essential") as PlanKey),
      status,
    };

    await saveEdit(form);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] text-slate-950">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <Loader2 className="animate-spin text-emerald-400" />
            Carregando operação...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FB] text-slate-950">
      <div className="mx-auto max-w-[1600px] space-y-4 p-4 md:p-6">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-slate-950" />
          <div className="px-5 py-4 md:px-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-emerald-300 shadow-sm">
                  AF
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    <ShieldCheck size={13} />
                    Backoffice SaaS
                  </div>
                  <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                    Clientes ArenaFlow
                  </h1>
                </div>
              </div>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
                Controle clientes, planos, trial, assinatura Asaas, bloqueios e suporte em uma tela operacional.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/admin/automations"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-black text-slate-700 transition hover:border-emerald-300 hover:text-slate-950"
              >
                <Bot size={18} />
                Automações
              </Link>
              <button
                type="button"
                onClick={loadAdmin}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-black text-slate-700 transition hover:border-emerald-300 hover:text-slate-950"
              >
                <RefreshCw size={18} />
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white transition hover:bg-slate-800"
              >
                <Plus size={18} />
                Novo cliente
              </button>
            </div>
          </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="MRR" value={`R$ ${formatMoney(metrics.mrr)}`} sub="recorrência ativa" tone="emerald" icon={<TrendingUp />} />
          <MetricCard label="Clientes" value={metrics.total} sub={`${metrics.active} ativos`} tone="slate" icon={<Building2 />} />
          <MetricCard label="Trial" value={metrics.trial} sub={`${metrics.trialEnding} vencendo`} tone="yellow" icon={<Clock3 />} />
          <MetricCard label="Expirados" value={metrics.trialExpired} sub="precisam ativar" tone="red" icon={<AlertTriangle />} />
          <MetricCard label="Planos" value={`${metrics.essential}/${metrics.pro}`} sub="Essencial / Pro" tone="violet" icon={<Crown />} />
          <MetricCard label="Recebido" value={`R$ ${formatMoney(metrics.receivedMonth)}`} sub="mês atual" tone="blue" icon={<WalletCards />} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ViewPill active={view === "overview"} onClick={() => setView("overview")}>Todos</ViewPill>
              <ViewPill active={view === "trial"} onClick={() => setView("trial")}>Trial</ViewPill>
              <ViewPill active={view === "trial_expired"} onClick={() => setView("trial_expired")}>Expirados</ViewPill>
              <ViewPill active={view === "active"} onClick={() => setView("active")}>Ativos</ViewPill>
              <ViewPill active={view === "overdue"} onClick={() => setView("overdue")}>Atrasados</ViewPill>
              <ViewPill active={view === "blocked"} onClick={() => setView("blocked")}>Bloqueados</ViewPill>
              <ViewPill active={view === "essential"} onClick={() => setView("essential")}>Essencial</ViewPill>
              <ViewPill active={view === "pro"} onClick={() => setView("pro")}>Pro</ViewPill>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={18} className="text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, arena, CPF, telefone ou Asaas..."
                className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-xl font-black">Clientes</h2>
              <p className="mt-1 text-sm text-slate-600">{filteredRows.length} cliente(s) nesta visão.</p>
            </div>

            <div className="divide-y divide-white/10">
              {filteredRows.length === 0 ? (
                <div className="p-10 text-center text-slate-500">Nenhum cliente encontrado.</div>
              ) : (
                filteredRows.map((row) => (
                  <ClientListItem
                    key={row.arena.id}
                    row={row}
                    loading={actionLoading}
                    onDetails={() => setDetailsRow(row)}
                    onEdit={() => openEdit(row)}
                    onDelete={() => deleteClient(row)}
                  />
                ))
              )}
            </div>
          </div>

        </section>
      </div>

      {createOpen && (
        <CreateClientModal
          form={createForm}
          setForm={setCreateForm}
          plans={plans}
          loading={actionLoading === "create"}
          createdClient={createdClient}
          onSubmit={createClient}
          onClose={() => {
            setCreateOpen(false);
            setCreatedClient(null);
          }}
        />
      )}

      {editRow && (
        <EditClientModal
          row={editRow}
          plans={plans}
          loading={actionLoading === `edit:${editRow.arena.id}`}
          onClose={() => setEditRow(null)}
          onSave={saveEdit}
        />
      )}

      {detailsRow && (
        <DetailsDrawer
          row={detailsRow}
          loading={actionLoading}
          onClose={() => setDetailsRow(null)}
          onEdit={() => {
            setEditRow(detailsRow);
            setDetailsRow(null);
          }}
          onDelete={() => deleteClient(detailsRow)}
          onTrial={() => quickStatus(detailsRow, "trialing")}
          onActive={() => quickStatus(detailsRow, "active")}
          onBlocked={() => quickStatus(detailsRow, "blocked")}
        />
      )}
    </main>
  );
}

function ClientListItem({
  row,
  loading,
  onDetails,
  onEdit,
  onDelete,
}: {
  row: AdminRow;
  loading: string;
  onDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deleting = loading === `delete:${row.arena.id}`;
  const wa = normalizePhone(row.subscription?.customer_phone || row.arena.whatsapp || "");

  return (
    <div className="grid gap-4 border-l-4 border-transparent px-5 py-4 transition hover:border-emerald-500 hover:bg-slate-50 xl:grid-cols-[1.5fr_140px_140px_150px_170px] xl:items-center">
      <button type="button" onClick={onDetails} className="min-w-0 text-left">
        <div className="flex items-start gap-3">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-emerald-300 md:flex">
            {initials(row.arena.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-black text-slate-950">{row.arena.name}</p>
              {!row.subscription?.asaas_subscription_id && (
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase text-orange-700 ring-1 ring-orange-200">
                  Sem Asaas
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-slate-600">
              {row.subscription?.customer_name || "Responsável não informado"} • {row.subscription?.customer_email || "sem e-mail"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 xl:hidden">
              <PlanBadge planKey={row.subscription?.plan_key || "essential"} />
              <StatusBadge status={row.status} />
            </div>
          </div>
        </div>
      </button>

      <div className="hidden xl:block">
        <PlanBadge planKey={row.subscription?.plan_key || "essential"} />
        <p className="mt-2 text-xs font-bold text-slate-500">R$ {formatMoney(row.subscription?.monthly_amount || row.plan?.monthly_price || 0)}/mês</p>
      </div>

      <div className="hidden xl:block">
        <StatusBadge status={row.status} />
        <p className="mt-2 text-xs font-bold text-slate-500">
          {row.trialDaysLeft === null ? "sem trial" : row.trialDaysLeft < 0 ? "trial expirado" : `${row.trialDaysLeft}d trial`}
        </p>
      </div>

      <div className="hidden text-sm font-black text-slate-800 xl:block">
        {row.subscription?.asaas_next_due_date ? formatDate(row.subscription.asaas_next_due_date) : "-"}
        <p className="mt-2 text-xs font-bold text-slate-600">Vencimento</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            title="WhatsApp"
          >
            <MessageCircle size={17} />
          </a>
        )}
        <button onClick={onDetails} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-950" title="Detalhes">
          <Eye size={17} />
        </button>
        <button onClick={onEdit} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-950" title="Editar">
          <Edit3 size={17} />
        </button>
        <button disabled={deleting} onClick={onDelete} className="rounded-lg border border-red-200 bg-white p-2 text-red-500 transition hover:bg-red-50 disabled:opacity-60" title="Excluir">
          {deleting ? <Loader2 className="animate-spin" size={17} /> : <Trash2 size={17} />}
        </button>
      </div>
    </div>
  );
}

function CreateClientModal({
  form,
  setForm,
  plans,
  loading,
  createdClient,
  onSubmit,
  onClose,
}: {
  form: typeof initialCreateForm;
  setForm: (form: typeof initialCreateForm) => void;
  plans: Plan[];
  loading: boolean;
  createdClient: any;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="Novo cliente" subtitle="Crie o acesso em trial sem gerar cobrança Asaas agora." onClose={onClose}>
      {createdClient && (
        <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <h3 className="font-black text-emerald-100">Cliente criado</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <CopyLine label="Login" value={createdClient.login_url || "/login"} />
            <CopyLine label="E-mail" value={createdClient.owner_email || ""} />
            <CopyLine label="Senha" value={createdClient.owner_password || ""} />
            <CopyLine label="Trial até" value={createdClient.trial_ends_at ? formatDate(createdClient.trial_ends_at) : ""} />
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput label="Responsável" value={form.owner_name} onChange={(value) => setForm({ ...form, owner_name: value })} placeholder="Nome do dono" />
          <TextInput label="E-mail de acesso" value={form.owner_email} onChange={(value) => setForm({ ...form, owner_email: value })} placeholder="cliente@email.com" />
          <TextInput label="WhatsApp" value={form.owner_whatsapp} onChange={(value) => setForm({ ...form, owner_whatsapp: onlyDigits(value) })} placeholder="22999999999" />
          <TextInput label="CPF ou CNPJ" value={form.owner_cpf_cnpj} onChange={(value) => setForm({ ...form, owner_cpf_cnpj: onlyDigits(value) })} placeholder="Somente números" />
          <TextInput label="Senha inicial" value={form.owner_password} onChange={(value) => setForm({ ...form, owner_password: value })} placeholder="mínimo 6 caracteres" type="password" />
          <TextInput label="Dias de trial" value={form.trial_days} onChange={(value) => setForm({ ...form, trial_days: onlyDigits(value) || "7" })} placeholder="7" />
          <TextInput label="Nome da arena" value={form.arena_name} onChange={(value) => setForm({ ...form, arena_name: value })} placeholder="Arena Beach" />
          <TextInput label="Slug" value={form.arena_slug} onChange={(value) => setForm({ ...form, arena_slug: slugify(value) })} placeholder="arena-beach" />
        </div>

        <PlanSelector value={form.plan_key} plans={plans} onChange={(plan_key) => setForm({ ...form, plan_key })} />

        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white transition hover:bg-slate-800 disabled:opacity-60">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
          Criar cliente em trial
        </button>
      </form>
    </Modal>
  );
}

function EditClientModal({
  row,
  plans,
  loading,
  onClose,
  onSave,
}: {
  row: AdminRow;
  plans: Plan[];
  loading: boolean;
  onClose: () => void;
  onSave: (form: EditForm) => void;
}) {
  const [form, setForm] = useState<EditForm>({
    arena_id: row.arena.id,
    subscription_id: row.subscription?.id || null,
    arena_name: row.arena.name,
    arena_slug: row.arena.slug || "",
    owner_name: row.subscription?.customer_name || row.arena.name,
    owner_email: row.subscription?.customer_email || "",
    owner_whatsapp: row.subscription?.customer_phone || row.arena.whatsapp || "",
    owner_cpf_cnpj: row.subscription?.customer_cpf_cnpj || "",
    plan_key: ((row.subscription?.plan_key || "essential") as PlanKey),
    status: row.status === "trial_expired" ? "trialing" : row.status,
  });

  return (
    <Modal title="Editar cliente" subtitle="Atualize dados comerciais, plano e status sem quebrar o Asaas." onClose={onClose}>
      <div className="grid gap-4 md:grid-cols-2">
        <TextInput label="Responsável" value={form.owner_name} onChange={(value) => setForm({ ...form, owner_name: value })} />
        <TextInput label="E-mail" value={form.owner_email} onChange={(value) => setForm({ ...form, owner_email: value })} />
        <TextInput label="WhatsApp" value={form.owner_whatsapp} onChange={(value) => setForm({ ...form, owner_whatsapp: onlyDigits(value) })} />
        <TextInput label="CPF/CNPJ" value={form.owner_cpf_cnpj} onChange={(value) => setForm({ ...form, owner_cpf_cnpj: onlyDigits(value) })} />
        <TextInput label="Nome da arena" value={form.arena_name} onChange={(value) => setForm({ ...form, arena_name: value })} />
        <TextInput label="Slug" value={form.arena_slug} onChange={(value) => setForm({ ...form, arena_slug: slugify(value) })} />

        <label>
          <span className="text-sm font-black text-slate-800">Status</span>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">
            <option value="trialing">Trial</option>
            <option value="active">Ativo</option>
            <option value="overdue">Atrasado</option>
            <option value="blocked">Bloqueado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
      </div>

      <div className="mt-5">
        <PlanSelector value={form.plan_key} plans={plans} onChange={(plan_key) => setForm({ ...form, plan_key })} />
      </div>

      <button type="button" disabled={loading} onClick={() => onSave(form)} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white transition hover:bg-slate-800 disabled:opacity-60">
        {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
        Salvar alterações
      </button>
    </Modal>
  );
}

function DetailsDrawer({
  row,
  loading,
  onClose,
  onEdit,
  onDelete,
  onTrial,
  onActive,
  onBlocked,
}: {
  row: AdminRow;
  loading: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTrial: () => void;
  onActive: () => void;
  onBlocked: () => void;
}) {
  const wa = normalizePhone(row.subscription?.customer_phone || row.arena.whatsapp || "");

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <StatusBadge status={row.status} />
                <PlanBadge planKey={row.subscription?.plan_key || "essential"} />
              </div>
              <h2 className="text-2xl font-black">{row.arena.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{row.subscription?.customer_name || "Responsável não informado"}</p>
            </div>
            <button onClick={onClose} className="rounded-2xl border border-slate-200 p-3 text-slate-500 hover:border-red-400 hover:text-red-300">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <InfoGrid
            items={[
              ["E-mail", row.subscription?.customer_email || "-"],
              ["WhatsApp", wa ? `+${wa}` : "-"],
              ["CPF/CNPJ", row.subscription?.customer_cpf_cnpj || "-"],
              ["Slug", row.arena.slug || "-"],
              ["Mensalidade", `R$ ${formatMoney(row.subscription?.monthly_amount || row.plan?.monthly_price || 0)}`],
              ["Vencimento Asaas", row.subscription?.asaas_next_due_date ? formatDate(row.subscription.asaas_next_due_date) : "-"],
              ["Trial", row.trialDaysLeft === null ? "-" : row.trialDaysLeft < 0 ? "Expirado" : `${row.trialDaysLeft} dia(s)`],
              ["Asaas", row.subscription?.asaas_subscription_id || "Não conectado"],
            ]}
          />

          {row.arena.blocked_reason && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
              {row.arena.blocked_reason}
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-2">
            <button onClick={onEdit} className="rounded-2xl border border-slate-200 px-4 py-4 font-black text-slate-950 transition hover:border-slate-400">
              Editar cliente
            </button>
            <a href={wa ? `https://wa.me/${wa}` : "#"} target="_blank" rel="noreferrer" className="rounded-2xl bg-emerald-400 px-4 py-4 text-center font-black text-black">
              WhatsApp
            </a>
            <button disabled={loading.startsWith("edit:")} onClick={onTrial} className="rounded-2xl border border-yellow-400/20 bg-yellow-400/10 px-4 py-4 font-black text-yellow-200 disabled:opacity-60">
              Colocar em trial
            </button>
            <button disabled={loading.startsWith("edit:")} onClick={onActive} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-4 font-black text-emerald-200 disabled:opacity-60">
              Liberar ativo
            </button>
            <button disabled={loading.startsWith("edit:")} onClick={onBlocked} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 font-black text-red-200 disabled:opacity-60">
              Bloquear
            </button>
            <button disabled={loading.startsWith("delete:")} onClick={onDelete} className="rounded-2xl border border-red-500/20 px-4 py-4 font-black text-red-300 disabled:opacity-60">
              Excluir
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-black">Pagamentos recentes</h3>
            <div className="mt-3 space-y-2">
              {row.payments.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum pagamento registrado.</p>
              ) : (
                row.payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span>{translateStatus(payment.status || "pending")}</span>
                    <span className="font-black text-emerald-300">R$ {formatMoney(payment.value || 0)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl md:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black">{title}</h2>
            <p className="mt-2 text-sm font-medium text-slate-600">{subtitle}</p>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-slate-200 p-3 text-slate-500 hover:border-red-400 hover:text-red-300">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function PlanSelector({
  value,
  plans,
  onChange,
}: {
  value: PlanKey;
  plans: Plan[];
  onChange: (value: PlanKey) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-black text-slate-800">Plano</p>
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((plan) => {
          const active = value === plan.plan_key;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onChange(plan.plan_key as PlanKey)}
              className={
                active
                  ? "rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-left shadow-sm"
                  : "rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-400"
              }
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-black">{plan.name}</p>
                {plan.plan_key === "pro" ? <Crown size={18} className="text-emerald-300" /> : <ShieldCheck size={18} className="text-slate-500" />}
              </div>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
              <p className="mt-3 text-xl font-black text-emerald-300">R$ {formatMoney(plan.monthly_price)}/mês</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextInput({
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
    <label>
      <span className="text-sm font-black text-slate-800">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-4 text-slate-950 outline-none placeholder:text-slate-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  tone: "emerald" | "yellow" | "red" | "blue" | "violet" | "slate";
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1 bg-emerald-500/80" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 md:text-3xl">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{sub}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700">{icon}</div>
        </div>
      </div>
    </div>
  );
}

function ViewPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "shrink-0 rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-xs font-black text-white shadow-sm"
          : "shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
      }
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "trialing"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : status === "trial_expired" || status === "overdue" || status === "blocked"
          ? "bg-red-50 text-red-700 ring-red-200"
          : "bg-slate-100 text-slate-600 ring-slate-200";

  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ring-1 ${cls}`}>{translateStatus(status)}</span>;
}

function PlanBadge({ planKey }: { planKey: string }) {
  const pro = planKey === "pro";
  return <span className={pro ? "rounded-full bg-violet-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-violet-700 ring-1 ring-violet-200" : "rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-600 ring-1 ring-slate-200"}>{pro ? "Pro" : "Essencial"}</span>;
}

function MiniBadge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "yellow" }) {
  return <span className={tone === "yellow" ? "rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-black text-yellow-300" : "rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700"}>{children}</span>;
}

function SmallInfo({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-700">{value}</p>
    </div>
  );
}

function ActionLine({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-xs text-slate-600">{description}</p>
      </div>
      <p className="text-2xl font-black text-emerald-300">{value}</p>
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  async function copy() {
    await navigator.clipboard.writeText(value);
    alert("Copiado!");
  }

  return (
    <button type="button" onClick={copy} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-slate-400">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">{label}</p>
      <p className="mt-1 flex items-center justify-between gap-2 text-sm font-black text-slate-950">
        <span className="truncate">{value}</span>
        <Copy size={15} className="shrink-0 text-emerald-300" />
      </p>
    </button>
  );
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-600">{label}</p>
          <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
        </div>
      ))}
    </div>
  );
}

async function getSessionToken() {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token || "";
}

function getBusinessStatus(arena: Arena, subscription: Subscription | null, payments: Payment[]) {
  if (arena.subscription_status === "blocked" || subscription?.status === "blocked") return "blocked";

  const status = String(subscription?.status || "").toLowerCase();
  const lifecycle = String(subscription?.lifecycle_stage || "").toLowerCase();
  const asaas = String(subscription?.asaas_status || "").toUpperCase();

  if (status === "trial_expired" || lifecycle === "trial_expired") return "trial_expired";
  if (status === "overdue" || asaas === "OVERDUE") return "overdue";

  if (status === "trialing" || lifecycle === "trial") {
    if (subscription?.trial_ends_at && daysBetween(today, subscription.trial_ends_at.slice(0, 10)) < 0) return "trial_expired";
    return "trialing";
  }

  if (status === "active" || lifecycle === "active" || ["ACTIVE", "RECEIVED", "CONFIRMED"].includes(asaas)) return "active";
  if (payments.some((payment) => ["RECEIVED", "CONFIRMED"].includes(String(payment.status || "").toUpperCase()))) return "active";

  return "pending";
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    active: "Ativo",
    trialing: "Trial",
    trial_expired: "Trial expirado",
    pending: "Pendente",
    overdue: "Atrasado",
    blocked: "Bloqueado",
    cancelled: "Cancelado",
    RECEIVED: "Recebido",
    CONFIRMED: "Confirmado",
    PENDING: "Pendente",
    OVERDUE: "Atrasado",
  };

  return labels[status] || status || "Pendente";
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(phone: string) {
  const clean = onlyDigits(phone);
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function isValidCpfCnpj(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
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

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}


function initials(value: string) {
  return String(value || "AF")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

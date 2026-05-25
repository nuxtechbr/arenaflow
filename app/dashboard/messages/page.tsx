"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Filter,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wallet,
  Zap,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type MessageQueue = {
  id: string;
  arena_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  phone: string;
  message_type: string;
  message_body: string;
  status: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  error: string | null;
  related_type?: string | null;
  related_id?: string | null;
  dedupe_key?: string | null;
  metadata?: Record<string, any> | null;
  created_at: string;
};

type FilterType = "pending" | "trial" | "asaas" | "booking" | "monthly" | "sent" | "cancelled" | "all";

export default function DashboardMessagesPage() {
  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("pending");
  const [messages, setMessages] = useState<MessageQueue[]>([]);

  useEffect(() => {
    if (!arenaLoading && activeArenaId) loadMessages();
    if (!arenaLoading && !activeArenaId) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaLoading, activeArenaId]);

  const filteredMessages = useMemo(() => {
    const term = search.trim().toLowerCase();
    const numeric = search.replace(/\D/g, "");

    return messages.filter((message) => {
      const type = String(message.message_type || "");

      const matchesFilter =
        filter === "all" ||
        (filter === "pending" && message.status === "pending") ||
        (filter === "sent" && message.status === "sent") ||
        (filter === "cancelled" && message.status === "cancelled") ||
        (filter === "trial" && type.startsWith("trial_")) ||
        (filter === "asaas" && (type.startsWith("subscription_") || type.startsWith("asaas_"))) ||
        (filter === "booking" && type.startsWith("booking_")) ||
        (filter === "monthly" && type.startsWith("customer_invoice_"));

      if (!matchesFilter) return false;
      if (!term && !numeric) return true;

      return (
        String(message.customer_name || "").toLowerCase().includes(term) ||
        String(message.message_type || "").toLowerCase().includes(term) ||
        String(message.message_body || "").toLowerCase().includes(term) ||
        String(message.phone || "").includes(numeric)
      );
    });
  }, [messages, search, filter]);

  const metrics = useMemo(() => {
    return {
      pending: messages.filter((m) => m.status === "pending").length,
      trial: messages.filter((m) => String(m.message_type || "").startsWith("trial_") && m.status === "pending").length,
      asaas: messages.filter((m) => (String(m.message_type || "").startsWith("subscription_") || String(m.message_type || "").startsWith("asaas_")) && m.status === "pending").length,
      booking: messages.filter((m) => String(m.message_type || "").startsWith("booking_") && m.status === "pending").length,
      monthly: messages.filter((m) => String(m.message_type || "").startsWith("customer_invoice_") && m.status === "pending").length,
      sent: messages.filter((m) => m.status === "sent").length,
    };
  }, [messages]);

  async function loadMessages() {
    if (!activeArenaId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from("message_queue")
      .select("*")
      .eq("arena_id", activeArenaId)
      .order("created_at", { ascending: false })
      .limit(300);

    setLoading(false);

    if (error) return alert(error.message);

    setMessages((data || []) as MessageQueue[]);
  }

  async function copyMessage(message: MessageQueue) {
    await navigator.clipboard.writeText(message.message_body || "");
    alert("Mensagem copiada!");
  }

  function openWhatsapp(message: MessageQueue) {
    const phone = normalizePhone(message.phone);
    const text = message.message_body || "";

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function markAsSent(message: MessageQueue) {
    setSavingId(message.id);

    const { error } = await supabase
      .from("message_queue")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", message.id);

    setSavingId("");

    if (error) return alert(error.message);

    await loadMessages();
  }

  async function cancelMessage(message: MessageQueue) {
    const confirmed = window.confirm("Cancelar esta mensagem da fila?");
    if (!confirmed) return;

    setSavingId(message.id);

    const { error } = await supabase
      .from("message_queue")
      .update({
        status: "cancelled",
        error: null,
      })
      .eq("id", message.id);

    setSavingId("");

    if (error) return alert(error.message);

    await loadMessages();
  }

  async function runAutomations() {
    setSavingId("run");

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch("/api/admin/run-automations", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => null);

      setSavingId("");

      if (!response.ok) {
        alert(data?.error || "Erro ao executar automações.");
        return;
      }

      alert(`Automações executadas. Mensagens criadas: ${data?.messagesCreated || 0}`);
      await loadMessages();
    } catch {
      setSavingId("");
      alert("Erro ao executar automações.");
    }
  }

  if (arenaLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando mensagens...
        </div>
      </main>
    );
  }

  if (!activeArenaId) {
    return (
      <main className="space-y-6 text-white">
        <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-8">
          <h1 className="text-3xl font-black">Nenhuma arena selecionada</h1>
          <p className="mt-2 text-slate-400">Selecione uma arena para ver as mensagens.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-24 text-white md:pb-0">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />

          <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <MessageCircle size={16} />
                Fila de WhatsApp
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Mensagens
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400 md:text-base">
                Mensagens automáticas de trial, assinatura Asaas, reservas e mensalistas da {activeArenaInfo?.name || "arena"}.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={loadMessages}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
              >
                <RefreshCw size={18} />
                Atualizar
              </button>

              <button
                type="button"
                disabled={savingId === "run"}
                onClick={runAutomations}
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {savingId === "run" ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                Gerar automações
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard title="Pendentes" value={metrics.pending} description="aguardando envio" tone="yellow" icon={<Clock />} />
        <MetricCard title="Trial" value={metrics.trial} description="teste grátis" tone="purple" icon={<Sparkles />} />
        <MetricCard title="Asaas" value={metrics.asaas} description="assinatura" tone="emerald" icon={<Wallet />} />
        <MetricCard title="Reservas" value={metrics.booking} description="agenda" tone="blue" icon={<MessageCircle />} />
        <MetricCard title="Mensalistas" value={metrics.monthly} description="cobranças" tone="slate" icon={<AlertTriangle />} />
        <MetricCard title="Enviadas" value={metrics.sent} description="concluídas" tone="emerald" icon={<CheckCircle2 />} />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-4 md:p-5">
        <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip active={filter === "pending"} onClick={() => setFilter("pending")}>Pendentes</FilterChip>
            <FilterChip active={filter === "trial"} onClick={() => setFilter("trial")}>Trial</FilterChip>
            <FilterChip active={filter === "asaas"} onClick={() => setFilter("asaas")}>Asaas</FilterChip>
            <FilterChip active={filter === "booking"} onClick={() => setFilter("booking")}>Reservas</FilterChip>
            <FilterChip active={filter === "monthly"} onClick={() => setFilter("monthly")}>Mensalistas</FilterChip>
            <FilterChip active={filter === "sent"} onClick={() => setFilter("sent")}>Enviadas</FilterChip>
            <FilterChip active={filter === "cancelled"} onClick={() => setFilter("cancelled")}>Canceladas</FilterChip>
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Todas</FilterChip>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#07111B] px-4 py-3">
            <Search size={18} className="text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente, telefone, tipo ou mensagem..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500 xl:w-96"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredMessages.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 bg-[#0F172A] p-10 text-center">
            <Filter className="mx-auto text-slate-500" size={34} />
            <h2 className="mt-4 text-2xl font-black text-white">Nenhuma mensagem encontrada</h2>
            <p className="mt-2 text-slate-500">Quando houver mensagens nessa categoria, elas aparecerão aqui.</p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              saving={savingId === message.id}
              onCopy={() => copyMessage(message)}
              onWhatsapp={() => openWhatsapp(message)}
              onSent={() => markAsSent(message)}
              onCancel={() => cancelMessage(message)}
            />
          ))
        )}
      </section>
    </main>
  );
}

function MessageCard({
  message,
  saving,
  onCopy,
  onWhatsapp,
  onSent,
  onCancel,
}: {
  message: MessageQueue;
  saving: boolean;
  onCopy: () => void;
  onWhatsapp: () => void;
  onSent: () => void;
  onCancel: () => void;
}) {
  const pending = message.status === "pending";

  return (
    <article className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_340px] xl:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={message.message_type} />
            <StatusBadge status={message.status || "pending"} />
            {message.scheduled_at && (
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-black text-slate-400">
                {formatDateTime(message.scheduled_at)}
              </span>
            )}
          </div>

          <h2 className="mt-3 text-2xl font-black">
            {message.customer_name || "Cliente"}
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            WhatsApp: +{normalizePhone(message.phone)}
          </p>

          <div className="mt-4 whitespace-pre-wrap rounded-3xl border border-white/10 bg-[#07111B] p-4 text-sm leading-relaxed text-slate-200">
            {message.message_body}
          </div>

          {message.error && (
            <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {message.error}
            </div>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <button
            type="button"
            onClick={onWhatsapp}
            className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 font-black text-black transition hover:bg-emerald-400"
          >
            <MessageCircle size={18} />
            Abrir WhatsApp
          </button>

          <button
            type="button"
            onClick={onCopy}
            className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-4 font-black text-white transition hover:border-emerald-400"
          >
            <Copy size={18} />
            Copiar texto
          </button>

          {pending && (
            <button
              type="button"
              disabled={saving}
              onClick={onSent}
              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4 font-black text-emerald-300 disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              Marcar enviada
            </button>
          )}

          {pending && (
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-4 font-black text-red-300 disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              Cancelar
            </button>
          )}
        </div>
      </div>
    </article>
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
  tone: "emerald" | "blue" | "yellow" | "purple" | "slate";
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : tone === "blue"
        ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
        : tone === "yellow"
          ? "border-yellow-500/20 bg-yellow-500/10 text-yellow-300"
          : tone === "purple"
            ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
            : "border-white/10 bg-[#0F172A] text-slate-300";

  return (
    <div className={`rounded-[2rem] border p-5 ${cls}`}>
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "shrink-0 rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-black"
          : "shrink-0 rounded-full border border-white/10 px-4 py-2 text-xs font-black text-slate-300 transition hover:border-emerald-400"
      }
    >
      {children}
    </button>
  );
}

function TypeBadge({ type }: { type: string }) {
  const category = getMessageCategory(type);

  const cls =
    category === "trial"
      ? "bg-violet-500/10 text-violet-300"
      : category === "asaas"
        ? "bg-emerald-500/10 text-emerald-300"
        : category === "booking"
          ? "bg-blue-500/10 text-blue-300"
          : category === "monthly"
            ? "bg-yellow-500/10 text-yellow-300"
            : "bg-slate-500/10 text-slate-300";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{translateMessageType(type)}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "").toLowerCase();

  const cls =
    normalized === "sent"
      ? "bg-emerald-500/10 text-emerald-300"
      : normalized === "cancelled"
        ? "bg-red-500/10 text-red-300"
        : "bg-yellow-500/10 text-yellow-300";

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${cls}`}>{translateStatus(status)}</span>;
}

function getMessageCategory(type: string) {
  if (type.startsWith("trial_")) return "trial";
  if (type.startsWith("subscription_") || type.startsWith("asaas_")) return "asaas";
  if (type.startsWith("booking_")) return "booking";
  if (type.startsWith("customer_invoice_")) return "monthly";
  return "other";
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    sent: "Enviada",
    cancelled: "Cancelada",
    error: "Erro",
  };

  return labels[String(status || "").toLowerCase()] || status || "Pendente";
}

function translateMessageType(type: string) {
  const labels: Record<string, string> = {
    trial_ending_tomorrow: "Trial termina amanhã",
    trial_ending_today: "Trial termina hoje",
    trial_expired: "Trial expirado",
    subscription_due_soon: "Assinatura vencendo",
    subscription_due_today: "Assinatura vence hoje",
    subscription_overdue: "Assinatura atrasada",
    subscription_blocked: "Assinatura bloqueada",
    asaas_payment_received: "Pagamento recebido",
    booking_reminder_tomorrow: "Reserva amanhã",
    booking_reminder_today: "Reserva hoje",
    booking_deposit_pending: "Sinal pendente",
    customer_invoice_due_soon: "Mensalista vencendo",
    customer_invoice_due_today: "Mensalista vence hoje",
    customer_invoice_overdue: "Mensalista atrasado",
  };

  return labels[type] || type;
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function formatDateTime(date: string) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR");
}

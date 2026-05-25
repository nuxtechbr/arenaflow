"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  Play,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type QueueStatus = "pending" | "sent" | "failed" | "cancelled";

type MessageQueue = {
  id: string;
  arena_id: string | null;
  phone: string | null;
  message_type: string | null;
  message_body: string | null;
  status: QueueStatus | string | null;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  arena?: {
    name: string | null;
    slug: string | null;
  } | null;
};

type AutomationLog = {
  id: string;
  arena_id: string | null;
  automation_type: string | null;
  status: string | null;
  message: string | null;
  created_at: string;
  arena?: {
    name: string | null;
  } | null;
};

type FilterStatus = "all" | "pending" | "sent" | "failed" | "cancelled";

export default function AdminAutomationsPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [queue, setQueue] = useState<MessageQueue[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [lastRun, setLastRun] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const metrics = useMemo(() => {
    const pending = queue.filter((item) => item.status === "pending").length;
    const sent = queue.filter((item) => item.status === "sent").length;
    const failed = queue.filter((item) => item.status === "failed").length;
    const cancelled = queue.filter((item) => item.status === "cancelled").length;

    return {
      total: queue.length,
      pending,
      sent,
      failed,
      cancelled,
      successRate: queue.length ? Math.round((sent / queue.length) * 100) : 0,
    };
  }, [queue]);

  const filteredQueue = useMemo(() => {
    const term = search.trim().toLowerCase();
    const numeric = onlyDigits(search);

    return queue.filter((item) => {
      const matchStatus = status === "all" || item.status === status;

      if (!matchStatus) return false;
      if (!term && !numeric) return true;

      return (
        String(item.arena?.name || "").toLowerCase().includes(term) ||
        String(item.phone || "").includes(numeric) ||
        String(item.message_type || "").toLowerCase().includes(term) ||
        String(item.message_body || "").toLowerCase().includes(term)
      );
    });
  }, [queue, search, status]);

  async function loadData() {
    setLoading(true);

    const [queueRes, logsRes] = await Promise.all([
      supabase
        .from("message_queue")
        .select("*, arena:arenas(name, slug)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("automation_logs")
        .select("*, arena:arenas(name)")
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    setLoading(false);

    if (queueRes.error) return alert(queueRes.error.message);
    if (logsRes.error) return alert(logsRes.error.message);

    setQueue((queueRes.data || []) as MessageQueue[]);
    setLogs((logsRes.data || []) as AutomationLog[]);
  }

  async function runAutomations() {
    const confirmed = window.confirm("Executar automações agora? Isso pode gerar mensagens na fila.");

    if (!confirmed) return;

    setRunning(true);

    try {
      const token = await getSessionToken();

      const response = await fetch("/api/admin/run-automations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await response.json().catch(() => null);

      setRunning(false);

      if (!response.ok) {
        return alert(data?.error || "Erro ao executar automações.");
      }

      setLastRun(data);
      await loadData();
    } catch {
      setRunning(false);
      alert("Erro ao executar automações.");
    }
  }

  async function updateMessageStatus(item: MessageQueue, nextStatus: QueueStatus) {
    const { error } = await supabase
      .from("message_queue")
      .update({
        status: nextStatus,
        sent_at: nextStatus === "sent" ? new Date().toISOString() : item.sent_at,
      })
      .eq("id", item.id);

    if (error) return alert(error.message);

    await loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F7FB] text-slate-950">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
            <Loader2 className="animate-spin text-emerald-600" />
            Carregando automações...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F7FB] text-slate-950">
      <div className="mx-auto max-w-[1640px] space-y-4 p-4 md:p-6">
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
                      <Bot size={13} />
                      Backoffice SaaS
                    </div>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                      Automações
                    </h1>
                  </div>
                </div>
                <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
                  Controle a fila de mensagens, lembretes de trial, mensalidades, reservas e notificações operacionais.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-slate-950"
                >
                  <ArrowLeft size={17} />
                  Voltar
                </Link>
                <button
                  type="button"
                  onClick={loadData}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-300 hover:text-slate-950"
                >
                  <RefreshCw size={17} />
                  Atualizar
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={runAutomations}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {running ? <Loader2 size={17} className="animate-spin" /> : <Play size={17} />}
                  Executar agora
                </button>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Fila total" value={metrics.total} sub="mensagens registradas" icon={<MessageCircle />} />
          <MetricCard label="Pendentes" value={metrics.pending} sub="aguardando envio" icon={<Clock3 />} warn={metrics.pending > 0} />
          <MetricCard label="Enviadas" value={metrics.sent} sub={`${metrics.successRate}% da fila`} icon={<CheckCircle2 />} />
          <MetricCard label="Falhas" value={metrics.failed} sub="precisam revisão" icon={<XCircle />} danger={metrics.failed > 0} />
          <MetricCard label="Canceladas" value={metrics.cancelled} sub="não serão enviadas" icon={<AlertTriangle />} />
          <MetricCard label="Logs" value={logs.length} sub="últimas execuções" icon={<Sparkles />} />
        </section>

        {lastRun && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-black text-emerald-950">Execução concluída</h2>
                <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                  As automações foram processadas. Confira a fila abaixo para validar mensagens pendentes, enviadas ou com erro.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <ViewPill active={status === "all"} onClick={() => setStatus("all")}>Todas</ViewPill>
              <ViewPill active={status === "pending"} onClick={() => setStatus("pending")}>Pendentes</ViewPill>
              <ViewPill active={status === "sent"} onClick={() => setStatus("sent")}>Enviadas</ViewPill>
              <ViewPill active={status === "failed"} onClick={() => setStatus("failed")}>Falhas</ViewPill>
              <ViewPill active={status === "cancelled"} onClick={() => setStatus("cancelled")}>Canceladas</ViewPill>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search size={18} className="text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar arena, telefone, tipo ou mensagem..."
                className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 bg-gradient-to-r from-white to-emerald-50/40 px-5 py-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-950">Fila de mensagens</h2>
                <p className="mt-1 text-sm text-slate-600">{filteredQueue.length} mensagem(ns) nesta visão.</p>
              </div>
              <p className="text-xs font-bold text-slate-500">
                Marque como enviada apenas depois de confirmar o disparo no WhatsApp.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredQueue.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">Nenhuma mensagem encontrada.</div>
              ) : (
                filteredQueue.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    onSent={() => updateMessageStatus(item, "sent")}
                    onCancel={() => updateMessageStatus(item, "cancelled")}
                    onRetry={() => updateMessageStatus(item, "pending")}
                  />
                ))
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Logs recentes</h2>
              <div className="mt-4 space-y-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum log registrado.</p>
                ) : (
                  logs.slice(0, 12).map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-slate-950">{translateType(log.automation_type || "automação")}</p>
                          <p className="mt-1 text-xs text-slate-500">{log.arena?.name || "Arena não vinculada"}</p>
                        </div>
                        <StatusBadge status={log.status || "pending"} />
                      </div>
                      {log.message && <p className="mt-2 text-xs leading-relaxed text-slate-600">{log.message}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black text-slate-950">Tipos processados</h2>
              <div className="mt-4 grid gap-2">
                <AutomationType title="Trial vencendo" description="Avisa cliente que o teste está acabando." />
                <AutomationType title="Trial expirado" description="Marca trial expirado e gera alerta." />
                <AutomationType title="Mensalidade" description="Lembretes de vencimento e atraso." />
                <AutomationType title="Reservas" description="Confirmações e lembretes operacionais." />
                <AutomationType title="Mensalistas" description="Mensagens para clientes recorrentes." />
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function QueueRow({
  item,
  onSent,
  onCancel,
  onRetry,
}: {
  item: MessageQueue;
  onSent: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const phone = normalizePhone(item.phone || "");

  return (
    <div className="grid gap-4 border-l-4 border-transparent px-5 py-4 transition hover:border-emerald-500 hover:bg-slate-50 xl:grid-cols-[1fr_130px_150px_170px] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-black text-slate-950">{item.arena?.name || "Arena não vinculada"}</p>
          <StatusBadge status={item.status || "pending"} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600 ring-1 ring-slate-200">
            {translateType(item.message_type || "mensagem")}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">{phone ? `+${phone}` : "telefone não informado"}</p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">{item.message_body || "Mensagem vazia."}</p>
        {item.error_message && <p className="mt-2 text-xs font-bold text-red-600">{item.error_message}</p>}
      </div>

      <div className="text-sm font-black text-slate-700">
        {formatDateTime(item.created_at)}
        <p className="mt-1 text-xs font-bold text-slate-400">Criada em</p>
      </div>

      <div className="text-sm font-black text-slate-700">
        {item.sent_at ? formatDateTime(item.sent_at) : "-"}
        <p className="mt-1 text-xs font-bold text-slate-400">Enviada em</p>
      </div>

      <div className="flex items-center justify-end gap-2">
        {phone && (
          <a
            href={`https://wa.me/${phone}?text=${encodeURIComponent(item.message_body || "")}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
            title="Abrir WhatsApp"
          >
            <MessageCircle size={17} />
          </a>
        )}
        <button onClick={onSent} className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-700 transition hover:bg-emerald-50" title="Marcar enviada">
          <Send size={17} />
        </button>
        <button onClick={onRetry} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50" title="Voltar para pendente">
          <RefreshCw size={17} />
        </button>
        <button onClick={onCancel} className="rounded-lg border border-red-200 bg-white p-2 text-red-500 transition hover:bg-red-50" title="Cancelar">
          <XCircle size={17} />
        </button>
      </div>
    </div>
  );
}

function AutomationType({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  warn = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={danger ? "h-1 bg-red-500" : warn ? "h-1 bg-amber-500" : "h-1 bg-emerald-500/80"} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-950 md:text-3xl">{value}</p>
            <p className={danger ? "mt-1 text-xs font-bold text-red-600" : warn ? "mt-1 text-xs font-bold text-amber-600" : "mt-1 text-xs font-semibold text-slate-500"}>{sub}</p>
          </div>
          <div className={danger ? "rounded-xl bg-red-50 p-3 text-red-600" : warn ? "rounded-xl bg-amber-50 p-3 text-amber-600" : "rounded-xl bg-emerald-50 p-3 text-emerald-700"}>{icon}</div>
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
          ? "shrink-0 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white"
          : "shrink-0 rounded-full border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
      }
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = String(status || "pending").toLowerCase();

  const cls =
    normalized === "sent" || normalized === "success" || normalized === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : normalized === "pending"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : normalized === "failed" || normalized === "error"
          ? "bg-red-50 text-red-700 ring-red-200"
          : normalized === "cancelled"
            ? "bg-slate-100 text-slate-600 ring-slate-200"
            : "bg-slate-100 text-slate-600 ring-slate-200";

  return <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ring-1 ${cls}`}>{translateStatus(normalized)}</span>;
}

async function getSessionToken() {
  const session = await supabase.auth.getSession();
  return session.data.session?.access_token || "";
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    all: "Todas",
    pending: "Pendente",
    sent: "Enviada",
    failed: "Falhou",
    error: "Erro",
    cancelled: "Cancelada",
    success: "Sucesso",
    ok: "OK",
  };

  return labels[status] || status || "Pendente";
}

function translateType(type: string) {
  const value = String(type || "").toLowerCase();

  const labels: Record<string, string> = {
    trial_ending: "Trial vencendo",
    trial_expired: "Trial expirado",
    subscription_due: "Mensalidade",
    subscription_overdue: "Mensalidade atrasada",
    booking_reminder: "Reserva",
    monthly_customer: "Mensalista",
    message: "Mensagem",
  };

  return labels[value] || type;
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(phone: string) {
  const clean = onlyDigits(phone);
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function formatDateTime(date: string | null) {
  if (!date) return "-";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  } catch {
    return "-";
  }
}

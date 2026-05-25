"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type FieldRelation = { name: string } | { name: string }[] | null | undefined;

type Customer = {
  id: string;
  arena_id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  created_at: string;
};

type Booking = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_whatsapp?: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  status: string;
  fields?: FieldRelation;
};

type RecurringBooking = {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_whatsapp?: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  status: string;
  monthly_amount?: number | null;
  fields?: FieldRelation;
};

type CustomerStats = {
  totalBookings: number;
  totalSpent: number;
  lastBooking: string;
  recurringCount: number;
};

const today = new Date().toISOString().slice(0, 10);
const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CustomersPage() {
  const { activeArenaId, loading: arenaLoading } = useActiveArena();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recurringBookings, setRecurringBookings] = useState<RecurringBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
  });

  useEffect(() => {
    if (!arenaLoading && activeArenaId) loadData();
    if (!arenaLoading && !activeArenaId) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaLoading, activeArenaId]);

  const statsByCustomer = useMemo(() => {
    const map: Record<string, CustomerStats> = {};

    for (const customer of customers) {
      const cleanPhone = normalizePhone(customer.whatsapp);

      const customerBookings = bookings.filter((booking) => {
        if (booking.customer_id && booking.customer_id === customer.id) return true;
        return normalizePhone(booking.customer_whatsapp || "") === cleanPhone;
      });

      const customerRecurring = recurringBookings.filter((booking) => {
        if (booking.customer_id && booking.customer_id === customer.id) return true;
        return normalizePhone(booking.customer_whatsapp || "") === cleanPhone;
      });

      const totalSpent = customerBookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0);
      const sorted = [...customerBookings].sort((a, b) => b.booking_date.localeCompare(a.booking_date));

      map[customer.id] = {
        totalBookings: customerBookings.length,
        totalSpent,
        lastBooking: sorted[0]?.booking_date || "",
        recurringCount: customerRecurring.length,
      };
    }

    return map;
  }, [customers, bookings, recurringBookings]);

  const filteredCustomers = useMemo(() => {
    const textSearch = search.toLowerCase().trim();
    const numberSearch = search.replace(/\D/g, "");

    return customers.filter((customer) => {
      if (!textSearch && !numberSearch) return true;

      const nameMatch = customer.name.toLowerCase().includes(textSearch);
      const emailMatch = String(customer.email || "").toLowerCase().includes(textSearch);
      const whatsappMatch = numberSearch ? normalizePhone(customer.whatsapp).includes(numberSearch) : false;

      return nameMatch || whatsappMatch || emailMatch;
    });
  }, [customers, search]);

  const vipCustomers = useMemo(() => {
    return customers
      .filter((customer) => (statsByCustomer[customer.id]?.totalBookings || 0) >= 3 || (statsByCustomer[customer.id]?.recurringCount || 0) > 0)
      .length;
  }, [customers, statsByCustomer]);

  const activeRecurringCustomers = useMemo(() => {
    const phones = new Set<string>();

    for (const booking of recurringBookings) {
      if (booking.status === "active" && booking.customer_whatsapp) {
        phones.add(normalizePhone(booking.customer_whatsapp));
      }
    }

    return phones.size;
  }, [recurringBookings]);

  async function loadData() {
    if (!activeArenaId) return;

    setLoading(true);

    const [customersRes, bookingsRes, recurringRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, arena_id, name, whatsapp, email, created_at")
        .eq("arena_id", activeArenaId)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("id, customer_id, customer_name, customer_whatsapp, booking_date, start_time, end_time, amount, status, fields(name)")
        .eq("arena_id", activeArenaId)
        .neq("status", "cancelada")
        .order("booking_date", { ascending: false })
        .limit(500),
      supabase
        .from("recurring_bookings")
        .select("id, customer_id, customer_name, customer_whatsapp, weekday, start_time, end_time, status, monthly_amount, fields(name)")
        .eq("arena_id", activeArenaId)
        .order("customer_name", { ascending: true }),
    ]);

    setLoading(false);

    if (customersRes.error) return alert(customersRes.error.message);
    if (bookingsRes.error) return alert(bookingsRes.error.message);
    if (recurringRes.error) return alert(recurringRes.error.message);

    setCustomers((customersRes.data || []) as Customer[]);
    setBookings((bookingsRes.data || []) as Booking[]);
    setRecurringBookings((recurringRes.data || []) as RecurringBooking[]);
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name,
      whatsapp: normalizePhone(customer.whatsapp).replace(/^55/, ""),
      email: customer.email || "",
    });
  }

  async function saveEdit(customerId: string) {
    if (!editForm.name.trim()) return alert("Informe o nome do cliente.");
    if (editForm.whatsapp.replace(/\D/g, "").length < 10) return alert("Informe um WhatsApp válido.");

    setSavingId(customerId);

    const fullWhatsapp = normalizePhone(editForm.whatsapp);

    const { error } = await supabase
      .from("customers")
      .update({
        name: editForm.name.trim(),
        whatsapp: fullWhatsapp,
        email: editForm.email.trim() || null,
      })
      .eq("id", customerId);

    setSavingId("");

    if (error) return alert(error.message);

    setEditingId("");
    await loadData();
  }

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(`Deseja remover ${customer.name}? As reservas antigas continuam registradas.`);
    if (!confirmed) return;

    setSavingId(customer.id);

    const { error } = await supabase.from("customers").delete().eq("id", customer.id);

    setSavingId("");

    if (error) return alert(error.message);

    if (selectedCustomer?.id === customer.id) setSelectedCustomer(null);
    await loadData();
  }

  async function copyPhone(customer: Customer) {
    await navigator.clipboard.writeText(`+${normalizePhone(customer.whatsapp)}`);
    alert("WhatsApp copiado!");
  }

  function openWhatsapp(customer: Customer) {
    const phone = normalizePhone(customer.whatsapp);
    if (!phone) return alert("Cliente sem WhatsApp.");

    const message = `Olá, ${customer.name}! Tudo bem? Aqui é da arena.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function customerBookings(customer: Customer) {
    const phone = normalizePhone(customer.whatsapp);

    return bookings.filter((booking) => {
      if (booking.customer_id && booking.customer_id === customer.id) return true;
      return normalizePhone(booking.customer_whatsapp || "") === phone;
    });
  }

  function customerRecurring(customer: Customer) {
    const phone = normalizePhone(customer.whatsapp);

    return recurringBookings.filter((booking) => {
      if (booking.customer_id && booking.customer_id === customer.id) return true;
      return normalizePhone(booking.customer_whatsapp || "") === phone;
    });
  }

  if (arenaLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando clientes...
        </div>
      </main>
    );
  }

  if (!activeArenaId) {
    return (
      <main className="min-h-screen text-white">
        <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-8">
          <h1 className="text-3xl font-black">Nenhuma arena selecionada</h1>
          <p className="mt-2 text-slate-400">Selecione uma arena para ver os clientes.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-24 text-white md:pb-0">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <Users size={16} />
                CRM da arena
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-5xl">Clientes</h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
                Base profissional de clientes, histórico de reservas, mensalistas, WhatsApp e relacionamento.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400"
            >
              <RefreshCw size={18} />
              Atualizar
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Clientes" value={customers.length} description="base cadastrada" tone="emerald" />
        <MetricCard title="Clientes VIP" value={vipCustomers} description="3+ reservas ou mensalista" tone="blue" />
        <MetricCard title="Mensalistas" value={activeRecurringCustomers} description="recorrentes ativos" tone="purple" />
        <MetricCard title="Reservas" value={bookings.length} description="histórico carregado" tone="yellow" />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-4 md:p-5">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#07111B] px-4 py-3">
          <Search size={18} className="text-slate-500" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome, WhatsApp ou e-mail..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div className="space-y-3">
          {filteredCustomers.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-[#0F172A] p-10 text-center">
              <Users className="mx-auto text-slate-600" size={42} />
              <h2 className="mt-4 text-2xl font-black">Nenhum cliente encontrado</h2>
              <p className="mt-2 text-sm text-slate-400">Clientes aparecem automaticamente quando reservas são criadas.</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                stats={statsByCustomer[customer.id]}
                editing={editingId === customer.id}
                editForm={editForm}
                setEditForm={setEditForm}
                saving={savingId === customer.id}
                onEdit={() => startEdit(customer)}
                onCancelEdit={() => setEditingId("")}
                onSave={() => saveEdit(customer.id)}
                onDelete={() => deleteCustomer(customer)}
                onWhatsapp={() => openWhatsapp(customer)}
                onCopy={() => copyPhone(customer)}
                onSelect={() => setSelectedCustomer(customer)}
              />
            ))
          )}
        </div>

        <aside className="xl:sticky xl:top-6 xl:h-fit">
          {selectedCustomer ? (
            <CustomerDetails
              customer={selectedCustomer}
              bookings={customerBookings(selectedCustomer)}
              recurring={customerRecurring(selectedCustomer)}
              onClose={() => setSelectedCustomer(null)}
              onWhatsapp={() => openWhatsapp(selectedCustomer)}
            />
          ) : (
            <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <UserRound size={28} />
              </div>

              <h2 className="mt-4 text-2xl font-black">Perfil do cliente</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Clique em um cliente para ver histórico de reservas, mensalistas e ações rápidas.
              </p>

              <div className="mt-5 rounded-3xl border border-white/10 bg-[#07111B] p-4">
                <p className="text-sm font-black text-white">Dica comercial</p>
                <p className="mt-1 text-sm text-slate-400">
                  Use clientes VIP para vender horários fixos, pacotes e campanhas no WhatsApp.
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function CustomerCard({
  customer,
  stats,
  editing,
  editForm,
  setEditForm,
  saving,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onWhatsapp,
  onCopy,
  onSelect,
}: {
  customer: Customer;
  stats?: CustomerStats;
  editing: boolean;
  editForm: { name: string; whatsapp: string; email: string };
  setEditForm: (form: { name: string; whatsapp: string; email: string }) => void;
  saving: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onWhatsapp: () => void;
  onCopy: () => void;
  onSelect: () => void;
}) {
  const vip = Boolean((stats?.totalBookings || 0) >= 3 || (stats?.recurringCount || 0) > 0);

  return (
    <article className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 shadow-xl shadow-black/10">
      {editing ? (
        <div className="grid gap-3 md:grid-cols-3">
          <InputBox
            label="Nome"
            value={editForm.name}
            onChange={(value) => setEditForm({ ...editForm, name: value })}
          />
          <InputBox
            label="WhatsApp"
            value={editForm.whatsapp}
            onChange={(value) => setEditForm({ ...editForm, whatsapp: value.replace(/\D/g, "") })}
          />
          <InputBox
            label="E-mail"
            value={editForm.email}
            onChange={(value) => setEditForm({ ...editForm, email: value })}
          />

          <div className="flex flex-wrap gap-2 md:col-span-3">
            <button
              type="button"
              disabled={saving}
              onClick={onSave}
              className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Salvar
            </button>

            <button
              type="button"
              onClick={onCancelEdit}
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 font-black text-white"
            >
              <X size={18} />
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-white">{customer.name}</h2>
              {vip && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
                  <Star size={13} fill="currentColor" />
                  VIP
                </span>
              )}
              {(stats?.recurringCount || 0) > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                  Mensalista
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-400">
              <span>+{normalizePhone(customer.whatsapp)}</span>
              {customer.email && <span>{customer.email}</span>}
              <span>Cliente desde {formatDate(customer.created_at.slice(0, 10))}</span>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <SmallStat label="Reservas" value={stats?.totalBookings || 0} />
              <SmallStat label="Total gasto" value={`R$ ${formatMoney(stats?.totalSpent || 0)}`} />
              <SmallStat label="Última reserva" value={stats?.lastBooking ? formatDate(stats.lastBooking) : "-"} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex lg:flex-col xl:w-44">
            <button
              type="button"
              onClick={onWhatsapp}
              className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black"
            >
              <MessageCircle size={18} />
              WhatsApp
            </button>

            <button
              type="button"
              onClick={onSelect}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 font-black text-white hover:border-emerald-400"
            >
              <ExternalLink size={18} />
              Perfil
            </button>

            <button
              type="button"
              onClick={onCopy}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 font-black text-white hover:border-emerald-400"
            >
              <Copy size={18} />
              Copiar
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3 py-3 text-blue-300"
                aria-label="Editar cliente"
              >
                <Edit3 size={18} />
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={onDelete}
                className="flex items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-red-300 disabled:opacity-60"
                aria-label="Remover cliente"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function CustomerDetails({
  customer,
  bookings,
  recurring,
  onClose,
  onWhatsapp,
}: {
  customer: Customer;
  bookings: Booking[];
  recurring: RecurringBooking[];
  onClose: () => void;
  onWhatsapp: () => void;
}) {
  const totalSpent = bookings.reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

  return (
    <aside className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <UserRound size={28} />
          </div>

          <h2 className="mt-4 text-2xl font-black">{customer.name}</h2>
          <p className="mt-1 text-sm font-bold text-emerald-300">+{normalizePhone(customer.whatsapp)}</p>
          {customer.email && <p className="mt-1 text-sm text-slate-400">{customer.email}</p>}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-2xl border border-white/10 p-3 text-slate-400 hover:border-red-400 hover:text-red-300"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <SmallStat label="Reservas" value={bookings.length} />
        <SmallStat label="Total gasto" value={`R$ ${formatMoney(totalSpent)}`} />
        <SmallStat label="Fixas" value={recurring.length} />
        <SmallStat label="Cadastro" value={formatDate(customer.created_at.slice(0, 10))} />
      </div>

      <button
        type="button"
        onClick={onWhatsapp}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black"
      >
        <MessageCircle size={18} />
        Chamar no WhatsApp
      </button>

      {recurring.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-3 font-black text-white">Reservas fixas</h3>
          <div className="space-y-2">
            {recurring.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-[#07111B] p-3">
                <p className="font-black text-white">{getFieldName(item.fields)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {weekDays[item.weekday]} • {item.start_time.slice(0, 5)} às {item.end_time.slice(0, 5)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5">
        <h3 className="mb-3 font-black text-white">Últimas reservas</h3>
        <div className="space-y-2">
          {bookings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">
              Sem reservas avulsas.
            </div>
          ) : (
            bookings.slice(0, 6).map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-white/10 bg-[#07111B] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-white">{formatDate(booking.booking_date)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {getFieldName(booking.fields)} • {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                    R$ {formatMoney(booking.amount)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function MetricCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string | number;
  description: string;
  tone: "emerald" | "blue" | "purple" | "yellow";
}) {
  const color =
    tone === "emerald"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : tone === "blue"
        ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
        : tone === "purple"
          ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
          : "border-yellow-500/20 bg-yellow-500/10 text-yellow-300";

  return (
    <div className={`rounded-[2rem] border p-5 ${color}`}>
      <p className="text-sm font-bold opacity-80">{title}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
      <p className="mt-2 text-xs font-bold opacity-70">{description}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#07111B] p-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function InputBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07111B] p-4 text-white outline-none focus:border-emerald-400"
      />
    </label>
  );
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function getFieldName(fields: FieldRelation) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  if (!date) return "-";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

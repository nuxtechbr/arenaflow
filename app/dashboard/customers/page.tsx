"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit, Save, Trash2, X } from "lucide-react";
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
  weekday: number;
  start_time: string;
  end_time: string;
  status: string;
  fields?: FieldRelation;
};

export default function CustomersPage() {
  const { activeArenaId } = useActiveArena();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recurringBookings, setRecurringBookings] = useState<RecurringBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    whatsapp: "",
    email: "",
  });

  useEffect(() => {
    if (activeArenaId) {
      loadData();
    }
  }, [activeArenaId]);

  const filteredCustomers = useMemo(() => {
    const textSearch = search.toLowerCase().trim();
    const numberSearch = search.replace(/\D/g, "");

    return customers.filter((customer) => {
      const nameMatch = customer.name.toLowerCase().includes(textSearch);
      const whatsappMatch = numberSearch
        ? customer.whatsapp.includes(numberSearch)
        : false;

      return nameMatch || whatsappMatch;
    });
  }, [customers, search]);

  async function loadData() {
    setLoading(true);

    if (!activeArenaId) {
      setLoading(false);
      return;
    }

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("*")
      .eq("arena_id", activeArenaId)
      .order("created_at", { ascending: false });

    if (customersError) {
      setLoading(false);
      alert(customersError.message);
      return;
    }

    setCustomers((customersData || []) as Customer[]);

    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, customer_name, booking_date, start_time, end_time, amount, status, fields(name)"
      )
      .eq("arena_id", activeArenaId)
      .order("booking_date", { ascending: false });

    if (bookingsError) {
      setLoading(false);
      alert(bookingsError.message);
      return;
    }

    setBookings((bookingsData || []) as Booking[]);

    const { data: recurringData, error: recurringError } = await supabase
      .from("recurring_bookings")
      .select(
        "id, customer_id, customer_name, weekday, start_time, end_time, status, fields(name)"
      )
      .eq("arena_id", activeArenaId);

    if (recurringError) {
      setLoading(false);
      alert(recurringError.message);
      return;
    }

    setRecurringBookings((recurringData || []) as RecurringBooking[]);
    setLoading(false);
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.id);
    setEditForm({
      name: customer.name,
      whatsapp: customer.whatsapp.replace(/^55/, ""),
      email: customer.email || "",
    });
  }

  async function saveCustomer(customerId: string) {
    if (!editForm.name.trim()) {
      alert("Informe o nome do cliente.");
      return;
    }

    if (!editForm.whatsapp.trim()) {
      alert("Informe o WhatsApp do cliente.");
      return;
    }

    const fullWhatsapp = editForm.whatsapp.startsWith("55")
      ? editForm.whatsapp
      : `55${editForm.whatsapp}`;

    const { error } = await supabase
      .from("customers")
      .update({
        name: editForm.name.trim(),
        whatsapp: fullWhatsapp,
        email: editForm.email.trim() || null,
      })
      .eq("id", customerId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingId("");
    await loadData();
  }

  async function deleteCustomer(customerId: string) {
    const customerBookings = bookings.filter(
      (booking) => booking.customer_id === customerId
    );

    const fixedBookings = recurringBookings.filter(
      (booking) => booking.customer_id === customerId && booking.status === "active"
    );

    if (customerBookings.length > 0 || fixedBookings.length > 0) {
      alert(
        "Esse cliente possui reservas vinculadas. Cancele ou edite as reservas antes de excluir."
      );
      return;
    }

    if (!confirm("Deseja excluir este cliente?")) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);

    if (error) {
      alert(error.message);
      return;
    }

    setCustomers((current) =>
      current.filter((customer) => customer.id !== customerId)
    );
  }

  if (loading) {
    return <p className="text-white">Carregando clientes...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-emerald-400">
          Gestão da arena
        </p>
        <h1 className="mt-1 text-4xl font-bold text-white">Clientes</h1>
        <p className="mt-2 max-w-2xl text-slate-400">
          Consulte, edite e acompanhe clientes cadastrados pelas reservas.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-[#111827] p-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nome ou WhatsApp"
          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400"
        />
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-[#111827] p-8 text-center">
          <h2 className="text-2xl font-bold text-white">
            Nenhum cliente encontrado
          </h2>
          <p className="mt-2 text-slate-400">
            Os clientes aparecem aqui quando uma reserva é criada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {filteredCustomers.map((customer) => {
            const customerBookings = bookings.filter(
              (booking) => booking.customer_id === customer.id
            );

            const customerRecurring = recurringBookings.filter(
              (booking) =>
                booking.customer_id === customer.id && booking.status === "active"
            );

            const isEditing = editingId === customer.id;

            return (
              <div
                key={customer.id}
                className="rounded-3xl border border-slate-800 bg-[#111827] p-5"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <Input
                      label="Nome"
                      value={editForm.name}
                      onChange={(value) =>
                        setEditForm({ ...editForm, name: value })
                      }
                    />

                    <WhatsappInput
                      value={editForm.whatsapp}
                      onChange={(value) =>
                        setEditForm({ ...editForm, whatsapp: value })
                      }
                    />

                    <Input
                      label="E-mail opcional"
                      value={editForm.email}
                      onChange={(value) =>
                        setEditForm({ ...editForm, email: value })
                      }
                    />

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveCustomer(customer.id)}
                        className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-black hover:bg-emerald-400"
                      >
                        <Save size={18} />
                        Salvar
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingId("")}
                        className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-3 font-bold text-white hover:border-slate-500"
                      >
                        <X size={18} />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {customer.name}
                        </h2>
                        <p className="text-sm text-slate-400">
                          WhatsApp: +{customer.whatsapp}
                        </p>
                        {customer.email && (
                          <p className="text-sm text-slate-500">
                            {customer.email}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(customer)}
                          className="rounded-xl border border-slate-700 p-3 text-slate-300 hover:border-emerald-400 hover:text-emerald-400"
                        >
                          <Edit size={18} />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteCustomer(customer.id)}
                          className="rounded-xl border border-red-500/40 p-3 text-red-400 hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Stat label="Reservas" value={customerBookings.length} />
                      <Stat
                        label="Reservas fixas"
                        value={customerRecurring.length}
                      />
                    </div>

                    {customerRecurring.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                        <p className="mb-3 text-sm font-bold text-indigo-300">
                          Reserva fixa ativa
                        </p>

                        <div className="space-y-2">
                          {customerRecurring.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex justify-between gap-3 text-sm"
                            >
                              <span className="text-slate-300">
                                {getFieldName(booking.fields)} •{" "}
                                {getWeekdayLabel(booking.weekday)}
                              </span>
                              <strong className="text-white">
                                {booking.start_time.slice(0, 5)} às{" "}
                                {booking.end_time.slice(0, 5)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-5 rounded-2xl bg-slate-950/60 p-4">
                      <p className="mb-3 text-sm font-bold text-slate-300">
                        Últimas reservas
                      </p>

                      {customerBookings.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Nenhuma reserva encontrada.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {customerBookings.slice(0, 3).map((booking) => (
                            <div
                              key={booking.id}
                              className="flex justify-between gap-3 text-sm"
                            >
                              <span className="text-slate-400">
                                {getFieldName(booking.fields)} •{" "}
                                {formatDate(booking.booking_date)}
                              </span>
                              <strong className="text-white">
                                R$ {formatMoney(booking.amount)}
                              </strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-950/60 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function Input({
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
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400"
      />
    </label>
  );
}

function WhatsappInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">WhatsApp</span>

      <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-emerald-400">
        <span className="flex items-center border-r border-slate-700 bg-slate-900 px-4 font-bold text-emerald-400">
          +55
        </span>

        <input
          value={value.replace(/^55/, "")}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, "").replace(/^55/, ""))
          }
          className="w-full bg-transparent p-3 text-white outline-none"
        />
      </div>
    </label>
  );
}

function getFieldName(fields: FieldRelation) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function getWeekdayLabel(weekday: number) {
  const days: Record<number, string> = {
    0: "Domingo",
    1: "Segunda-feira",
    2: "Terça-feira",
    3: "Quarta-feira",
    4: "Quinta-feira",
    5: "Sexta-feira",
    6: "Sábado",
  };

  return days[weekday] || "Dia da semana";
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
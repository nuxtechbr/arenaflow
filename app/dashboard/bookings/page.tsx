"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, Save, Trash2, Users, Wallet, X, Edit3, PlayCircle, Ban } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type View = "agenda" | "nova" | "fixa" | "lista" | "fixas" | "resumo" | "bloqueios";
type FieldRelation = { name: string } | { name: string }[] | null | undefined;

type Field = {
  id: string;
  name: string;
  sport: string | null;
  status: string;
};

type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
};

type PricingOption = {
  id: string;
  field_id: string;
  duration_minutes: number;
  price: number;
  weekend_price: number | null;
  is_active: boolean;
};

type Booking = {
  id: string;
  field_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  status: string;
  notes?: string | null;
  fields?: FieldRelation;
};

type RecurringBooking = {
  id: string;
  field_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_whatsapp: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  status: string;
  billing_type: string | null;
  monthly_amount: number | null;
  payment_mode: string | null;
  entry_amount: number | null;
  due_day: number | null;
  payment_status: string | null;
  paid_amount: number | null;
  next_due_date: string | null;
  block_if_overdue: boolean | null;
  overdue_tolerance_days: number | null;
  notes: string | null;
  source?: string | null;
  approval_status?: string | null;
  requested_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  fields?: FieldRelation;
};

type OpeningHour = {
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

type ScheduleBlock = {
  id: string;
  arena_id: string;
  field_id: string | null;
  title: string;
  reason: string;
  block_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  status: string;
  fields?: FieldRelation;
};

type SelectOption = { value: string; label: string };

const durationLabels: Record<number, string> = {
  30: "30 min",
  60: "1 hora",
  90: "1h30",
  120: "2 horas",
  150: "2h30",
  180: "3 horas",
};

const weekdayOptions: SelectOption[] = [
  { value: "1", label: "Segunda-feira" },
  { value: "2", label: "Terça-feira" },
  { value: "3", label: "Quarta-feira" },
  { value: "4", label: "Quinta-feira" },
  { value: "5", label: "Sexta-feira" },
  { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

const statusOptions: SelectOption[] = [
  { value: "pendente", label: "Pendente" },
  { value: "aguardando_sinal", label: "Aguardando sinal" },
  { value: "confirmada", label: "Confirmada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "concluida", label: "Concluída" },
];

const emptyBookingForm = {
  customer_id: "",
  customer_name: "",
  customer_whatsapp: "",
  field_id: "",
  pricing_option_id: "",
  booking_date: "",
  start_time: "",
  status: "confirmada",
  notes: "",
};

const emptyRecurringForm = {
  customer_id: "",
  customer_name: "",
  customer_whatsapp: "",
  field_id: "",
  weekday: "1",
  start_time: "",
  end_time: "",
  start_date: "",
  end_date: "",
  notes: "",
  billing_type: "weekly",
  monthly_amount: "",
  payment_mode: "no_entry",
  entry_amount: "",
  due_day: "15",
  paid_amount: "",
  next_due_date: "",
  block_if_overdue: false,
  overdue_tolerance_days: "5",
};

const emptyBlockForm = {
  field_id: "",
  title: "",
  reason: "manual",
  block_date: "",
  start_time: "",
  end_time: "",
  notes: "",
};

export default function BookingsPage() {
  const searchParams = useSearchParams();
  const view = getView(searchParams.get("view"));
  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();
  const arenaId = activeArenaId;


  const [fields, setFields] = useState<Field[]>([]);
  const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recurringBookings, setRecurringBookings] = useState<RecurringBooking[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const [bookingForm, setBookingForm] = useState(emptyBookingForm);
  const [recurringForm, setRecurringForm] = useState(emptyRecurringForm);
  const [blockForm, setBlockForm] = useState(emptyBlockForm);

  const [searchType, setSearchType] = useState<"name" | "whatsapp">("name");
  const [customerSearch, setCustomerSearch] = useState("");
  const [recurringSearchType, setRecurringSearchType] = useState<"name" | "whatsapp">("name");
  const [recurringCustomerSearch, setRecurringCustomerSearch] = useState("");

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringBooking | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduleBlock | null>(null);

  useEffect(() => {
    if (activeArenaId) {
      loadData(activeArenaId);
      return;
    }

    if (!arenaLoading) {
      setLoading(false);
    }
  }, [activeArenaId, arenaLoading]);

  useEffect(() => {
    if (view === "nova") prepareNewBooking();
    if (view === "fixa") prepareRecurringBooking();
    if (view === "bloqueios") prepareBlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, fields.length, pricingOptions.length]);

  const selectedPricing = useMemo(
    () => pricingOptions.find((item) => item.id === bookingForm.pricing_option_id),
    [pricingOptions, bookingForm.pricing_option_id]
  );

  const bookingAmount = useMemo(() => {
    if (!selectedPricing) return 0;
    const date = new Date(`${bookingForm.booking_date || selectedDate}T00:00:00`);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    return Number(isWeekend && selectedPricing.weekend_price ? selectedPricing.weekend_price : selectedPricing.price);
  }, [selectedPricing, bookingForm.booking_date, selectedDate]);

  const bookingEndTime = useMemo(() => {
    if (!bookingForm.start_time || !selectedPricing) return "";
    return addMinutesToTime(bookingForm.start_time, selectedPricing.duration_minutes);
  }, [bookingForm.start_time, selectedPricing]);

  const pricingForSelectedField = useMemo(() => {
    return pricingOptions.filter((option) => option.field_id === bookingForm.field_id && option.is_active);
  }, [pricingOptions, bookingForm.field_id]);

  const filteredCustomers = useMemo(() => filterCustomers(customers, customerSearch, searchType), [customers, customerSearch, searchType]);
  const filteredRecurringCustomers = useMemo(() => filterCustomers(customers, recurringCustomerSearch, recurringSearchType), [customers, recurringCustomerSearch, recurringSearchType]);

  const dayOpening = useMemo(() => {
    const weekday = new Date(`${selectedDate}T00:00:00`).getDay();
    return openingHours.find((item) => item.weekday === weekday);
  }, [selectedDate, openingHours]);

  const agendaTimes = useMemo(() => {
    if (!dayOpening?.is_open || !dayOpening.open_time || !dayOpening.close_time) return [];
    const open = timeToMinutes(dayOpening.open_time.slice(0, 5));
    const close = timeToMinutes(dayOpening.close_time.slice(0, 5));
    const times: string[] = [];
    for (let current = open; current < close; current += 30) times.push(minutesToTime(current));
    return times;
  }, [dayOpening]);

  const recurringForSelectedDate = useMemo(() => getRecurringBookingsForDate(recurringBookings, selectedDate), [recurringBookings, selectedDate]);

  const availableTimes = useMemo(() => {
    if (!bookingForm.booking_date || !bookingForm.field_id || !selectedPricing) return [];
    const weekday = new Date(`${bookingForm.booking_date}T00:00:00`).getDay();
    const opening = openingHours.find((item) => item.weekday === weekday);
    if (!opening?.is_open || !opening.open_time || !opening.close_time) return [];

    const open = timeToMinutes(opening.open_time.slice(0, 5));
    const close = timeToMinutes(opening.close_time.slice(0, 5));
    const duration = selectedPricing.duration_minutes;
    const times: string[] = [];

    for (let current = open; current + duration <= close; current += 30) {
      const start = current;
      const end = current + duration;
      const hasConflict = hasConflictAt(bookings, recurringBookings, scheduleBlocks, bookingForm.field_id, bookingForm.booking_date, start, end);
      if (!hasConflict) times.push(minutesToTime(current));
    }
    return times;
  }, [bookingForm.booking_date, bookingForm.field_id, selectedPricing, openingHours, bookings, recurringBookings, scheduleBlocks]);

  const todayBookings = bookings.filter((booking) => booking.booking_date === selectedDate && booking.status !== "cancelada");
  const pendingRecurringRequests = recurringBookings.filter(
    (booking) => booking.status === "pending" || booking.approval_status === "pending"
  );
  const activeRecurring = recurringBookings.filter((booking) => booking.status === "active");
  const dayTotal = todayBookings.filter(isPaidBooking).reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

  async function loadData(currentArenaId: string) {
    setLoading(true);

    const [fieldsRes, customersRes, bookingsRes, recurringRes, blocksRes, hoursRes] = await Promise.all([
      supabase.from("fields").select("id, name, sport, status").eq("arena_id", currentArenaId).or("status.is.null,status.eq.active,status.eq.ativo,status.eq.available,status.eq.disponivel").order("created_at", { ascending: true }),
      supabase.from("customers").select("id, name, whatsapp, email").eq("arena_id", currentArenaId).order("created_at", { ascending: false }),
      supabase.from("bookings").select("*, fields(name)").eq("arena_id", currentArenaId).order("booking_date", { ascending: false }).order("start_time", { ascending: true }),
      supabase.from("recurring_bookings").select("*, fields(name)").eq("arena_id", currentArenaId).order("weekday", { ascending: true }).order("start_time", { ascending: true }),
      supabase.from("schedule_blocks").select("*, fields(name)").eq("arena_id", currentArenaId).order("block_date", { ascending: false }).order("start_time", { ascending: true }),
      supabase.from("arena_opening_hours").select("weekday, is_open, open_time, close_time").eq("arena_id", currentArenaId),
    ]);

    const loadedFields = (fieldsRes.data || []) as Field[];
    setFields(loadedFields);
    setCustomers((customersRes.data || []) as Customer[]);
    setBookings((bookingsRes.data || []) as Booking[]);
    setRecurringBookings((recurringRes.data || []) as RecurringBooking[]);
    setScheduleBlocks((blocksRes.data || []) as ScheduleBlock[]);
    setOpeningHours((hoursRes.data || []) as OpeningHour[]);

    if (loadedFields.length > 0) {
      const { data } = await supabase
        .from("field_pricing_options")
        .select("*")
        .in("field_id", loadedFields.map((field) => field.id))
        .eq("is_active", true)
        .order("duration_minutes", { ascending: true });
      setPricingOptions((data || []) as PricingOption[]);
    } else {
      setPricingOptions([]);
    }

    setLoading(false);
  }

  function prepareNewBooking(fieldId?: string, startTime?: string) {
    const firstFieldId = fieldId || fields[0]?.id || "";
    const firstPricingId = pricingOptions.find((item) => item.field_id === firstFieldId)?.id || "";
    setBookingForm({ ...emptyBookingForm, field_id: firstFieldId, pricing_option_id: firstPricingId, booking_date: selectedDate, start_time: startTime || "" });
    setCustomerSearch("");
    setSearchType("name");
  }

  function prepareRecurringBooking() {
    setRecurringForm({
      ...emptyRecurringForm,
      field_id: fields[0]?.id || "",
      start_date: selectedDate,
      weekday: String(new Date(`${selectedDate}T00:00:00`).getDay()),
      next_due_date: buildNextDueDate(selectedDate, 15),
    });
    setRecurringCustomerSearch("");
    setRecurringSearchType("name");
  }

  function prepareBlock() {
    setBlockForm({
      ...emptyBlockForm,
      field_id: fields[0]?.id || "",
      block_date: selectedDate,
    });
  }

  function handleBookingChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    if (name === "field_id") {
      const firstPricing = pricingOptions.find((item) => item.field_id === value && item.is_active);
      setBookingForm({ ...bookingForm, field_id: value, pricing_option_id: firstPricing?.id || "", start_time: "" });
      return;
    }
    if (name === "pricing_option_id" || name === "booking_date") {
      setBookingForm({ ...bookingForm, [name]: value, start_time: "" });
      return;
    }
    setBookingForm({ ...bookingForm, [name]: value });
  }

  function handleRecurringChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const target = event.target;
    const { name, value } = target;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      setRecurringForm({ ...recurringForm, [name]: target.checked });
      return;
    }
    if (name === "due_day") {
      setRecurringForm({ ...recurringForm, due_day: value, next_due_date: buildNextDueDate(recurringForm.start_date || selectedDate, Number(value || 15)) });
      return;
    }
    setRecurringForm({ ...recurringForm, [name]: value });
  }

  function handleCustomerSearch(value: string) {
    if (searchType === "whatsapp") {
      const clean = value.replace(/\D/g, "");
      setCustomerSearch(clean);
      setBookingForm({ ...bookingForm, customer_id: "", customer_whatsapp: clean });
      return;
    }
    setCustomerSearch(value);
    setBookingForm({ ...bookingForm, customer_id: "", customer_name: value });
  }

  function handleRecurringCustomerSearch(value: string) {
    if (recurringSearchType === "whatsapp") {
      const clean = value.replace(/\D/g, "");
      setRecurringCustomerSearch(clean);
      setRecurringForm({ ...recurringForm, customer_id: "", customer_whatsapp: clean });
      return;
    }
    setRecurringCustomerSearch(value);
    setRecurringForm({ ...recurringForm, customer_id: "", customer_name: value });
  }

  function selectCustomer(customer: Customer) {
    setBookingForm({ ...bookingForm, customer_id: customer.id, customer_name: customer.name, customer_whatsapp: customer.whatsapp.replace(/^55/, "") });
    setCustomerSearch(searchType === "name" ? customer.name : customer.whatsapp.replace(/^55/, ""));
  }

  function selectRecurringCustomer(customer: Customer) {
    setRecurringForm({ ...recurringForm, customer_id: customer.id, customer_name: customer.name, customer_whatsapp: customer.whatsapp.replace(/^55/, "") });
    setRecurringCustomerSearch(recurringSearchType === "name" ? customer.name : customer.whatsapp.replace(/^55/, ""));
  }

  async function createOrFindCustomer(name: string, whatsapp: string | null): Promise<string | null> {
    if (!whatsapp) return null;
    const fullWhatsapp = whatsapp.startsWith("55") ? whatsapp : `55${whatsapp}`;
    const { data: existing } = await supabase.from("customers").select("id").eq("arena_id", arenaId).eq("whatsapp", fullWhatsapp).maybeSingle();
    if (existing) return existing.id;
    const { data: created, error } = await supabase.from("customers").insert({ arena_id: arenaId, name, whatsapp: fullWhatsapp }).select("id").single();
    if (error) {
      alert(error.message);
      return null;
    }
    return created.id as string;
  }

  async function saveBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!bookingForm.customer_name.trim()) return alert("Informe o nome do cliente.");
    if (!bookingForm.customer_whatsapp.trim()) return alert("Informe o WhatsApp do cliente.");
    if (!bookingForm.field_id || !selectedPricing || !bookingForm.booking_date || !bookingForm.start_time) return alert("Preencha quadra, duração, data e horário.");

    const endTime = bookingEndTime;
    const start = timeToMinutes(bookingForm.start_time);
    const end = timeToMinutes(endTime);
    if (hasConflictAt(bookings, recurringBookings, scheduleBlocks, bookingForm.field_id, bookingForm.booking_date, start, end)) return alert("Já existe reserva ou bloqueio nesse horário.");

    setSaving(true);
    let customerId: string | null = bookingForm.customer_id || null;
    const fullWhatsapp = bookingForm.customer_whatsapp.startsWith("55") ? bookingForm.customer_whatsapp : `55${bookingForm.customer_whatsapp}`;
    if (!customerId) customerId = await createOrFindCustomer(bookingForm.customer_name, fullWhatsapp);

    const { error } = await supabase.from("bookings").insert({
      arena_id: arenaId,
      field_id: bookingForm.field_id,
      customer_id: customerId,
      customer_name: bookingForm.customer_name,
      customer_whatsapp: fullWhatsapp,
      booking_date: bookingForm.booking_date,
      start_time: bookingForm.start_time,
      end_time: endTime,
      duration_minutes: selectedPricing.duration_minutes,
      pricing_option_id: selectedPricing.id,
      amount: bookingAmount,
      status: bookingForm.status,
      source: "manual",
      notes: bookingForm.notes,
    });

    setSaving(false);
    if (error) return alert(error.message);
    if (arenaId) await loadData(arenaId);
    alert("Reserva cadastrada com sucesso!");
  }

  async function saveRecurringBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!recurringForm.customer_name.trim()) return alert("Informe o nome do cliente.");
    if (!recurringForm.field_id) return alert("Selecione uma quadra.");
    if (!recurringForm.start_time || !recurringForm.end_time) return alert("Informe horário inicial e final.");
    if (!recurringForm.start_date) return alert("Informe a data de início.");
    if (timeToMinutes(recurringForm.end_time) <= timeToMinutes(recurringForm.start_time)) return alert("O horário final precisa ser maior que o inicial.");

    const conflict = recurringBookings.some((item) => {
      if (item.status !== "active") return false;
      if (item.field_id !== recurringForm.field_id) return false;
      if (item.weekday !== Number(recurringForm.weekday)) return false;
      const currentStart = timeToMinutes(recurringForm.start_time);
      const currentEnd = timeToMinutes(recurringForm.end_time);
      const existingStart = timeToMinutes(item.start_time.slice(0, 5));
      const existingEnd = timeToMinutes(item.end_time.slice(0, 5));
      return currentStart < existingEnd && currentEnd > existingStart;
    });
    if (conflict) return alert("Já existe uma reserva fixa conflitante nesse dia e horário.");

    setSaving(true);
    let customerId: string | null = recurringForm.customer_id || null;
    const fullWhatsapp = recurringForm.customer_whatsapp ? (recurringForm.customer_whatsapp.startsWith("55") ? recurringForm.customer_whatsapp : `55${recurringForm.customer_whatsapp}`) : null;
    if (!customerId && fullWhatsapp) customerId = await createOrFindCustomer(recurringForm.customer_name, fullWhatsapp);

    const monthlyAmount = Number(recurringForm.monthly_amount || 0);
    const entryAmount = Number(recurringForm.entry_amount || 0);
    const paidAmount = recurringForm.payment_mode === "paid_upfront" ? monthlyAmount : Number(recurringForm.paid_amount || entryAmount || 0);
    const dueDay = Number(recurringForm.due_day || 15);
    const nextDueDate = recurringForm.next_due_date || buildNextDueDate(recurringForm.start_date, dueDay);
    const paymentStatus = paidAmount >= monthlyAmount && monthlyAmount > 0 ? "paid" : "pending";

    const { data: recurring, error } = await supabase.from("recurring_bookings").insert({
      arena_id: arenaId,
      field_id: recurringForm.field_id,
      customer_id: customerId,
      customer_name: recurringForm.customer_name,
      customer_whatsapp: fullWhatsapp,
      weekday: Number(recurringForm.weekday),
      start_time: recurringForm.start_time,
      end_time: recurringForm.end_time,
      start_date: recurringForm.start_date,
      end_date: recurringForm.end_date || null,
      status: "active",
      source: "dashboard",
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      notes: recurringForm.notes,
      billing_type: recurringForm.billing_type,
      monthly_amount: recurringForm.billing_type === "monthly" ? monthlyAmount : null,
      payment_mode: recurringForm.payment_mode,
      entry_amount: recurringForm.payment_mode === "entry_balance" ? entryAmount : null,
      due_day: dueDay,
      payment_status: paymentStatus,
      paid_amount: paidAmount,
      next_due_date: nextDueDate,
      block_if_overdue: Boolean(recurringForm.block_if_overdue),
      overdue_tolerance_days: Number(recurringForm.overdue_tolerance_days || 5),
    }).select("id").single();

    if (error) {
      setSaving(false);
      return alert(error.message);
    }

    if (recurringForm.billing_type === "monthly" && recurring?.id && monthlyAmount > 0) {
      const invoiceAmount = Math.max(monthlyAmount - paidAmount, 0);
      await supabase.from("recurring_invoices").insert({
        arena_id: arenaId,
        recurring_booking_id: recurring.id,
        customer_id: customerId,
        customer_name: recurringForm.customer_name,
        description: `Mensalista - ${getWeekdayLabel(Number(recurringForm.weekday))} ${recurringForm.start_time} às ${recurringForm.end_time}`,
        reference_month: nextDueDate.slice(0, 7),
        due_date: nextDueDate,
        amount: monthlyAmount,
        paid_amount: paidAmount,
        status: invoiceAmount <= 0 ? "paid" : "pending",
        paid_at: invoiceAmount <= 0 ? new Date().toISOString() : null,
      });
    }

    setSaving(false);
    if (arenaId) await loadData(arenaId);
    alert("Reserva fixa cadastrada com sucesso!");
  }

  async function cancelBooking(id: string) {
    if (!confirm("Deseja cancelar esta reserva?")) return;
    const { error } = await supabase.from("bookings").update({ status: "cancelada" }).eq("id", id);
    if (error) return alert(error.message);
    if (arenaId) await loadData(arenaId);
  }

  async function updateBookingStatus(id: string, status: string) {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return alert(error.message);
    setSelectedBooking(null);
    if (arenaId) await loadData(arenaId);
  }

  async function saveBookingEdit(updated: Booking) {
    if (!updated.customer_name.trim()) return alert("Informe o nome do cliente.");
    if (!updated.field_id || !updated.booking_date || !updated.start_time || !updated.end_time) return alert("Preencha quadra, data e horários.");
    if (timeToMinutes(updated.end_time.slice(0, 5)) <= timeToMinutes(updated.start_time.slice(0, 5))) return alert("O horário final precisa ser maior que o inicial.");

    const { error } = await supabase
      .from("bookings")
      .update({
        field_id: updated.field_id,
        customer_name: updated.customer_name,
        customer_whatsapp: updated.customer_whatsapp,
        booking_date: updated.booking_date,
        start_time: updated.start_time.slice(0, 5),
        end_time: updated.end_time.slice(0, 5),
        amount: Number(updated.amount || 0),
        status: updated.status,
        notes: updated.notes || null,
      })
      .eq("id", updated.id);

    if (error) return alert(error.message);
    setSelectedBooking(null);
    if (arenaId) await loadData(arenaId);
  }

  async function disableRecurring(id: string) {
    if (!confirm("Deseja desativar esta reserva fixa?")) return;
    const { error } = await supabase.from("recurring_bookings").update({ status: "inactive" }).eq("id", id);
    if (error) return alert(error.message);
    if (arenaId) await loadData(arenaId);
  }

  async function approveRecurringRequest(booking: RecurringBooking) {
    if (!confirm("Aprovar esta solicitação de reserva fixa?")) return;

    const conflict = recurringBookings.some((item) => {
      if (item.id === booking.id) return false;
      if (item.status !== "active") return false;
      if (item.field_id !== booking.field_id) return false;
      if (item.weekday !== Number(booking.weekday)) return false;

      const currentStart = timeToMinutes(booking.start_time.slice(0, 5));
      const currentEnd = timeToMinutes(booking.end_time.slice(0, 5));
      const existingStart = timeToMinutes(item.start_time.slice(0, 5));
      const existingEnd = timeToMinutes(item.end_time.slice(0, 5));

      return currentStart < existingEnd && currentEnd > existingStart;
    });

    if (conflict) {
      return alert("Já existe uma reserva fixa ativa conflitante nesse dia e horário.");
    }

    const shouldBeMonthly = confirm(
      "Essa reserva fixa será mensalista com cobrança mensal?\n\nOK = Sim, mensalista\nCancelar = Não, apenas reserva fixa sem cobrança"
    );

    let billingType = "weekly";
    let monthlyAmount: number | null = null;
    let dueDay: number | null = null;
    let nextDueDate: string | null = null;
    let paymentStatus: string | null = null;
    let paidAmount: number | null = null;

    if (shouldBeMonthly) {
      const amountText = prompt("Valor mensal do mensalista:", "700");
      if (amountText === null) return;

      const parsedAmount = Number(amountText.replace(",", "."));
      if (!parsedAmount || parsedAmount <= 0) {
        return alert("Informe um valor mensal válido.");
      }

      const dueDayText = prompt("Dia do vencimento:", "10");
      if (dueDayText === null) return;

      const parsedDueDay = Number(dueDayText);
      if (!parsedDueDay || parsedDueDay < 1 || parsedDueDay > 31) {
        return alert("Informe um dia de vencimento válido entre 1 e 31.");
      }

      billingType = "monthly";
      monthlyAmount = parsedAmount;
      dueDay = parsedDueDay;
      nextDueDate = buildNextDueDate(booking.start_date, parsedDueDay);
      paymentStatus = "pending";
      paidAmount = 0;
    }

    const { error } = await supabase
      .from("recurring_bookings")
      .update({
        status: "active",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
        billing_type: billingType,
        monthly_amount: monthlyAmount,
        due_day: dueDay,
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        next_due_date: nextDueDate,
        payment_mode: "no_entry",
      })
      .eq("id", booking.id);

    if (error) return alert(error.message);

    if (shouldBeMonthly && monthlyAmount && nextDueDate) {
      const { error: invoiceError } = await supabase.from("recurring_invoices").insert({
        arena_id: arenaId,
        recurring_booking_id: booking.id,
        customer_id: booking.customer_id,
        customer_name: booking.customer_name,
        description: `Mensalista - ${getWeekdayLabel(Number(booking.weekday))} ${booking.start_time.slice(0, 5)} às ${booking.end_time.slice(0, 5)}`,
        reference_month: nextDueDate.slice(0, 7),
        due_date: nextDueDate,
        amount: monthlyAmount,
        paid_amount: 0,
        status: "pending",
      });

      if (invoiceError) {
        alert(
          "Reserva aprovada, mas houve erro ao gerar a mensalidade: " +
            invoiceError.message
        );
      }
    }

    if (arenaId) await loadData(arenaId);
    alert(
      shouldBeMonthly
        ? "Solicitação aprovada como mensalista!"
        : "Solicitação aprovada como reserva fixa!"
    );
  }

  async function rejectRecurringRequest(id: string) {
    if (!confirm("Recusar esta solicitação de reserva fixa?")) return;

    const { error } = await supabase
      .from("recurring_bookings")
      .update({
        status: "inactive",
        approval_status: "rejected",
      })
      .eq("id", id);

    if (error) return alert(error.message);
    if (arenaId) await loadData(arenaId);
  }

  async function updateRecurringStatus(id: string, status: string) {
    const { error } = await supabase.from("recurring_bookings").update({ status }).eq("id", id);
    if (error) return alert(error.message);
    setSelectedRecurring(null);
    if (arenaId) await loadData(arenaId);
  }

  async function saveRecurringEdit(updated: RecurringBooking) {
    if (!updated.customer_name.trim()) return alert("Informe o nome do cliente.");
    if (!updated.field_id || !updated.start_time || !updated.end_time || !updated.start_date) return alert("Preencha quadra, horário e data de início.");
    if (timeToMinutes(updated.end_time.slice(0, 5)) <= timeToMinutes(updated.start_time.slice(0, 5))) return alert("O horário final precisa ser maior que o inicial.");

    const { error } = await supabase
      .from("recurring_bookings")
      .update({
        field_id: updated.field_id,
        customer_name: updated.customer_name,
        customer_whatsapp: updated.customer_whatsapp || null,
        weekday: Number(updated.weekday),
        start_time: updated.start_time.slice(0, 5),
        end_time: updated.end_time.slice(0, 5),
        start_date: updated.start_date,
        end_date: updated.end_date || null,
        status: updated.status,
        billing_type: updated.billing_type,
        monthly_amount: updated.billing_type === "monthly" ? Number(updated.monthly_amount || 0) : null,
        payment_mode: updated.payment_mode,
        entry_amount: updated.payment_mode === "entry_balance" ? Number(updated.entry_amount || 0) : null,
        due_day: Number(updated.due_day || 15),
        payment_status: updated.payment_status || "pending",
        paid_amount: Number(updated.paid_amount || 0),
        next_due_date: updated.next_due_date || null,
        block_if_overdue: Boolean(updated.block_if_overdue),
        overdue_tolerance_days: Number(updated.overdue_tolerance_days || 5),
        notes: updated.notes || null,
      })
      .eq("id", updated.id);

    if (error) return alert(error.message);
    setSelectedRecurring(null);
    if (arenaId) await loadData(arenaId);
  }

  async function saveBlock(event: React.FormEvent) {
    event.preventDefault();
    if (!arenaId) return alert("Selecione uma arena.");
    if (!blockForm.title.trim()) return alert("Informe o título do bloqueio.");
    if (!blockForm.field_id) return alert("Selecione uma quadra.");
    if (!blockForm.block_date || !blockForm.start_time || !blockForm.end_time) return alert("Informe data e horários.");
    const start = timeToMinutes(blockForm.start_time);
    const end = timeToMinutes(blockForm.end_time);
    if (end <= start) return alert("O horário final precisa ser maior que o inicial.");
    if (hasConflictAt(bookings, recurringBookings, scheduleBlocks, blockForm.field_id, blockForm.block_date, start, end)) return alert("Já existe reserva ou bloqueio nesse horário.");

    setSaving(true);
    const { error } = await supabase.from("schedule_blocks").insert({
      arena_id: arenaId,
      field_id: blockForm.field_id,
      title: blockForm.title.trim(),
      reason: blockForm.reason,
      block_date: blockForm.block_date,
      start_time: blockForm.start_time,
      end_time: blockForm.end_time,
      notes: blockForm.notes || null,
      status: "active",
    });
    setSaving(false);
    if (error) return alert(error.message);
    if (arenaId) await loadData(arenaId);
    setBlockForm(emptyBlockForm);
    alert("Bloqueio cadastrado com sucesso!");
  }

  async function saveBlockEdit(updated: ScheduleBlock) {
    if (!updated.title.trim()) return alert("Informe o título do bloqueio.");
    if (!updated.field_id || !updated.block_date || !updated.start_time || !updated.end_time) return alert("Informe quadra, data e horários.");
    if (timeToMinutes(updated.end_time.slice(0, 5)) <= timeToMinutes(updated.start_time.slice(0, 5))) return alert("O horário final precisa ser maior que o inicial.");

    const { error } = await supabase
      .from("schedule_blocks")
      .update({
        field_id: updated.field_id,
        title: updated.title,
        reason: updated.reason,
        block_date: updated.block_date,
        start_time: updated.start_time.slice(0, 5),
        end_time: updated.end_time.slice(0, 5),
        notes: updated.notes || null,
        status: updated.status,
      })
      .eq("id", updated.id);

    if (error) return alert(error.message);
    setSelectedBlock(null);
    if (arenaId) await loadData(arenaId);
  }

  async function cancelBlock(id: string) {
    if (!confirm("Deseja cancelar este bloqueio?")) return;
    const { error } = await supabase.from("schedule_blocks").update({ status: "cancelled" }).eq("id", id);
    if (error) return alert(error.message);
    setSelectedBlock(null);
    if (arenaId) await loadData(arenaId);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#F5F7FB] text-slate-950">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold shadow-sm">
          <CalendarDays className="text-emerald-600" />
          Carregando reservas...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1640px] space-y-4 bg-[#F5F7FB] p-4 text-slate-950 md:p-6">
      <PageHeader view={view} arenaName={activeArenaInfo?.name || "Arena selecionada"} />
      {view === "agenda" && <AgendaView fields={fields} selectedDate={selectedDate} setSelectedDate={setSelectedDate} agendaTimes={agendaTimes} bookings={bookings} recurringBookings={recurringForSelectedDate} blocks={scheduleBlocks.filter((block) => block.block_date === selectedDate && block.status === "active")} onFreeClick={(fieldId, time) => { prepareNewBooking(fieldId, time); window.history.pushState(null, "", "/dashboard/bookings?view=nova"); }} />}
      {view === "nova" && <NewBookingForm form={bookingForm} setForm={setBookingForm} searchType={searchType} setSearchType={setSearchType} customerSearch={customerSearch} onCustomerSearch={handleCustomerSearch} customers={filteredCustomers} onSelectCustomer={selectCustomer} fields={fields} pricingOptions={pricingForSelectedField} selectedPricing={selectedPricing} amount={bookingAmount} endTime={bookingEndTime} availableTimes={availableTimes} onChange={handleBookingChange} onSubmit={saveBooking} saving={saving} />}
      {view === "fixa" && <RecurringForm form={recurringForm} setForm={setRecurringForm} searchType={recurringSearchType} setSearchType={setRecurringSearchType} customerSearch={recurringCustomerSearch} onCustomerSearch={handleRecurringCustomerSearch} customers={filteredRecurringCustomers} onSelectCustomer={selectRecurringCustomer} fields={fields} onChange={handleRecurringChange} onSubmit={saveRecurringBooking} saving={saving} />}
      {view === "lista" && <BookingList bookings={bookings} onOpen={setSelectedBooking} onStatus={updateBookingStatus} onCancel={cancelBooking} />}
      {view === "fixas" && (
        <RecurringList
          bookings={recurringBookings}
          pendingRequests={pendingRecurringRequests}
          onOpen={setSelectedRecurring}
          onStatus={updateRecurringStatus}
          onDisable={disableRecurring}
          onApprove={approveRecurringRequest}
          onReject={rejectRecurringRequest}
        />
      )}
      {view === "resumo" && <SummaryView todayCount={todayBookings.length} recurringCount={activeRecurring.length} dayTotal={dayTotal} monthlyCount={activeRecurring.filter((item) => item.billing_type === "monthly").length} />}
      {view === "bloqueios" && <BlocksView form={blockForm} setForm={setBlockForm} fields={fields} blocks={scheduleBlocks} onSubmit={saveBlock} saving={saving} onOpen={setSelectedBlock} onCancel={cancelBlock} />}

      {selectedBooking && (
        <BookingActionModal
          booking={selectedBooking}
          fields={fields}
          onClose={() => setSelectedBooking(null)}
          onSave={saveBookingEdit}
          onStatus={updateBookingStatus}
          onCancel={cancelBooking}
        />
      )}

      {selectedRecurring && (
        <RecurringActionModal
          booking={selectedRecurring}
          fields={fields}
          onClose={() => setSelectedRecurring(null)}
          onSave={saveRecurringEdit}
          onStatus={updateRecurringStatus}
          onDisable={disableRecurring}
        />
      )}

      {selectedBlock && (
        <BlockActionModal
          block={selectedBlock}
          fields={fields}
          onClose={() => setSelectedBlock(null)}
          onSave={saveBlockEdit}
          onCancel={cancelBlock}
        />
      )}
    </div>
  );
}

function PageHeader({ view, arenaName }: { view: View; arenaName: string }) {
  const titles: Record<View, string> = {
    agenda: "Agenda operacional",
    nova: "Nova reserva",
    fixa: "Reserva fixa / mensalista",
    lista: "Lista de reservas",
    fixas: "Reservas fixas",
    resumo: "Resumo de reservas",
    bloqueios: "Bloqueios manuais",
  };

  const descriptions: Record<View, string> = {
    agenda: "Controle os horários do dia, ocupação por quadra e ações rápidas.",
    nova: "Cadastre uma reserva avulsa para uma data específica.",
    fixa: "Cadastre horários recorrentes, mensalistas e cobrança mensal.",
    lista: "Consulte, edite e cancele reservas avulsas.",
    fixas: "Gerencie clientes fixos, mensalistas e solicitações pendentes.",
    resumo: "Acompanhe movimento, receita e operação do dia.",
    bloqueios: "Bloqueie horários para manutenção, evento interno ou indisponibilidade.",
  };

  return (
    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-slate-950" />
      <div className="px-5 py-4 md:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-base font-black text-emerald-700 shadow-sm">
                AF
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  <CalendarDays size={13} />
                  {arenaName}
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                  {titles[view]}
                </h1>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">{descriptions[view]}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <MiniHeaderStat label="Hoje" value="Agenda" />
            <MiniHeaderStat label="Operação" value="Reservas" />
            <MiniHeaderStat label="Clientes" value="Mensalistas" />
            <MiniHeaderStat label="Controle" value="Bloqueios" />
          </div>
        </div>
      </div>
    </header>
  );
}

function MiniHeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function AgendaView({ fields, selectedDate, setSelectedDate, agendaTimes, bookings, recurringBookings, blocks, onFreeClick }: { fields: Field[]; selectedDate: string; setSelectedDate: (date: string) => void; agendaTimes: string[]; bookings: Booking[]; recurringBookings: RecurringBooking[]; blocks: ScheduleBlock[]; onFreeClick: (fieldId: string, time: string) => void }) {
  const dayBookings = bookings
    .filter((booking) => booking.booking_date === selectedDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const dayBlocks = blocks.filter((block) => block.block_date === selectedDate && block.status === "active");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-black/10 sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black text-slate-950">
            <CalendarDays size={22} />
            Agenda
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Verde: reserva avulsa • Roxo: reserva fixa • Cinza: bloqueio/ocupado • {fields.length} quadra(s)
          </p>
        </div>

        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm font-bold text-slate-950 outline-none focus:border-emerald-400 lg:w-auto"
        />
      </div>

      {fields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-slate-500">
          Nenhuma quadra ativa encontrada para esta arena. Cadastre ou ative as quadras em <strong>Quadras</strong>.
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            <div className="grid grid-cols-3 gap-2">
              <MobileAgendaMetric label="Reservas" value={dayBookings.length} />
              <MobileAgendaMetric label="Fixas" value={recurringBookings.length} />
              <MobileAgendaMetric label="Bloqueios" value={dayBlocks.length} />
            </div>

            <div className="space-y-4">
              {fields.map((field) => (
                <MobileFieldAgenda
                  key={field.id}
                  field={field}
                  selectedDate={selectedDate}
                  agendaTimes={agendaTimes}
                  bookings={bookings}
                  recurringBookings={recurringBookings}
                  blocks={blocks}
                  onFreeClick={onFreeClick}
                />
              ))}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <div
              className="overflow-hidden rounded-2xl border border-slate-200"
              style={{
                display: "grid",
                minWidth: `${90 + fields.length * 220}px`,
                gridTemplateColumns: `90px repeat(${fields.length}, minmax(220px, 1fr))`,
              }}
            >
              <div className="border-b border-r border-slate-200 bg-white p-3 text-sm font-bold text-slate-600">Horário</div>
              {fields.map((field) => <div key={field.id} className="border-b border-r border-slate-200 bg-white p-3 text-center text-sm font-bold text-slate-950">{field.name}</div>)}
              {agendaTimes.map((time) => (
                <React.Fragment key={time}>
                  <div className="border-r border-t border-slate-200 bg-white p-3 text-sm font-bold text-slate-500">{time}</div>
                  {fields.map((field) => {
                    const booking = getBookingAtTime(bookings, field.id, selectedDate, time);
                    const recurring = getRecurringAtTime(recurringBookings, field.id, time);
                    const block = getBlockAtTime(blocks, field.id, selectedDate, time);
                    const occupied = isTimeInsideBooking(bookings, field.id, selectedDate, time) || isTimeInsideRecurring(recurringBookings, field.id, time) || isTimeInsideBlock(blocks, field.id, selectedDate, time);
                    if (occupied && !booking && !recurring && !block) return <div key={`${field.id}-${time}`} className="border-r border-t border-slate-200 bg-slate-900/50" />;
                    return (
                      <div key={`${field.id}-${time}`} className="min-h-16 border-r border-t border-slate-200 bg-white/70 p-2">
                        {booking ? <BookingCard booking={booking} /> : recurring ? <RecurringCard booking={recurring} /> : block ? <BlockCard block={block} /> : <button type="button" onClick={() => onFreeClick(field.id, time)} className="h-full min-h-10 w-full rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 hover:border-[#22C55E] hover:text-[#22C55E]">Livre</button>}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function MobileAgendaMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
      <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MobileFieldAgenda({
  field,
  selectedDate,
  agendaTimes,
  bookings,
  recurringBookings,
  blocks,
  onFreeClick,
}: {
  field: Field;
  selectedDate: string;
  agendaTimes: string[];
  bookings: Booking[];
  recurringBookings: RecurringBooking[];
  blocks: ScheduleBlock[];
  onFreeClick: (fieldId: string, time: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">{field.name}</h3>
          <p className="text-xs text-slate-500">{field.sport || "Quadra"}</p>
        </div>

        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
          {field.status || "ativa"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {agendaTimes.map((time) => {
          const booking = getBookingAtTime(bookings, field.id, selectedDate, time);
          const recurring = getRecurringAtTime(recurringBookings, field.id, time);
          const block = getBlockAtTime(blocks, field.id, selectedDate, time);
          const occupied = isTimeInsideBooking(bookings, field.id, selectedDate, time) || isTimeInsideRecurring(recurringBookings, field.id, time) || isTimeInsideBlock(blocks, field.id, selectedDate, time);

          if (occupied && !booking && !recurring && !block) {
            return (
              <div key={`${field.id}-${time}`} className="rounded-2xl border border-slate-200 bg-slate-900/60 p-3">
                <p className="text-sm font-black text-slate-500">{time}</p>
                <p className="mt-1 text-xs text-slate-600">Ocupado</p>
              </div>
            );
          }

          if (booking) {
            return <MobileSlotCard key={`${field.id}-${time}`} time={time} type="booking" title={booking.customer_name} subtitle={`R$ ${formatMoney(booking.amount)}`} />;
          }

          if (recurring) {
            return <MobileSlotCard key={`${field.id}-${time}`} time={time} type="recurring" title={recurring.customer_name} subtitle="Reserva fixa" />;
          }

          if (block) {
            return <MobileSlotCard key={`${field.id}-${time}`} time={time} type="block" title={block.title} subtitle="Bloqueio" />;
          }

          return (
            <button
              key={`${field.id}-${time}`}
              type="button"
              onClick={() => onFreeClick(field.id, time)}
              className="rounded-2xl border border-dashed border-slate-200 bg-white p-3 text-left transition hover:border-[#22C55E]"
            >
              <p className="text-sm font-black text-slate-950">{time}</p>
              <p className="mt-1 text-xs font-bold text-emerald-700">Livre • tocar para reservar</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileSlotCard({ time, type, title, subtitle }: { time: string; type: "booking" | "recurring" | "block"; title: string; subtitle: string }) {
  const cls =
    type === "booking"
      ? "border-emerald-200 bg-emerald-50 text-emerald-100"
      : type === "recurring"
        ? "border-violet-500/20 bg-violet-500/10 text-violet-100"
        : "border-slate-500/20 bg-slate-500/10 text-slate-700";

  return (
    <div className={`rounded-2xl border p-3 ${cls}`}>
      <p className="text-sm font-black">{time}</p>
      <p className="mt-1 truncate text-xs font-black">{title}</p>
      <p className="text-[11px] opacity-75">{subtitle}</p>
    </div>
  );
}

function NewBookingForm(props: { form: typeof emptyBookingForm; setForm: (form: typeof emptyBookingForm) => void; searchType: "name" | "whatsapp"; setSearchType: (value: "name" | "whatsapp") => void; customerSearch: string; onCustomerSearch: (value: string) => void; customers: Customer[]; onSelectCustomer: (customer: Customer) => void; fields: Field[]; pricingOptions: PricingOption[]; selectedPricing?: PricingOption; amount: number; endTime: string; availableTimes: string[]; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>; onSubmit: (e: React.FormEvent) => void; saving: boolean }) {
  const { form, setForm, onSubmit, saving } = props;
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-black/10 sm:p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <CustomerSearchBox {...props} />
        <Input label="Nome do cliente" name="customer_name" value={form.customer_name} onChange={props.onChange} />
        <WhatsappInput value={form.customer_whatsapp} onChange={(value) => setForm({ ...form, customer_whatsapp: value })} />
        <Select label="Quadra" name="field_id" value={form.field_id} onChange={props.onChange} options={props.fields.map((field) => ({ value: field.id, label: `${field.name}${field.sport ? ` • ${field.sport}` : ""}` }))} />
        <Select label="Duração e preço" name="pricing_option_id" value={form.pricing_option_id} onChange={props.onChange} options={props.pricingOptions.map((option) => ({ value: option.id, label: `${durationLabels[option.duration_minutes] || `${option.duration_minutes} min`} - R$ ${formatMoney(option.price)}` }))} />
        <Input label="Data" name="booking_date" type="date" value={form.booking_date} onChange={props.onChange} />
        <Select label="Status" name="status" value={form.status} onChange={props.onChange} options={statusOptions} />
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="font-bold text-slate-950">Horários disponíveis</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {props.availableTimes.map((time) => <button key={time} type="button" onClick={() => setForm({ ...form, start_time: time })} className={form.start_time === time ? "rounded-xl bg-[#22C55E] px-3 py-3 text-sm font-bold text-black" : "rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-950 hover:border-[#22C55E]"}>{time}</button>)}
          </div>
        </div>
        <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm text-slate-600">Resumo</p>
          <p className="mt-2 text-slate-950">{form.start_time && props.endTime ? `${form.start_time} até ${props.endTime}` : "Escolha um horário"}</p>
          <p className="mt-1 text-2xl font-bold text-slate-950">R$ {formatMoney(props.amount)}</p>
        </div>
        <Textarea label="Observações" name="notes" value={form.notes} onChange={props.onChange} />
      </div>
      <SaveButton saving={saving} label="Salvar reserva" />
    </form>
  );
}

function RecurringForm(props: { form: typeof emptyRecurringForm; setForm: (form: typeof emptyRecurringForm) => void; searchType: "name" | "whatsapp"; setSearchType: (value: "name" | "whatsapp") => void; customerSearch: string; onCustomerSearch: (value: string) => void; customers: Customer[]; onSelectCustomer: (customer: Customer) => void; fields: Field[]; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>; onSubmit: (e: React.FormEvent) => void; saving: boolean }) {
  const { form, setForm, onSubmit, saving } = props;
  const monthlyAmount = Number(form.monthly_amount || 0);
  const entryAmount = Number(form.entry_amount || 0);
  const balance = Math.max(monthlyAmount - entryAmount, 0);
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-black/10 sm:p-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <CustomerSearchBox {...props} />
        <Input label="Nome do cliente" name="customer_name" value={form.customer_name} onChange={props.onChange} />
        <WhatsappInput value={form.customer_whatsapp} onChange={(value) => setForm({ ...form, customer_whatsapp: value })} />
        <Select label="Quadra" name="field_id" value={form.field_id} onChange={props.onChange} options={props.fields.map((field) => ({ value: field.id, label: `${field.name}${field.sport ? ` • ${field.sport}` : ""}` }))} />
        <Select label="Dia da semana" name="weekday" value={form.weekday} onChange={props.onChange} options={weekdayOptions} />
        <Input label="Horário inicial" name="start_time" type="time" value={form.start_time} onChange={props.onChange} />
        <Input label="Horário final" name="end_time" type="time" value={form.end_time} onChange={props.onChange} />
        <Input label="Data de início" name="start_date" type="date" value={form.start_date} onChange={props.onChange} />
        <Input label="Data final opcional" name="end_date" type="date" value={form.end_date} onChange={props.onChange} />
        <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-950"><Wallet size={20} /> Financeiro do mensalista</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select label="Tipo de cobrança" name="billing_type" value={form.billing_type} onChange={props.onChange} options={[{ value: "weekly", label: "Semanal / apenas bloquear horário" }, { value: "monthly", label: "Mensalista recorrente" }]} />
            {form.billing_type === "monthly" && <Select label="Forma de pagamento" name="payment_mode" value={form.payment_mode} onChange={props.onChange} options={[{ value: "no_entry", label: "Sem entrada" }, { value: "entry_balance", label: "Entrada + saldo" }, { value: "paid_upfront", label: "Pago antecipado" }]} />}
            {form.billing_type === "monthly" && <Input label="Valor mensal" name="monthly_amount" value={form.monthly_amount} onChange={props.onChange} placeholder="800" />}
            {form.billing_type === "monthly" && form.payment_mode === "entry_balance" && <Input label="Entrada" name="entry_amount" value={form.entry_amount} onChange={props.onChange} placeholder="400" />}
            {form.billing_type === "monthly" && <Input label="Dia do vencimento" name="due_day" type="number" value={form.due_day} onChange={props.onChange} />}
            {form.billing_type === "monthly" && <Input label="Próximo vencimento" name="next_due_date" type="date" value={form.next_due_date} onChange={props.onChange} />}
            {form.billing_type === "monthly" && <Input label="Valor já pago" name="paid_amount" value={form.paid_amount} onChange={props.onChange} placeholder="0" />}
            {form.billing_type === "monthly" && <Input label="Tolerância atraso (dias)" name="overdue_tolerance_days" type="number" value={form.overdue_tolerance_days} onChange={props.onChange} />}
          </div>
          {form.billing_type === "monthly" && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
              <p><strong>Valor mensal:</strong> R$ {formatMoney(monthlyAmount)}</p>
              {form.payment_mode === "entry_balance" && <p><strong>Saldo restante:</strong> R$ {formatMoney(balance)}</p>}
              <label className="mt-3 flex items-center gap-2"><input type="checkbox" name="block_if_overdue" checked={Boolean(form.block_if_overdue)} onChange={props.onChange} /> Bloquear se estiver inadimplente</label>
            </div>
          )}
        </div>
        <Textarea label="Observações" name="notes" value={form.notes} onChange={props.onChange} />
      </div>
      <SaveButton saving={saving} label="Salvar reserva fixa" />
    </form>
  );
}

function CustomerSearchBox(props: { searchType: "name" | "whatsapp"; setSearchType: (value: "name" | "whatsapp") => void; customerSearch: string; onCustomerSearch: (value: string) => void; customers: Customer[]; onSelectCustomer: (customer: Customer) => void }) {
  return (
    <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-bold text-slate-950">Cliente</h3>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr]">
        <select value={props.searchType} onChange={(e) => props.setSearchType(e.target.value as "name" | "whatsapp")} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none"><option value="name">Buscar por nome</option><option value="whatsapp">Buscar por WhatsApp</option></select>
        <input value={props.customerSearch} onChange={(e) => props.onCustomerSearch(e.target.value)} placeholder={props.searchType === "name" ? "Digite o nome" : "Digite apenas números"} className="rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none" />
      </div>
      {props.customerSearch && props.customers.length > 0 && <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">{props.customers.map((customer) => <button key={customer.id} type="button" onClick={() => props.onSelectCustomer(customer)} className="rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-[#22C55E]"><strong className="block text-slate-950">{customer.name}</strong><span className="text-sm text-slate-500">+{customer.whatsapp}</span></button>)}</div>}
    </div>
  );
}


function BlocksView({ form, setForm, fields, blocks, onSubmit, saving, onOpen, onCancel }: { form: typeof emptyBlockForm; setForm: (form: typeof emptyBlockForm) => void; fields: Field[]; blocks: ScheduleBlock[]; onSubmit: (event: React.FormEvent) => void; saving: boolean; onOpen: (block: ScheduleBlock) => void; onCancel: (id: string) => void }) {
  const activeBlocks = blocks.filter((block) => block.status === "active");
  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-xl shadow-black/10 sm:p-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Novo bloqueio</h2>
          <p className="mt-1 text-sm text-slate-500">Use para manutenção, evento interno, campeonato, feriado ou quadra indisponível.</p>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <Input label="Título" name="title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Manutenção / Evento interno" />
          <Select label="Motivo" name="reason" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} options={[{ value: "manual", label: "Bloqueio manual" }, { value: "maintenance", label: "Manutenção" }, { value: "event", label: "Evento interno" }, { value: "championship", label: "Campeonato" }, { value: "holiday", label: "Feriado" }, { value: "unavailable", label: "Indisponível" }]} />
          <Select label="Quadra" name="field_id" value={form.field_id} onChange={(event) => setForm({ ...form, field_id: event.target.value })} options={fields.map((field) => ({ value: field.id, label: field.name }))} />
          <Input label="Data" name="block_date" type="date" value={form.block_date} onChange={(event) => setForm({ ...form, block_date: event.target.value })} />
          <Input label="Início" name="start_time" type="time" value={form.start_time} onChange={(event) => setForm({ ...form, start_time: event.target.value })} />
          <Input label="Fim" name="end_time" type="time" value={form.end_time} onChange={(event) => setForm({ ...form, end_time: event.target.value })} />
          <Textarea label="Observações" name="notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        </div>
        <SaveButton saving={saving} label="Salvar bloqueio" />
      </form>

      <ListSection title="Bloqueios cadastrados">
        {activeBlocks.length === 0 && <EmptyState text="Nenhum bloqueio ativo cadastrado." />}
        {activeBlocks.map((block) => (
          <div key={block.id} className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-xl shadow-black/10">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <button type="button" onClick={() => onOpen(block)} className="flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">{block.title}</h3>
                  <span className="rounded-full bg-slate-500/10 px-3 py-1 text-xs font-bold text-slate-600">{getReasonLabel(block.reason)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  {getFieldName(block.fields)} • {formatDate(block.block_date)} • {block.start_time.slice(0, 5)} às {block.end_time.slice(0, 5)}
                </p>
                {block.notes && <p className="mt-1 text-sm text-slate-500">{block.notes}</p>}
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => onOpen(block)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Edit3 size={16} /></button>
                <button onClick={() => onCancel(block.id)} className="rounded-xl border border-red-500/30 px-3 py-2 text-red-300 transition hover:bg-red-500/10"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </ListSection>
    </div>
  );
}

function BlockActionModal({ block, fields, onClose, onSave, onCancel }: { block: ScheduleBlock; fields: Field[]; onClose: () => void; onSave: (block: ScheduleBlock) => void; onCancel: (id: string) => void }) {
  const [form, setForm] = useState<ScheduleBlock>({ ...block, start_time: block.start_time.slice(0, 5), end_time: block.end_time.slice(0, 5), notes: block.notes || "" });
  return (
    <ModalShell title="Gerenciar bloqueio" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModalInput label="Título" value={form.title} onChange={(value) => setForm({ ...form, title: value })} />
        <ModalSelect label="Motivo" value={form.reason} onChange={(value) => setForm({ ...form, reason: value })} options={[{ value: "manual", label: "Bloqueio manual" }, { value: "maintenance", label: "Manutenção" }, { value: "event", label: "Evento interno" }, { value: "championship", label: "Campeonato" }, { value: "holiday", label: "Feriado" }, { value: "unavailable", label: "Indisponível" }]} />
        <ModalSelect label="Quadra" value={form.field_id || ""} onChange={(value) => setForm({ ...form, field_id: value })} options={fields.map((field) => ({ value: field.id, label: field.name }))} />
        <ModalInput label="Data" type="date" value={form.block_date} onChange={(value) => setForm({ ...form, block_date: value })} />
        <ModalInput label="Início" type="time" value={form.start_time} onChange={(value) => setForm({ ...form, start_time: value })} />
        <ModalInput label="Fim" type="time" value={form.end_time} onChange={(value) => setForm({ ...form, end_time: value })} />
        <label className="md:col-span-2"><span className="text-sm font-bold text-slate-700">Observações</span><textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none" /></label>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-3">
        <ActionButton label="Cancelar bloqueio" danger onClick={() => onCancel(block.id)} />
        <ActionButton label="Fechar" onClick={onClose} />
        <ActionButton label="Salvar" primary onClick={() => onSave(form)} />
      </div>
    </ModalShell>
  );
}

function BookingList({ bookings, onOpen, onStatus, onCancel }: { bookings: Booking[]; onOpen: (booking: Booking) => void; onStatus: (id: string, status: string) => void; onCancel: (id: string) => void }) {
  const sorted = [...bookings].sort((a, b) => `${b.booking_date} ${b.start_time}`.localeCompare(`${a.booking_date} ${a.start_time}`));
  return (
    <ListSection title="Lista de reservas">
      {sorted.length === 0 && <EmptyState text="Nenhuma reserva avulsa cadastrada." />}
      {sorted.map((booking) => (
        <div
          key={booking.id}
          className={
            booking.status === "aguardando_sinal"
              ? "rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5 shadow-xl shadow-black/10"
              : "rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-xl shadow-black/10"
          }
        >
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <button type="button" onClick={() => onOpen(booking)} className="flex-1 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-slate-950">{booking.customer_name}</h3>
                <StatusBadge status={booking.status} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {getFieldName(booking.fields)} • {formatDate(booking.booking_date)} • {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
              </p>
              <p className="mt-1 text-sm font-bold text-emerald-700">R$ {formatMoney(booking.amount)}</p>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {booking.status === "aguardando_sinal" && (
                <QuickAction
                  label="Confirmar sinal"
                  icon={<CheckCircle2 size={16} />}
                  onClick={() => onStatus(booking.id, "confirmada")}
                />
              )}
              <QuickAction label="Confirmar" icon={<CheckCircle2 size={16} />} onClick={() => onStatus(booking.id, "confirmada")} />
              <QuickAction label="Check-in" icon={<PlayCircle size={16} />} onClick={() => onStatus(booking.id, "em_andamento")} />
              <QuickAction label="Concluir" icon={<CheckCircle2 size={16} />} onClick={() => onStatus(booking.id, "concluida")} />
              <button onClick={() => onOpen(booking)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><Edit3 size={16} /></button>
              {booking.status !== "cancelada" && <button onClick={() => onCancel(booking.id)} className="rounded-xl border border-red-500/30 px-3 py-2 text-red-300 transition hover:bg-red-500/10"><Trash2 size={16} /></button>}
            </div>
          </div>
        </div>
      ))}
    </ListSection>
  );
}

function RecurringList({
  bookings,
  pendingRequests,
  onOpen,
  onStatus,
  onDisable,
  onApprove,
  onReject,
}: {
  bookings: RecurringBooking[];
  pendingRequests: RecurringBooking[];
  onOpen: (booking: RecurringBooking) => void;
  onStatus: (id: string, status: string) => void;
  onDisable: (id: string) => void;
  onApprove: (booking: RecurringBooking) => void;
  onReject: (id: string) => void;
}) {
  const activeAndPaused = bookings.filter(
    (booking) => booking.status !== "pending" && booking.approval_status !== "pending"
  );

  return (
    <div className="space-y-8">
      <ListSection title="Solicitações pendentes">
        {pendingRequests.length === 0 && (
          <EmptyState text="Nenhuma solicitação de reserva fixa pendente." />
        )}

        {pendingRequests.map((booking) => (
          <div
            key={booking.id}
            className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 p-5 shadow-xl shadow-black/10"
          >
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <button type="button" onClick={() => onOpen(booking)} className="flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">{booking.customer_name}</h3>

                  <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-bold text-yellow-200">
                    Aguardando aprovação
                  </span>

                  {booking.source === "public_link" && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Link público
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-slate-600">
                  {getFieldName(booking.fields)} • {getWeekdayLabel(booking.weekday)} •{" "}
                  {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Início: {formatDate(booking.start_date)}
                  {booking.requested_at
                    ? ` • Solicitado em ${formatDate(booking.requested_at.slice(0, 10))}`
                    : ""}
                </p>

                {booking.notes && <p className="mt-2 text-sm text-slate-500">{booking.notes}</p>}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApprove(booking)}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-black"
                >
                  Aprovar
                </button>

                <button
                  type="button"
                  onClick={() => onReject(booking.id)}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300"
                >
                  Recusar
                </button>

                <button
                  type="button"
                  onClick={() => onOpen(booking)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Edit3 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </ListSection>

      <ListSection title="Reservas fixas / mensalistas">
        {activeAndPaused.length === 0 && (
          <EmptyState text="Nenhum mensalista ou reserva fixa cadastrada." />
        )}

        {activeAndPaused.map((booking) => (
          <div
            key={booking.id}
            className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-xl shadow-black/10"
          >
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <button type="button" onClick={() => onOpen(booking)} className="flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-slate-950">{booking.customer_name}</h3>
                  <StatusBadge status={booking.status} />

                  {booking.billing_type === "monthly" && (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Mensalista
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm text-slate-500">
                  {getFieldName(booking.fields)} • {getWeekdayLabel(booking.weekday)} •{" "}
                  {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
                </p>

                {booking.billing_type === "monthly" && (
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    R$ {formatMoney(booking.monthly_amount || 0)} • vence dia{" "}
                    {booking.due_day || 15} • {booking.payment_status || "pending"}
                  </p>
                )}
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <QuickAction
                  label="Ativar"
                  icon={<CheckCircle2 size={16} />}
                  onClick={() => onStatus(booking.id, "active")}
                />

                <QuickAction
                  label="Pausar"
                  icon={<Ban size={16} />}
                  onClick={() => onStatus(booking.id, "paused")}
                />

                <button
                  type="button"
                  onClick={() => onOpen(booking)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <Edit3 size={16} />
                </button>

                {booking.status === "active" && (
                  <button
                    type="button"
                    onClick={() => onDisable(booking.id)}
                    className="rounded-xl border border-red-500/30 px-3 py-2 text-red-300 transition hover:bg-red-500/10"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </ListSection>
    </div>
  );
}


function BookingActionModal({ booking, fields, onClose, onSave, onStatus, onCancel }: { booking: Booking; fields: Field[]; onClose: () => void; onSave: (booking: Booking) => void; onStatus: (id: string, status: string) => void; onCancel: (id: string) => void }) {
  const [form, setForm] = useState<Booking>({ ...booking, start_time: booking.start_time.slice(0, 5), end_time: booking.end_time.slice(0, 5), notes: booking.notes || "" });

  return (
    <ModalShell title="Gerenciar reserva" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModalInput label="Cliente" value={form.customer_name} onChange={(value) => setForm({ ...form, customer_name: value })} />
        <ModalInput label="WhatsApp" value={form.customer_whatsapp?.replace(/^55/, "") || ""} onChange={(value) => setForm({ ...form, customer_whatsapp: value.replace(/\D/g, "") })} />
        <ModalSelect label="Quadra" value={form.field_id} onChange={(value) => setForm({ ...form, field_id: value })} options={fields.map((field) => ({ value: field.id, label: field.name }))} />
        <ModalInput label="Data" type="date" value={form.booking_date} onChange={(value) => setForm({ ...form, booking_date: value })} />
        <ModalInput label="Início" type="time" value={form.start_time} onChange={(value) => setForm({ ...form, start_time: value })} />
        <ModalInput label="Fim" type="time" value={form.end_time} onChange={(value) => setForm({ ...form, end_time: value })} />
        <ModalInput label="Valor" value={String(form.amount || "")} onChange={(value) => setForm({ ...form, amount: Number(value.replace(",", ".") || 0) })} />
        <ModalSelect label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[...statusOptions, { value: "em_andamento", label: "Em andamento" }]} />
        <label className="md:col-span-2"><span className="text-sm font-bold text-slate-700">Observações</span><textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none" /></label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-5">
        <ActionButton label="Confirmar" onClick={() => onStatus(booking.id, "confirmada")} />
        <ActionButton label="Check-in" onClick={() => onStatus(booking.id, "em_andamento")} />
        <ActionButton label="Concluir" onClick={() => onStatus(booking.id, "concluida")} />
        <ActionButton label="Cancelar" danger onClick={() => onCancel(booking.id)} />
        <ActionButton label="Salvar" primary onClick={() => onSave(form)} />
      </div>
    </ModalShell>
  );
}

function RecurringActionModal({ booking, fields, onClose, onSave, onStatus, onDisable }: { booking: RecurringBooking; fields: Field[]; onClose: () => void; onSave: (booking: RecurringBooking) => void; onStatus: (id: string, status: string) => void; onDisable: (id: string) => void }) {
  const [form, setForm] = useState<RecurringBooking>({ ...booking, start_time: booking.start_time.slice(0, 5), end_time: booking.end_time.slice(0, 5), notes: booking.notes || "" });

  return (
    <ModalShell title="Gerenciar reserva fixa / mensalista" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ModalInput label="Cliente" value={form.customer_name} onChange={(value) => setForm({ ...form, customer_name: value })} />
        <ModalInput label="WhatsApp" value={form.customer_whatsapp?.replace(/^55/, "") || ""} onChange={(value) => setForm({ ...form, customer_whatsapp: value.replace(/\D/g, "") })} />
        <ModalSelect label="Quadra" value={form.field_id} onChange={(value) => setForm({ ...form, field_id: value })} options={fields.map((field) => ({ value: field.id, label: field.name }))} />
        <ModalSelect label="Dia da semana" value={String(form.weekday)} onChange={(value) => setForm({ ...form, weekday: Number(value) })} options={weekdayOptions} />
        <ModalInput label="Início" type="time" value={form.start_time} onChange={(value) => setForm({ ...form, start_time: value })} />
        <ModalInput label="Fim" type="time" value={form.end_time} onChange={(value) => setForm({ ...form, end_time: value })} />
        <ModalInput label="Data início" type="date" value={form.start_date} onChange={(value) => setForm({ ...form, start_date: value })} />
        <ModalInput label="Data final" type="date" value={form.end_date || ""} onChange={(value) => setForm({ ...form, end_date: value || null })} />
        <ModalSelect label="Cobrança" value={form.billing_type || "weekly"} onChange={(value) => setForm({ ...form, billing_type: value })} options={[{ value: "weekly", label: "Semanal / bloquear horário" }, { value: "monthly", label: "Mensalista" }]} />
        <ModalInput label="Valor mensal" value={String(form.monthly_amount || "")} onChange={(value) => setForm({ ...form, monthly_amount: Number(value.replace(",", ".") || 0) })} />
        <ModalInput label="Dia vencimento" type="number" value={String(form.due_day || 15)} onChange={(value) => setForm({ ...form, due_day: Number(value || 15) })} />
        <ModalInput label="Pago" value={String(form.paid_amount || 0)} onChange={(value) => setForm({ ...form, paid_amount: Number(value.replace(",", ".") || 0) })} />
        <ModalSelect label="Status pagamento" value={form.payment_status || "pending"} onChange={(value) => setForm({ ...form, payment_status: value })} options={[{ value: "pending", label: "Pendente" }, { value: "paid", label: "Pago" }, { value: "partial", label: "Parcial" }]} />
        <ModalSelect label="Status" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={[{ value: "active", label: "Ativa" }, { value: "paused", label: "Pausada" }, { value: "inactive", label: "Inativa" }]} />
        <label className="md:col-span-2"><span className="text-sm font-bold text-slate-700">Observações</span><textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none" /></label>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">
        <ActionButton label="Ativar" onClick={() => onStatus(booking.id, "active")} />
        <ActionButton label="Pausar" onClick={() => onStatus(booking.id, "paused")} />
        <ActionButton label="Desativar" danger onClick={() => onDisable(booking.id)} />
        <ActionButton label="Salvar" primary onClick={() => onSave(form)} />
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-black/50">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div><p className="text-sm font-bold text-emerald-600">Ações operacionais</p><h2 className="text-2xl font-black text-slate-950">{title}</h2></div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="text-sm font-bold text-slate-700">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>;
}

function ModalSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: SelectOption[] }) {
  return <label><span className="text-sm font-bold text-slate-700">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-emerald-500/40 hover:bg-emerald-50">{icon}{label}</button>;
}

function ActionButton({ label, onClick, primary, danger }: { label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={primary ? "rounded-xl bg-slate-950 px-4 py-3 font-black text-white" : danger ? "rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-bold text-red-300" : "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-bold text-slate-950"}>{label}</button>;
}

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = { pendente: "Pendente", aguardando_sinal: "Aguardando sinal", confirmada: "Confirmada", em_andamento: "Check-in", concluida: "Concluída", cancelada: "Cancelada", active: "Ativa", paused: "Pausada", inactive: "Inativa", pending: "Pendente", rejected: "Recusada", approved: "Aprovada" };
  const tone = status === "cancelada" || status === "inactive" ? "bg-red-500/10 text-red-300" : status === "concluida" || status === "confirmada" || status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-yellow-500/10 text-yellow-300";
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone}`}>{label[status] || status}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-slate-500">{text}</div>;
}

function SummaryView({ todayCount, recurringCount, dayTotal, monthlyCount }: { todayCount: number; recurringCount: number; dayTotal: number; monthlyCount: number }) {
  return <div className="grid grid-cols-1 gap-5 md:grid-cols-4"><SummaryCard title="Reservas do dia" value={String(todayCount)} icon={<CalendarDays />} /><SummaryCard title="Fixas ativas" value={String(recurringCount)} icon={<Users />} /><SummaryCard title="Mensalistas" value={String(monthlyCount)} icon={<Wallet />} /><SummaryCard title="Total do dia" value={`R$ ${formatMoney(dayTotal)}`} icon={<Save />} /></div>;
}

function ListSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="space-y-3"><h2 className="text-2xl font-bold text-slate-950">{title}</h2>{children}</section>; }
function SummaryCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) { return <div className="rounded-3xl border border-slate-200 bg-white/80 p-5"><div className="mb-3 text-[#22C55E]">{icon}</div><p className="text-sm text-slate-500">{title}</p><h3 className="mt-1 text-3xl font-black text-slate-950">{value}</h3></div>; }
function BookingCard({ booking }: { booking: Booking }) { return <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3"><p className="font-bold text-slate-950">{booking.customer_name}</p><p className="text-xs text-slate-600">{booking.start_time.slice(0, 5)} até {booking.end_time.slice(0, 5)}</p><p className="text-xs font-bold text-emerald-700">R$ {formatMoney(booking.amount)}</p></div>; }
function RecurringCard({ booking }: { booking: RecurringBooking }) { return <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/15 p-3"><p className="font-bold text-slate-950">{booking.customer_name}</p><p className="text-xs text-slate-600">{booking.start_time.slice(0, 5)} até {booking.end_time.slice(0, 5)}</p><p className="text-xs font-bold text-indigo-300">FIXA</p></div>; }
function BlockCard({ block }: { block: ScheduleBlock }) { return <div className="rounded-xl border border-slate-500/40 bg-slate-500/15 p-3"><p className="font-bold text-slate-950">{block.title}</p><p className="text-xs text-slate-600">{block.start_time.slice(0, 5)} até {block.end_time.slice(0, 5)}</p><p className="text-xs font-bold text-slate-600">BLOQUEADO</p></div>; }
function SaveButton({ saving, label }: { saving: boolean; label: string }) { return <button disabled={saving} className="mt-6 flex items-center gap-2 rounded-xl bg-[#22C55E] px-6 py-3 font-bold text-black disabled:opacity-60"><Save size={18} />{saving ? "Salvando..." : label}</button>; }
function Input({ label, name, value, onChange, type = "text", placeholder = "" }: { label: string; name: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>; type?: string; placeholder?: string }) { return <label><span className="text-sm font-medium text-slate-700">{label}</span><input name={name} type={type} value={value} placeholder={placeholder} onChange={onChange} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none" /></label>; }
function Textarea({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> }) { return <label className="md:col-span-2"><span className="text-sm font-medium text-slate-700">{label}</span><textarea name={name} value={value} onChange={onChange} className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none" /></label>; }
function WhatsappInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <label><span className="text-sm font-medium text-slate-700">WhatsApp</span><div className="mt-2 flex overflow-hidden rounded-xl border border-slate-200 bg-white"><span className="flex items-center border-r border-slate-200 px-4 font-bold text-[#22C55E]">+55</span><input value={value.replace(/^55/, "")} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^55/, ""))} className="w-full bg-transparent p-3 text-slate-950 outline-none" /></div></label>; }
function Select({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>; options: SelectOption[] }) { return <label><span className="text-sm font-medium text-slate-700">{label}</span><select name={name} value={value} onChange={onChange} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-slate-950 outline-none"><option value="">Selecione</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }

function getView(value: string | null): View { if (value === "nova" || value === "fixa" || value === "lista" || value === "fixas" || value === "resumo" || value === "bloqueios") return value; return "agenda"; }
function filterCustomers(customers: Customer[], search: string, type: "name" | "whatsapp") { const text = search.toLowerCase().trim(); const number = search.replace(/\D/g, ""); if (!search) return customers.slice(0, 6); return customers.filter((customer) => type === "name" ? customer.name.toLowerCase().includes(text) : customer.whatsapp.includes(number)).slice(0, 8); }
function timeToMinutes(time: string) { const [h, m] = time.split(":").map(Number); return h * 60 + m; }
function minutesToTime(total: number) { return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; }
function addMinutesToTime(time: string, minutes: number) { return minutesToTime(timeToMinutes(time) + minutes); }
function hasConflictAt(bookings: Booking[], recurring: RecurringBooking[], blocks: ScheduleBlock[], fieldId: string, date: string, start: number, end: number) { const normal = bookings.some((b) => b.field_id === fieldId && b.booking_date === date && b.status !== "cancelada" && start < timeToMinutes(b.end_time.slice(0, 5)) && end > timeToMinutes(b.start_time.slice(0, 5))); const fixed = getRecurringBookingsForDate(recurring, date, fieldId).some((b) => start < timeToMinutes(b.end_time.slice(0, 5)) && end > timeToMinutes(b.start_time.slice(0, 5))); const blocked = blocks.some((b) => b.field_id === fieldId && b.block_date === date && b.status === "active" && start < timeToMinutes(b.end_time.slice(0, 5)) && end > timeToMinutes(b.start_time.slice(0, 5))); return normal || fixed || blocked; }
function getBookingAtTime(bookings: Booking[], fieldId: string, date: string, time: string) { return bookings.find((b) => b.field_id === fieldId && b.booking_date === date && b.status !== "cancelada" && b.start_time.slice(0, 5) === time); }
function getRecurringAtTime(bookings: RecurringBooking[], fieldId: string, time: string) { return bookings.find((b) => b.field_id === fieldId && b.status === "active" && b.start_time.slice(0, 5) === time); }
function getBlockAtTime(blocks: ScheduleBlock[], fieldId: string, date: string, time: string) { return blocks.find((b) => b.field_id === fieldId && b.block_date === date && b.status === "active" && b.start_time.slice(0, 5) === time); }
function isTimeInsideBooking(bookings: Booking[], fieldId: string, date: string, time: string) { const current = timeToMinutes(time); return bookings.some((b) => b.field_id === fieldId && b.booking_date === date && b.status !== "cancelada" && current > timeToMinutes(b.start_time.slice(0, 5)) && current < timeToMinutes(b.end_time.slice(0, 5))); }
function isTimeInsideRecurring(bookings: RecurringBooking[], fieldId: string, time: string) { const current = timeToMinutes(time); return bookings.some((b) => b.field_id === fieldId && b.status === "active" && current > timeToMinutes(b.start_time.slice(0, 5)) && current < timeToMinutes(b.end_time.slice(0, 5))); }
function isTimeInsideBlock(blocks: ScheduleBlock[], fieldId: string, date: string, time: string) { const current = timeToMinutes(time); return blocks.some((b) => b.field_id === fieldId && b.block_date === date && b.status === "active" && current > timeToMinutes(b.start_time.slice(0, 5)) && current < timeToMinutes(b.end_time.slice(0, 5))); }
function getRecurringBookingsForDate(bookings: RecurringBooking[], date: string, fieldId?: string) { const weekday = new Date(`${date}T00:00:00`).getDay(); return bookings.filter((b) => b.status === "active" && (!fieldId || b.field_id === fieldId) && b.weekday === weekday && date >= b.start_date && (!b.end_date || date <= b.end_date)); }
function buildNextDueDate(startDate: string, dueDay: number) { const base = new Date(`${startDate}T00:00:00`); const due = new Date(base.getFullYear(), base.getMonth() + 1, dueDay); return due.toISOString().slice(0, 10); }
function isPaidBooking(booking: Booking) { return booking.status === "confirmada" || booking.status === "concluida"; }
function getFieldName(fields: FieldRelation) { if (!fields) return "Quadra"; if (Array.isArray(fields)) return fields[0]?.name || "Quadra"; return fields.name || "Quadra"; }
function getWeekdayLabel(weekday: number) { return ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"][weekday] || "Dia"; }
function getReasonLabel(reason: string) { const labels: Record<string, string> = { manual: "Manual", maintenance: "Manutenção", event: "Evento", championship: "Campeonato", holiday: "Feriado", unavailable: "Indisponível" }; return labels[reason] || reason; }
function formatMoney(value: string | number) { return Number(value || 0).toFixed(2).replace(".", ","); }
function formatDate(date: string) { const [year, month, day] = date.split("-"); return `${day}/${month}/${year}`; }

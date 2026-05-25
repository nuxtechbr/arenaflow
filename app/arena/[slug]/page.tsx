"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  Navigation,
  ExternalLink,
  Camera,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";

type Arena = {
  id: string;
  name: string;
  slug: string;
  whatsapp: string | null;
  phone: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  maps_url: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

type ArenaSettings = {
  require_deposit: boolean | null;
  deposit_amount_type: "fixed" | "percentage" | null;
  deposit_fixed_amount: number | null;
  deposit_percentage: number | null;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_receiver_name: string | null;
  receipt_whatsapp: string | null;
  deposit_message: string | null;
};

type GalleryImage = {
  id: string;
  image_url: string;
  image_order: number;
};

type ArenaRule = {
  id: string;
  rule_text: string;
  is_active: boolean;
};

type OpeningHour = {
  weekday: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
};

type Field = {
  id: string;
  name: string;
  sport: string | null;
  surface: string | null;
  photo_url: string | null;
  status: string;
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
  arena_id: string;
  field_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number;
  status: string;
  notes: string | null;
  fields?: FieldRelation;
};

type RecurringBooking = {
  id: string;
  field_id: string;
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
  payment_status: string | null;
  paid_amount: number | null;
  next_due_date: string | null;
  fields?: FieldRelation;
};

type ScheduleBlock = {
  id: string;
  field_id: string | null;
  title: string;
  block_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

type Customer = {
  id: string;
  name: string;
  whatsapp: string;
};

type FieldRelation = { name: string } | { name: string }[] | null | undefined;
type PublicTab = "avulsa" | "fixa" | "minhas" | "info";

const weekDays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const durationLabels: Record<number, string> = {
  30: "30 min",
  60: "1 hora",
  90: "1h30",
  120: "2 horas",
  150: "2h30",
  180: "3 horas",
};

const today = new Date().toISOString().slice(0, 10);

export default function PublicArenaPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [arena, setArena] = useState<Arena | null>(null);
  const [settings, setSettings] = useState<ArenaSettings | null>(null);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [rules, setRules] = useState<ArenaRule[]>([]);
  const [hours, setHours] = useState<OpeningHour[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [pricingOptions, setPricingOptions] = useState<PricingOption[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [recurringBookings, setRecurringBookings] = useState<RecurringBooking[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);

  const [tab, setTab] = useState<PublicTab>("avulsa");

  const [fieldId, setFieldId] = useState("");
  const [pricingId, setPricingId] = useState("");
  const [bookingDate, setBookingDate] = useState(today);
  const [bookingTime, setBookingTime] = useState("");

  const [fixedFieldId, setFixedFieldId] = useState("");
  const [fixedWeekday, setFixedWeekday] = useState("1");
  const [fixedStartTime, setFixedStartTime] = useState("");
  const [fixedEndTime, setFixedEndTime] = useState("");
  const [fixedStartDate, setFixedStartDate] = useState(today);
  const [fixedNotes, setFixedNotes] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerWhatsapp, setCustomerWhatsapp] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [createdBooking, setCreatedBooking] = useState<Booking | null>(null);
  const [fixedCreated, setFixedCreated] = useState(false);

  const [myWhatsapp, setMyWhatsapp] = useState("");
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [myRecurring, setMyRecurring] = useState<RecurringBooking[]>([]);
  const [searchingMine, setSearchingMine] = useState(false);
  const [myOtpCode, setMyOtpCode] = useState("");
  const [myOtpSent, setMyOtpSent] = useState(false);
  const [myAuthenticated, setMyAuthenticated] = useState(false);

  useEffect(() => {
    loadArena();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (fields.length > 0) {
      if (!fieldId) setFieldId(fields[0].id);
      if (!fixedFieldId) setFixedFieldId(fields[0].id);
    }
  }, [fields, fieldId, fixedFieldId]);

  useEffect(() => {
    const first = pricingOptions.find((item) => item.field_id === fieldId && item.is_active);
    setPricingId(first?.id || "");
    setBookingTime("");
  }, [fieldId, pricingOptions]);

  useEffect(() => {
    setBookingTime("");
  }, [bookingDate, pricingId]);

  const selectedPricing = useMemo(
    () => pricingOptions.find((item) => item.id === pricingId) || null,
    [pricingOptions, pricingId]
  );

  const selectedField = useMemo(
    () => fields.find((item) => item.id === fieldId) || null,
    [fields, fieldId]
  );

  const bookingAmount = useMemo(() => {
    if (!selectedPricing) return 0;
    const date = new Date(`${bookingDate}T00:00:00`);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return Number(weekend && selectedPricing.weekend_price ? selectedPricing.weekend_price : selectedPricing.price);
  }, [selectedPricing, bookingDate]);

  const depositAmount = useMemo(() => {
    if (!settings?.require_deposit) return 0;
    if (settings.deposit_amount_type === "percentage") {
      return bookingAmount * (Number(settings.deposit_percentage || 0) / 100);
    }
    return Number(settings.deposit_fixed_amount || 0);
  }, [settings, bookingAmount]);

  const bookingEndTime = useMemo(() => {
    if (!bookingTime || !selectedPricing) return "";
    return addMinutesToTime(bookingTime, selectedPricing.duration_minutes);
  }, [bookingTime, selectedPricing]);

  const availableTimes = useMemo(() => {
    if (!fieldId || !selectedPricing || !bookingDate) return [];

    const weekday = new Date(`${bookingDate}T00:00:00`).getDay();
    const opening = hours.find((item) => item.weekday === weekday);

    if (!opening?.is_open || !opening.open_time || !opening.close_time) return [];

    const open = timeToMinutes(opening.open_time.slice(0, 5));
    const close = timeToMinutes(opening.close_time.slice(0, 5));
    const duration = selectedPricing.duration_minutes;
    const times: string[] = [];

    for (let current = open; current + duration <= close; current += 30) {
      const start = current;
      const end = current + duration;

      if (!hasConflictAt(bookings, recurringBookings, blocks, fieldId, bookingDate, start, end)) {
        times.push(minutesToTime(current));
      }
    }

    return times;
  }, [fieldId, selectedPricing, bookingDate, hours, bookings, recurringBookings, blocks]);

  const coverImage = arena?.cover_url || gallery[0]?.image_url || "";
  const activeRules = rules.filter((rule) => rule.is_active);
  const socialInstagram = arena?.instagram ? normalizeSocialUrl(arena.instagram, "instagram") : "";
  const socialFacebook = arena?.facebook ? normalizeSocialUrl(arena.facebook, "facebook") : "";

  async function loadArena() {
    setLoading(true);

    const { data: arenaData, error: arenaError } = await supabase
      .from("arenas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (arenaError) console.error(arenaError);

    if (!arenaData) {
      setArena(null);
      setLoading(false);
      return;
    }

    const arenaId = String(arenaData.id);
    setArena(arenaData as Arena);

    const [
      settingsRes,
      galleryRes,
      rulesRes,
      hoursRes,
      fieldsRes,
      bookingsRes,
      recurringRes,
      blocksRes,
    ] = await Promise.all([
      supabase.from("arena_settings").select("*").eq("arena_id", arenaId).maybeSingle(),
      supabase.from("arena_gallery").select("id, image_url, image_order").eq("arena_id", arenaId).order("image_order", { ascending: true }),
      supabase.from("arena_rules").select("id, rule_text, is_active").eq("arena_id", arenaId).eq("is_active", true).order("created_at", { ascending: true }),
      supabase.from("arena_opening_hours").select("weekday, is_open, open_time, close_time").eq("arena_id", arenaId).order("weekday", { ascending: true }),
      supabase.from("fields").select("id, name, sport, surface, photo_url, status").eq("arena_id", arenaId).or("status.is.null,status.eq.active,status.eq.ativo,status.eq.available,status.eq.disponivel").order("created_at", { ascending: true }),
      supabase.from("bookings").select("*, fields(name)").eq("arena_id", arenaId).neq("status", "cancelada").gte("booking_date", today),
      supabase.from("recurring_bookings").select("*, fields(name)").eq("arena_id", arenaId).in("status", ["active", "pending"]),
      supabase.from("schedule_blocks").select("id, field_id, title, block_date, start_time, end_time, status").eq("arena_id", arenaId).eq("status", "active").gte("block_date", today),
    ]);

    const loadedFields = (fieldsRes.data || []) as Field[];

    setSettings((settingsRes.data || null) as ArenaSettings | null);
    setGallery((galleryRes.data || []) as GalleryImage[]);
    setRules((rulesRes.data || []) as ArenaRule[]);
    setHours((hoursRes.data || []) as OpeningHour[]);
    setFields(loadedFields);
    setBookings((bookingsRes.data || []) as Booking[]);
    setRecurringBookings((recurringRes.data || []) as RecurringBooking[]);
    setBlocks((blocksRes.data || []) as ScheduleBlock[]);

    if (loadedFields.length > 0) {
      const { data: prices } = await supabase
        .from("field_pricing_options")
        .select("*")
        .in("field_id", loadedFields.map((field) => field.id))
        .eq("is_active", true)
        .order("duration_minutes", { ascending: true });

      setPricingOptions((prices || []) as PricingOption[]);
    } else {
      setPricingOptions([]);
    }

    setLoading(false);
  }

  async function createOrFindCustomer(): Promise<Customer | null> {
    if (!arena) return null;

    const clean = customerWhatsapp.replace(/\D/g, "");
    const fullWhatsapp = clean.startsWith("55") ? clean : `55${clean}`;

    const { data: existing } = await supabase
      .from("customers")
      .select("id, name, whatsapp")
      .eq("arena_id", arena.id)
      .eq("whatsapp", fullWhatsapp)
      .maybeSingle();

    if (existing) return existing as Customer;

    const { data, error } = await supabase
      .from("customers")
      .insert({
  arena_id: arena.id,
  name: customerName.trim(),
  whatsapp: fullWhatsapp,
  email: customerEmail.trim() || null,
})
      .select("id, name, whatsapp")
      .single();

    if (error) {
      alert(error.message);
      return null;
    }

    return data as Customer;
  }

  async function submitBooking(event: React.FormEvent) {
    event.preventDefault();

    if (!arena) return;
    if (!fieldId || !selectedPricing || !bookingDate || !bookingTime) {
      return alert("Escolha quadra, duração, data e horário.");
    }

    if (!customerName.trim()) return alert("Informe seu nome.");
    if (customerWhatsapp.replace(/\D/g, "").length < 10) return alert("Informe um WhatsApp válido.");

    const start = timeToMinutes(bookingTime);
    const end = timeToMinutes(bookingEndTime);

    if (hasConflictAt(bookings, recurringBookings, blocks, fieldId, bookingDate, start, end)) {
      return alert("Esse horário acabou de ficar indisponível. Escolha outro horário.");
    }

    setSaving(true);

    const customer = await createOrFindCustomer();

    if (!customer) {
      setSaving(false);
      return;
    }

    const status = settings?.require_deposit ? "aguardando_sinal" : "pendente";

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        arena_id: arena.id,
        field_id: fieldId,
        pricing_option_id: selectedPricing.id,
        duration_minutes: selectedPricing.duration_minutes,
        customer_id: customer.id,
        customer_name: customerName.trim(),
        customer_whatsapp: customer.whatsapp,
        booking_date: bookingDate,
        start_time: bookingTime,
        end_time: bookingEndTime,
        amount: bookingAmount,
        status,
        source: "public_link",
        notes: settings?.require_deposit
          ? `Reserva solicitada pelo link público. Sinal previsto: R$ ${formatMoney(depositAmount)}`
          : "Reserva solicitada pelo link público.",
      })
      .select("*, fields(name)")
      .single();

    setSaving(false);

    if (error) return alert(error.message);

    const created = data as Booking;
    setCreatedBooking(created);
    setBookings((current) => [...current, created]);
  }

  async function submitFixedBooking(event: React.FormEvent) {
    event.preventDefault();

    if (!arena) return;
    if (!fixedFieldId) return alert("Escolha uma quadra.");
    if (!fixedStartTime || !fixedEndTime) return alert("Informe horário inicial e final.");
    if (!fixedStartDate) return alert("Informe a data de início.");
    if (timeToMinutes(fixedEndTime) <= timeToMinutes(fixedStartTime)) {
      return alert("O horário final precisa ser maior que o inicial.");
    }

    if (!customerName.trim()) return alert("Informe seu nome.");
    if (customerWhatsapp.replace(/\D/g, "").length < 10) return alert("Informe um WhatsApp válido.");

    setSaving(true);

    const customer = await createOrFindCustomer();

    if (!customer) {
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("recurring_bookings").insert({
      arena_id: arena.id,
      field_id: fixedFieldId,
      customer_id: customer.id,
      customer_name: customerName.trim(),
      customer_whatsapp: customer.whatsapp,
      weekday: Number(fixedWeekday),
      start_time: fixedStartTime,
      end_time: fixedEndTime,
      start_date: fixedStartDate,
      end_date: null,
      status: "pending",
      source: "public_link",
      approval_status: "pending",
      requested_at: new Date().toISOString(),
      billing_type: "weekly",
      payment_mode: "no_entry",
      monthly_amount: null,
      notes:
        fixedNotes ||
        "Solicitação de reserva fixa enviada pelo link público. A arena precisa aprovar e combinar valores pelo WhatsApp.",
    });

    setSaving(false);

    if (error) return alert(error.message);

    setFixedCreated(true);
  }

  async function loadMyReservations(event: React.FormEvent) {
    event.preventDefault();

    if (!arena) return;
    const clean = myWhatsapp.replace(/\D/g, "");
    if (clean.length < 10) return alert("Digite um WhatsApp válido.");

    const fullWhatsapp = clean.startsWith("55") ? clean : `55${clean}`;

    setSearchingMine(true);

    if (!myAuthenticated && !myOtpSent) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error } = await supabase.from("customer_login_codes").insert({
        arena_id: arena.id,
        whatsapp: fullWhatsapp,
        code,
        expires_at: expiresAt,
      });

      setSearchingMine(false);

      if (error) return alert(error.message);

      alert(`Código de acesso: ${code}\n\n(temporário em modo MVP; depois enviaremos via WhatsApp automático)`);
      setMyOtpSent(true);
      return;
    }

    if (!myAuthenticated) {
      if (!myOtpCode) {
        setSearchingMine(false);
        return alert("Digite o código recebido.");
      }

      const { data: otpRows, error: otpError } = await supabase
        .from("customer_login_codes")
        .select("*")
        .eq("arena_id", arena.id)
        .eq("whatsapp", fullWhatsapp)
        .eq("code", myOtpCode)
        .is("used_at", null)
        .gte("expires_at", new Date().toISOString())
        .limit(1);

      if (otpError || !otpRows || otpRows.length === 0) {
        setSearchingMine(false);
        return alert("Código inválido ou expirado.");
      }

      await supabase.from("customer_login_codes").update({ used_at: new Date().toISOString() }).eq("id", otpRows[0].id);
      setMyAuthenticated(true);
    }

    const [bookingRes, recurringRes] = await Promise.all([
      supabase.from("bookings").select("*, fields(name)").eq("arena_id", arena.id).eq("customer_whatsapp", fullWhatsapp).order("booking_date", { ascending: false }),
      supabase.from("recurring_bookings").select("*, fields(name)").eq("arena_id", arena.id).eq("customer_whatsapp", fullWhatsapp).order("start_date", { ascending: false }),
    ]);

    setSearchingMine(false);

    if (bookingRes.error) return alert(bookingRes.error.message);
    if (recurringRes.error) return alert(recurringRes.error.message);

    setMyBookings((bookingRes.data || []) as Booking[]);
    setMyRecurring((recurringRes.data || []) as RecurringBooking[]);
  }

  function openArenaWhatsapp() {
    if (!arena?.whatsapp) return;
    window.open(`https://wa.me/${arena.whatsapp}`, "_blank");
  }

  function openBookingWhatsapp() {
    if (!arena || !createdBooking) return;

    const phone = settings?.receipt_whatsapp || arena.whatsapp || createdBooking.customer_whatsapp;

    const pixText = settings?.pix_key
      ? `\n\nChave Pix: ${settings.pix_key}${settings.pix_receiver_name ? `\nRecebedor: ${settings.pix_receiver_name}` : ""}`
      : "";

    const message = `Olá! Solicitei uma reserva pelo link da ${arena.name}.

Cliente: ${createdBooking.customer_name}
Quadra: ${getFieldName(createdBooking.fields)}
Data: ${formatDate(createdBooking.booking_date)}
Horário: ${createdBooking.start_time.slice(0, 5)} às ${createdBooking.end_time.slice(0, 5)}
Valor: R$ ${formatMoney(createdBooking.amount)}${
      settings?.require_deposit
        ? `\nSinal: R$ ${formatMoney(depositAmount)}${pixText}\n\nVou enviar o comprovante por aqui.`
        : ""
    }`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function openFixedWhatsapp() {
    if (!arena) return;

    const phone = arena.whatsapp || "";
    const field = fields.find((item) => item.id === fixedFieldId);

    const message = `Olá! Quero confirmar uma reserva fixa/mensalista na ${arena.name}.

Nome: ${customerName}
Quadra: ${field?.name || "Não informada"}
Dia: ${weekDays[Number(fixedWeekday)]}
Horário: ${fixedStartTime} às ${fixedEndTime}
Início: ${formatDate(fixedStartDate)}

${fixedNotes ? `Observação: ${fixedNotes}` : ""}`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
  }

  function scrollToBooking() {
    setTab("avulsa");
    document.getElementById("booking-area")?.scrollIntoView({ behavior: "smooth" });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07110D] text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/12 bg-white/[0.06] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando arena...
        </div>
      </main>
    );
  }

  if (!arena) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07110D] p-5 text-white">
        <div className="rounded-3xl border border-white/12 bg-[#101923] p-10 text-center shadow-2xl">
          <h1 className="text-3xl font-black">Arena não encontrada</h1>
          <p className="mt-2 text-slate-300">Verifique se o link está correto.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07110D] pb-24 text-white md:pb-0">
      <Hero
        arena={arena}
        coverImage={coverImage}
        instagram={socialInstagram}
        facebook={socialFacebook}
        onWhatsapp={openArenaWhatsapp}
        onReserve={scrollToBooking}
      />

      <ArenaGalleryShowcase
        images={gallery}
        coverImage={coverImage}
        arenaName={arena.name}
        onReserve={scrollToBooking}
      />

      <MobileFloatingActions arena={arena} instagram={socialInstagram} facebook={socialFacebook} onWhatsapp={openArenaWhatsapp} />

      <MobileNav tab={tab} setTab={setTab} />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:grid-cols-[1.12fr_0.88fr] md:px-8 md:py-12">
        <div className="space-y-6">
          <DesktopTabs tab={tab} setTab={setTab} />

          {tab === "avulsa" && (
            <BookingPanel
              fields={fields}
              pricingOptions={pricingOptions}
              selectedFieldId={fieldId}
              setSelectedFieldId={setFieldId}
              selectedPricingId={pricingId}
              setSelectedPricingId={setPricingId}
              selectedDate={bookingDate}
              setSelectedDate={setBookingDate}
              selectedTime={bookingTime}
              setSelectedTime={setBookingTime}
              selectedField={selectedField}
              selectedPricing={selectedPricing}
              amount={bookingAmount}
              endTime={bookingEndTime}
              availableTimes={availableTimes}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerWhatsapp={customerWhatsapp}
              setCustomerWhatsapp={setCustomerWhatsapp}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              settings={settings}
              depositAmount={depositAmount}
              createdBooking={createdBooking}
              saving={saving}
              onSubmit={submitBooking}
              onWhatsapp={openBookingWhatsapp}
              onNew={() => {
                setCreatedBooking(null);
                setBookingTime("");
              }}
              setTab={setTab}
            />
          )}

          {tab === "fixa" && (
            <FixedPanel
              fields={fields}
              fieldId={fixedFieldId}
              setFieldId={setFixedFieldId}
              weekday={fixedWeekday}
              setWeekday={setFixedWeekday}
              startTime={fixedStartTime}
              setStartTime={setFixedStartTime}
              endTime={fixedEndTime}
              setEndTime={setFixedEndTime}
              startDate={fixedStartDate}
              setStartDate={setFixedStartDate}
              notes={fixedNotes}
              setNotes={setFixedNotes}
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerWhatsapp={customerWhatsapp}
              setCustomerWhatsapp={setCustomerWhatsapp}
              created={fixedCreated}
              saving={saving}
              onSubmit={submitFixedBooking}
              onWhatsapp={openFixedWhatsapp}
              setTab={setTab}
            />
          )}

          {tab === "minhas" && (
            <MyReservationsPanel
              whatsapp={myWhatsapp}
              setWhatsapp={setMyWhatsapp}
              bookings={myBookings}
              recurring={myRecurring}
              loading={searchingMine}
              onSubmit={loadMyReservations}
              otpCode={myOtpCode}
              setOtpCode={setMyOtpCode}
              otpSent={myOtpSent}
              authenticated={myAuthenticated}
            />
          )}

          {tab === "info" && (
            <InfoPanel arena={arena} rules={activeRules} hours={hours} images={gallery} />
          )}
        </div>

        <aside className="space-y-6">
          <AboutCard arena={arena} instagram={socialInstagram} facebook={socialFacebook} />
          <LocationCard arena={arena} />
          <HoursCard hours={hours} />
          <RulesCard rules={activeRules} />
          <GalleryCard images={gallery} />
          <DepositCard settings={settings} />
        </aside>
      </section>

      <MobileBottomCTA onReserve={scrollToBooking} onWhatsapp={openArenaWhatsapp} />

      <footer className="border-t border-white/12 px-4 py-10 text-center text-sm text-slate-400">
        <p className="font-black text-white">{arena.name}</p>
        <p className="mt-2">Reserva online segura com ArenaFlow.</p>
      </footer>
    </main>
  );
}

function Hero({
  arena,
  coverImage,
  instagram,
  facebook,
  onWhatsapp,
  onReserve,
}: {
  arena: Arena;
  coverImage: string;
  instagram: string;
  facebook: string;
  onWhatsapp: () => void;
  onReserve: () => void;
}) {
  return (
    <section
      className="relative overflow-hidden border-b border-emerald-500/15 bg-[#07110D]"
      style={{
        backgroundImage: coverImage
          ? `linear-gradient(105deg, rgba(3,12,10,.96) 0%, rgba(3,12,10,.82) 46%, rgba(3,12,10,.40) 100%), url(${coverImage})`
          : "linear-gradient(135deg, #07110D 0%, #0B2B1F 55%, #049669 100%)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 pb-8 pt-5 md:px-8 md:pb-12 md:pt-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-white shadow-xl md:h-20 md:w-20">
              {arena.logo_url ? (
                <img src={arena.logo_url} alt={arena.name} className="h-full w-full object-cover" />
              ) : (
                <ShieldCheck className="text-emerald-400" size={30} />
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300 md:text-xs">
                Agendamento online
              </p>
              <h1 className="truncate text-2xl font-black md:text-4xl">{arena.name}</h1>
              {arena.address && (
                <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-300 md:text-sm">
                  <MapPin size={14} className="shrink-0 text-emerald-400" />
                  {arena.address}
                </p>
              )}
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {arena.maps_url && (
              <a href={arena.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-4 py-3 font-black text-white transition hover:border-emerald-400">
                <Navigation size={18} />
                Rota
              </a>
            )}

            {instagram && (
              <a href={instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-4 py-3 font-black text-white transition hover:border-emerald-400">
                <InstagramIcon size={18} />
                Insta
              </a>
            )}

            <button type="button" onClick={onWhatsapp} className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400">
              <MessageCircle size={18} />
              WhatsApp
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:mt-12 md:grid-cols-[1.05fr_.95fr] md:items-end">
          <div>
            <div className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/15 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-200">
              Escolha quadra, data e horário
            </div>

            <h2 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-6xl">
              Reserve seu horário em poucos cliques.
            </h2>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200 md:text-lg">
              {arena.description ||
                "Veja os horários disponíveis, escolha sua quadra e envie a solicitação direto para a arena."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onReserve}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-black text-white shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Agendar agora
                <ChevronRight size={20} />
              </button>

              {arena.whatsapp && (
                <button
                  type="button"
                  onClick={onWhatsapp}
                  className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-5 py-4 font-black text-white transition hover:border-emerald-400"
                >
                  <MessageCircle size={18} />
                  Tirar dúvida
                </button>
              )}

              {arena.maps_url && (
                <a
                  href={arena.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-5 py-4 font-black text-white transition hover:border-emerald-400"
                >
                  <MapPin size={18} />
                  Como chegar
                </a>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-500/20 bg-[#0B1411]/90 p-5 shadow-2xl shadow-black/40 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Pronto para reservar</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <HeroMetric icon={<CalendarDays />} title="1" text="Escolha a data" />
              <HeroMetric icon={<Clock />} title="2" text="Pegue o horário" />
              <HeroMetric icon={<CheckCircle2 />} title="3" text="Confirme" />
            </div>
            <button
              type="button"
              onClick={onReserve}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white transition hover:bg-emerald-400"
            >
              Ver horários disponíveis
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.08] p-3">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">{icon}</div>
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-300">{text}</p>
    </div>
  );
}

function ArenaGalleryShowcase({
  images,
  coverImage,
  arenaName,
  onReserve,
}: {
  images: GalleryImage[];
  coverImage: string;
  arenaName: string;
  onReserve: () => void;
}) {
  const photos = images.length > 0 ? images : coverImage ? [{ id: "cover", image_url: coverImage, image_order: 0 }] : [];

  if (photos.length === 0) return null;

  return (
    <section className="border-b border-white/12 bg-[#07110D]">
      <div className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">Fotos da arena</p>
            <h2 className="mt-1 text-2xl font-black text-white md:text-3xl">Conheça antes de reservar</h2>
          </div>

          <button
            type="button"
            onClick={onReserve}
            className="hidden rounded-2xl bg-emerald-500 px-5 py-3 font-black text-white md:block"
          >
            Reservar
          </button>
        </div>

        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden">
          {photos.slice(0, 8).map((image, index) => (
            <a
              key={image.id}
              href={image.image_url}
              target="_blank"
              rel="noreferrer"
              className={index === 0 ? "group relative h-56 min-w-[82%] overflow-hidden rounded-[2rem] border border-white/12 bg-[#0B1411] md:col-span-2 md:row-span-2 md:h-[390px] md:min-w-0" : "group relative h-56 min-w-[72%] overflow-hidden rounded-[2rem] border border-white/12 bg-[#0B1411] md:h-[188px] md:min-w-0"}
            >
              <img src={image.image_url} alt={`${arenaName} - foto ${index + 1}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-black text-white backdrop-blur">
                  Foto {index + 1}
                </span>
                <ExternalLink size={18} className="text-white" />
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingPanel(props: {
  fields: Field[];
  pricingOptions: PricingOption[];
  selectedFieldId: string;
  setSelectedFieldId: (value: string) => void;
  selectedPricingId: string;
  setSelectedPricingId: (value: string) => void;
  selectedDate: string;
  setSelectedDate: (value: string) => void;
  selectedTime: string;
  setSelectedTime: (value: string) => void;
  selectedField: Field | null;
  selectedPricing: PricingOption | null;
  amount: number;
  endTime: string;
  availableTimes: string[];
  customerName: string;
  setCustomerName: (value: string) => void;
  customerWhatsapp: string;
  setCustomerWhatsapp: (value: string) => void;
  customerEmail: string;
  setCustomerEmail: (value: string) => void;
  settings: ArenaSettings | null;
  depositAmount: number;
  createdBooking: Booking | null;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onWhatsapp: () => void;
  onNew: () => void;
  setTab: (tab: PublicTab) => void;
}) {
  const p = props;

  return (
    <section id="booking-area" className="rounded-[2rem] border border-emerald-500/20 bg-[#101923]/95 p-4 shadow-2xl shadow-black/30 md:p-7">
      <div className="rounded-[1.7rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/18 via-[#0B2A20] to-[#0B1411] p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">Agendamento online</p>
            <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">Reserve seu horário</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              Escolha quadra, duração, data e horário. Depois informe seus dados e envie a solicitação.
            </p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-black/20 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">Resumo</p>
            <p className="mt-1 text-lg font-black text-white">
              {p.selectedTime && p.endTime ? `${p.selectedTime} às ${p.endTime}` : "Horário não escolhido"}
            </p>
            <p className="text-sm font-black text-emerald-300">R$ {formatMoney(p.amount)}</p>
          </div>
        </div>
      </div>

      <ReservationTypeSwitch active="avulsa" setTab={p.setTab} />

      {p.createdBooking ? (
        <SuccessPanel
          booking={p.createdBooking}
          requireDeposit={Boolean(p.settings?.require_deposit)}
          depositAmount={p.depositAmount}
          pixKey={p.settings?.pix_key || ""}
          onWhatsapp={p.onWhatsapp}
          onNew={p.onNew}
        />
      ) : (
        <form onSubmit={p.onSubmit} className="mt-6 space-y-6">
          <StepHeader number="1" title="Escolha a quadra" description="Toque na quadra onde você quer jogar." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {p.fields.map((field) => (
              <FieldCard
                key={field.id}
                field={field}
                active={p.selectedFieldId === field.id}
                priceText={getMinimumPrice(p.pricingOptions, field.id)}
                onClick={() => p.setSelectedFieldId(field.id)}
              />
            ))}
          </div>

          <StepHeader number="2" title="Escolha duração e data" description="O sistema mostra apenas horários disponíveis." />
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Duração</Label>
              <SelectBox value={p.selectedPricingId} onChange={p.setSelectedPricingId}>
                <option value="">Selecione</option>
                {p.pricingOptions
                  .filter((option) => option.field_id === p.selectedFieldId)
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      {durationLabels[option.duration_minutes] || `${option.duration_minutes} min`} - R$ {formatMoney(option.price)}
                    </option>
                  ))}
              </SelectBox>
            </div>

            <div>
              <Label>Data</Label>
              <InputBox type="date" min={today} value={p.selectedDate} onChange={p.setSelectedDate} />
            </div>

            <div>
              <Label>Valor</Label>
              <div className="mt-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-sm text-slate-300">{p.selectedField?.name || "Escolha a quadra"}</p>
                <p className="mt-1 text-2xl font-black text-white">R$ {formatMoney(p.amount)}</p>
              </div>
            </div>
          </div>

          <StepHeader number="3" title="Escolha o horário" description="Horários ocupados, fixos e bloqueios não aparecem." />
          <div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {p.availableTimes.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-white/12 p-6 text-center text-sm text-slate-300">
                  Nenhum horário disponível para essa combinação.
                </div>
              )}

              {p.availableTimes.map((time) => (
                <button
                  type="button"
                  key={time}
                  onClick={() => p.setSelectedTime(time)}
                  className={
                    p.selectedTime === time
                      ? "rounded-2xl bg-emerald-500 px-4 py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20"
                      : "rounded-2xl border border-white/12 bg-[#0B1411] px-4 py-4 text-base font-black text-white transition hover:border-emerald-400 hover:bg-emerald-500/10"
                  }
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <StepHeader number="4" title="Seus dados" description="A arena usa seus dados para confirmar a reserva pelo WhatsApp." />
          <CustomerFields
            name={p.customerName}
            setName={p.setCustomerName}
            whatsapp={p.customerWhatsapp}
            setWhatsapp={p.setCustomerWhatsapp}
            email={p.customerEmail}
            setEmail={p.setCustomerEmail}
          />

          {p.settings?.require_deposit && (
            <div className="rounded-3xl border border-yellow-400/30 bg-yellow-400/10 p-5">
              <div className="flex items-start gap-3">
                <LockKeyhole className="mt-1 text-yellow-300" />
                <div>
                  <h3 className="font-black text-yellow-100">Sinal obrigatório</h3>
                  <p className="mt-1 text-sm text-yellow-100/80">Após solicitar a reserva, envie o comprovante no WhatsApp para confirmação.</p>
                  <p className="mt-2 text-2xl font-black text-white">Sinal: R$ {formatMoney(p.depositAmount)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="sticky bottom-20 z-20 rounded-[1.7rem] border border-white/12 bg-[#07110D]/95 p-3 backdrop-blur md:static md:bg-transparent md:p-0">
            <PrimaryButton disabled={p.saving}>
              {p.saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              {p.saving ? "Solicitando..." : "Solicitar reserva"}
            </PrimaryButton>
          </div>
        </form>
      )}
    </section>
  );
}

function StepHeader({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white">
        {number}
      </span>
      <div>
        <h3 className="text-lg font-black text-white">{title}</h3>
        <p className="mt-1 text-sm text-slate-300">{description}</p>
      </div>
    </div>
  );
}

function FixedPanel(props: {
  fields: Field[];
  fieldId: string;
  setFieldId: (value: string) => void;
  weekday: string;
  setWeekday: (value: string) => void;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  customerName: string;
  setCustomerName: (value: string) => void;
  customerWhatsapp: string;
  setCustomerWhatsapp: (value: string) => void;
  created: boolean;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onWhatsapp: () => void;
  setTab: (tab: PublicTab) => void;
}) {
  const p = props;

  return (
    <section className="rounded-[2rem] border border-white/12 bg-[#101923]/95 p-5 shadow-2xl shadow-black/20 md:p-7">
      <PanelHeader
        eyebrow="Reserva fixa"
        title="Solicitar horário recorrente"
        description="Ideal para quem joga toda semana ou quer fechar mensalista. A arena confirma valor e pagamento pelo WhatsApp."
      />

      <ReservationTypeSwitch active="fixa" setTab={p.setTab} />

      {p.created ? (
        <div className="mt-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-emerald-500 p-3 text-white">
              <CheckCircle2 />
            </div>
            <div>
              <h3 className="text-2xl font-black">Solicitação enviada!</h3>
              <p className="mt-2 text-slate-200">A arena vai confirmar sua reserva fixa, valor mensal, vencimento e forma de pagamento pelo WhatsApp.</p>
            </div>
          </div>

          <button type="button" onClick={p.onWhatsapp} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white">
            <MessageCircle />
            Falar com a arena
          </button>
        </div>
      ) : (
        <form onSubmit={p.onSubmit} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Quadra desejada</Label>
              <SelectBox value={p.fieldId} onChange={p.setFieldId}>
                <option value="">Selecione</option>
                {p.fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.name}
                  </option>
                ))}
              </SelectBox>
            </div>

            <div>
              <Label>Dia da semana</Label>
              <SelectBox value={p.weekday} onChange={p.setWeekday}>
                {weekDays.map((day, index) => (
                  <option key={day} value={String(index)}>
                    {day}
                  </option>
                ))}
              </SelectBox>
            </div>

            <div>
              <Label>Horário inicial</Label>
              <InputBox type="time" value={p.startTime} onChange={p.setStartTime} />
            </div>

            <div>
              <Label>Horário final</Label>
              <InputBox type="time" value={p.endTime} onChange={p.setEndTime} />
            </div>

            <div>
              <Label>Data para começar</Label>
              <InputBox type="date" min={today} value={p.startDate} onChange={p.setStartDate} />
            </div>

            <div>
              <Label>WhatsApp</Label>
              <WhatsappInput value={p.customerWhatsapp} onChange={p.setCustomerWhatsapp} />
            </div>

            <div className="md:col-span-2">
              <Label>Nome completo</Label>
              <InputBox value={p.customerName} onChange={p.setCustomerName} placeholder="Seu nome" />
            </div>

            <div className="md:col-span-2">
              <Label>Observação opcional</Label>
              <textarea
                value={p.notes}
                onChange={(event) => p.setNotes(event.target.value)}
                placeholder="Ex: quero fechar mensal, toda terça, posso pagar dia 15..."
                className="mt-2 min-h-28 w-full rounded-2xl border border-white/12 bg-[#0B1411] p-4 text-white outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          <PrimaryButton disabled={p.saving}>
            {p.saving ? <Loader2 className="animate-spin" /> : <CalendarDays />}
            {p.saving ? "Enviando..." : "Solicitar reserva fixa"}
          </PrimaryButton>
        </form>
      )}
    </section>
  );
}

function MyReservationsPanel({
  whatsapp,
  setWhatsapp,
  bookings,
  recurring,
  loading,
  onSubmit,
  otpCode,
  setOtpCode,
  otpSent,
  authenticated,
}: {
  whatsapp: string;
  setWhatsapp: (value: string) => void;
  bookings: Booking[];
  recurring: RecurringBooking[];
  loading: boolean;
  onSubmit: (event: React.FormEvent) => void;
  otpCode: string;
  setOtpCode: (value: string) => void;
  otpSent: boolean;
  authenticated: boolean;
}) {
  return (
    <section className="rounded-[2rem] border border-white/12 bg-[#101923]/95 p-5 shadow-2xl shadow-black/20 md:p-7">
      <PanelHeader
        eyebrow="Área do cliente"
        title="Minhas reservas"
        description="Digite seu WhatsApp para consultar reservas avulsas, fixas e mensalistas."
      />

      <form onSubmit={onSubmit} className="mt-6 rounded-3xl border border-white/12 bg-[#0B1411] p-5">
        <Label>WhatsApp</Label>
        <div className="mt-2 flex overflow-hidden rounded-2xl border border-white/12 bg-[#101923] focus-within:border-emerald-400">
          <span className="flex items-center border-r border-white/12 px-4 font-black text-emerald-400">+55</span>
          <input
            value={whatsapp}
            onChange={(event) => setWhatsapp(event.target.value.replace(/\D/g, "").replace(/^55/, ""))}
            placeholder="DDD + número"
            className="w-full bg-transparent p-4 text-white outline-none"
          />
        </div>

        {otpSent && !authenticated && (
          <div className="mt-4">
            <Label>Código de acesso</Label>
            <input
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ""))}
              placeholder="Digite o código"
              className="mt-2 w-full rounded-2xl border border-white/12 bg-[#101923] p-4 text-white outline-none"
            />
          </div>
        )}

        <button disabled={loading} className="mt-4 w-full rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white disabled:opacity-60">
          {loading ? "..." : otpSent && !authenticated ? "Entrar" : "Receber código"}
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {bookings.length === 0 && recurring.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/12 p-8 text-center text-slate-300">
            Suas reservas aparecerão aqui após buscar pelo WhatsApp.
          </div>
        )}

        {recurring.map((item) => (
          <ReservationCard
            key={item.id}
            title="Reserva fixa / mensalista"
            name={item.customer_name}
            field={getFieldName(item.fields)}
            date={getWeekdayLabel(item.weekday)}
            time={`${item.start_time.slice(0, 5)} às ${item.end_time.slice(0, 5)}`}
            amount={item.monthly_amount || 0}
            status={item.payment_status || item.status}
          />
        ))}

        {bookings.map((item) => (
          <ReservationCard
            key={item.id}
            title="Reserva avulsa"
            name={item.customer_name}
            field={getFieldName(item.fields)}
            date={formatDate(item.booking_date)}
            time={`${item.start_time.slice(0, 5)} às ${item.end_time.slice(0, 5)}`}
            amount={item.amount}
            status={item.status}
          />
        ))}
      </div>
    </section>
  );
}

function InfoPanel({
  arena,
  rules,
  hours,
  images,
}: {
  arena: Arena;
  rules: ArenaRule[];
  hours: OpeningHour[];
  images: GalleryImage[];
}) {
  return (
    <section className="rounded-[2rem] border border-white/12 bg-[#101923]/95 p-5 md:p-7">
      <PanelHeader
        eyebrow="Informações"
        title="Conheça a arena"
        description="Veja fotos, regras, funcionamento, localização e redes sociais."
      />

      <div className="mt-6 grid gap-6">
        <AboutCard arena={arena} instagram={arena.instagram ? normalizeSocialUrl(arena.instagram, "instagram") : ""} facebook={arena.facebook ? normalizeSocialUrl(arena.facebook, "facebook") : ""} />
        <LocationCard arena={arena} />
        <HoursCard hours={hours} />
        <RulesCard rules={rules} />
        <GalleryCard images={images} />
      </div>
    </section>
  );
}

function AboutCard({ arena, instagram, facebook }: { arena: Arena; instagram: string; facebook: string }) {
  return (
    <Card title="Contato e informações" icon={<MessageCircle />}>
      <div className="space-y-4 text-sm text-slate-300">
        {arena.description && (
          <p className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 leading-relaxed text-slate-200">
            {arena.description}
          </p>
        )}

        <div className="grid gap-3">
          {arena.whatsapp && (
            <button
              type="button"
              onClick={() => window.open(`https://wa.me/${arena.whatsapp}`, "_blank")}
              className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-left transition hover:border-emerald-400"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-xl bg-emerald-500 p-2 text-black"><MessageCircle size={18} /></span>
                <span>
                  <span className="block font-black text-white">WhatsApp da arena</span>
                  <span className="text-xs text-slate-300">+{arena.whatsapp}</span>
                </span>
              </span>
              <ExternalLink size={18} className="text-emerald-300" />
            </button>
          )}

          {instagram && (
            <a
              href={instagram}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] p-4 transition hover:border-emerald-400"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-xl bg-white/[0.10] p-2 text-emerald-300"><InstagramIcon size={18} /></span>
                <span>
                  <span className="block font-black text-white">Instagram</span>
                  <span className="text-xs text-slate-300">Ver fotos, novidades e bastidores</span>
                </span>
              </span>
              <ExternalLink size={18} className="text-slate-300" />
            </a>
          )}

          {arena.maps_url && (
            <a
              href={arena.maps_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] p-4 transition hover:border-emerald-400"
            >
              <span className="flex items-center gap-3">
                <span className="rounded-xl bg-white/[0.10] p-2 text-emerald-300"><MapPin size={18} /></span>
                <span>
                  <span className="block font-black text-white">Localização</span>
                  <span className="text-xs text-slate-300">{arena.address || "Abrir no Google Maps"}</span>
                </span>
              </span>
              <Navigation size={18} className="text-slate-300" />
            </a>
          )}
        </div>

        {arena.phone && <InfoLine icon={<Phone />} text={arena.phone} />}
        {facebook && <InfoLine icon={<Globe />} text="Facebook disponível" />}
      </div>
    </Card>
  );
}

function LocationCard({ arena }: { arena: Arena }) {
  if (!arena.maps_url && !arena.address) return null;

  return (
    <Card title="Como chegar" icon={<MapPin />}>
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-emerald-500/18 to-slate-900 p-6 text-center">
          <MapPin className="mx-auto text-emerald-300" size={42} />
          <p className="mt-3 font-bold text-white">{arena.address || "Localização da arena"}</p>
          <p className="mt-1 text-sm text-slate-300">Abra a rota diretamente no Google Maps.</p>
        </div>

        {arena.maps_url && (
          <a href={arena.maps_url} target="_blank" className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white transition hover:bg-emerald-400">
            <MapPin size={18} />
            Abrir rota no Google Maps
          </a>
        )}
      </div>
    </Card>
  );
}

function HoursCard({ hours }: { hours: OpeningHour[] }) {
  return (
    <Card title="Funcionamento" icon={<Clock />}>
      <div className="space-y-2">
        {weekDays.map((day, index) => {
          const hour = hours.find((item) => item.weekday === index);

          return (
            <div key={day} className="flex items-center justify-between rounded-2xl bg-white/[0.06] px-4 py-3 text-sm">
              <span className="font-bold text-white">{day}</span>
              <span className={hour?.is_open ? "font-bold text-emerald-300" : "text-slate-400"}>
                {hour?.is_open && hour.open_time && hour.close_time
                  ? `${hour.open_time.slice(0, 5)} às ${hour.close_time.slice(0, 5)}`
                  : "Fechado"}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RulesCard({ rules }: { rules: ArenaRule[] }) {
  if (rules.length === 0) return null;

  return (
    <Card title="Regras da arena" icon={<ShieldCheck />}>
      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="flex gap-3 text-sm text-slate-200">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            <span>{rule.rule_text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function GalleryCard({ images }: { images: GalleryImage[] }) {
  if (images.length === 0) return null;

  const featured = images[0];
  const rest = images.slice(1, 9);

  return (
    <Card title="Fotos da arena" icon={<Camera />}>
      <div className="space-y-3">
        <a href={featured.image_url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-3xl border border-white/12 bg-[#0B1411]">
          <img
            src={featured.image_url}
            alt="Foto principal da arena"
            className="h-52 w-full object-cover transition duration-500 group-hover:scale-105 md:h-64"
          />
          <div className="flex items-center justify-between p-4">
            <div>
              <p className="font-black text-white">Conheça a estrutura</p>
              <p className="text-xs text-slate-300">Toque para abrir a foto maior</p>
            </div>
            <ExternalLink size={18} className="text-emerald-300" />
          </div>
        </a>

        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {rest.map((image, index) => (
              <a key={image.id} href={image.image_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/12 bg-[#0B1411]">
                <img
                  src={image.image_url}
                  alt={`Foto da arena ${index + 2}`}
                  className="h-28 w-full object-cover transition duration-500 group-hover:scale-110"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function DepositCard({ settings }: { settings: ArenaSettings | null }) {
  if (!settings?.require_deposit) return null;

  return (
    <div className="rounded-[2rem] border border-yellow-400/30 bg-yellow-400/10 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 shrink-0 text-yellow-300" />
        <div>
          <h3 className="font-black text-yellow-100">Esta arena exige sinal</h3>
          <p className="mt-1 text-sm text-yellow-100/80">O valor será calculado na etapa de agendamento.</p>
        </div>
      </div>
    </div>
  );
}

function ContactQuickActions({
  arena,
  instagram,
  facebook,
  onWhatsapp,
}: {
  arena: Arena;
  instagram: string;
  facebook: string;
  onWhatsapp: () => void;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      {arena.whatsapp && (
        <button
          type="button"
          onClick={onWhatsapp}
          className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 font-black text-black shadow-lg shadow-emerald-500/20"
        >
          <MessageCircle size={18} />
          WhatsApp
        </button>
      )}

      {instagram && (
        <a href={instagram} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-4 py-3 font-black text-white">
          <InstagramIcon size={18} />
          Instagram
        </a>
      )}

      {arena.maps_url && (
        <a href={arena.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-4 py-3 font-black text-white">
          <MapPin size={18} />
          Como chegar
        </a>
      )}

      {facebook && (
        <a href={facebook} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.10] px-4 py-3 font-black text-white">
          <Globe size={18} />
          Facebook
        </a>
      )}
    </div>
  );
}

function MobileFloatingActions({
  arena,
  instagram,
  facebook,
  onWhatsapp,
}: {
  arena: Arena;
  instagram: string;
  facebook: string;
  onWhatsapp: () => void;
}) {
  return (
    <div className="fixed bottom-24 right-4 z-40 flex flex-col gap-3 md:hidden">
      {arena.whatsapp && (
        <button
          type="button"
          onClick={onWhatsapp}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-black shadow-2xl shadow-emerald-500/30"
          aria-label="Falar no WhatsApp"
        >
          <MessageCircle size={26} />
        </button>
      )}

      {instagram && (
        <a href={instagram} target="_blank" rel="noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-[#101923] text-emerald-300 shadow-xl" aria-label="Instagram da arena">
          <InstagramIcon size={22} />
        </a>
      )}

      {arena.maps_url && (
        <a href={arena.maps_url} target="_blank" rel="noreferrer" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-[#101923] text-emerald-300 shadow-xl" aria-label="Como chegar">
          <Navigation size={22} />
        </a>
      )}
    </div>
  );
}

function MobileBottomCTA({ onReserve, onWhatsapp }: { onReserve: () => void; onWhatsapp: () => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-500/15 bg-[#07110D]/95 p-3 shadow-[0_-8px_30px_rgba(0,0,0,.25)] backdrop-blur md:hidden">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <button type="button" onClick={onReserve} className="rounded-2xl bg-emerald-500 px-4 py-4 font-black text-white shadow-lg shadow-emerald-500/20">
          Ver horários
        </button>
        <button type="button" onClick={onWhatsapp} className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.10] text-emerald-300" aria-label="WhatsApp">
          <MessageCircle size={24} />
        </button>
      </div>
    </div>
  );
}

function MobileNav({ tab, setTab }: { tab: PublicTab; setTab: (tab: PublicTab) => void }) {
  return (
    <div className="sticky top-0 z-30 border-b border-emerald-500/15 bg-[#07110D]/95 backdrop-blur md:hidden">
      <div className="grid grid-cols-4 px-3 py-2 text-xs font-bold">
        <MobileTab active={tab === "avulsa"} onClick={() => setTab("avulsa")} label="Agendar" />
        <MobileTab active={tab === "fixa"} onClick={() => setTab("fixa")} label="Fixa" />
        <MobileTab active={tab === "minhas"} onClick={() => setTab("minhas")} label="Minhas" />
        <MobileTab active={tab === "info"} onClick={() => setTab("info")} label="Info" />
      </div>
    </div>
  );
}

function DesktopTabs({ tab, setTab }: { tab: PublicTab; setTab: (tab: PublicTab) => void }) {
  return (
    <div className="hidden grid-cols-4 gap-3 md:grid">
      <DesktopTab active={tab === "avulsa"} onClick={() => setTab("avulsa")} label="Reserva avulsa" />
      <DesktopTab active={tab === "fixa"} onClick={() => setTab("fixa")} label="Reserva fixa" />
      <DesktopTab active={tab === "minhas"} onClick={() => setTab("minhas")} label="Minhas reservas" />
      <DesktopTab active={tab === "info"} onClick={() => setTab("info")} label="Informações" />
    </div>
  );
}

function ReservationTypeSwitch({ active, setTab }: { active: "avulsa" | "fixa"; setTab: (tab: PublicTab) => void }) {
  return (
    <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
      <button
        type="button"
        onClick={() => setTab("avulsa")}
        className={
          active === "avulsa"
            ? "rounded-2xl border border-emerald-500 bg-emerald-500/10 p-4 text-left"
            : "rounded-2xl border border-white/12 bg-[#0B1411] p-4 text-left transition hover:border-emerald-500"
        }
      >
        <p className={active === "avulsa" ? "font-black text-emerald-300" : "font-black text-white"}>Reserva avulsa</p>
        <p className="mt-1 text-sm text-slate-300">Para reservar um horário específico.</p>
      </button>

      <button
        type="button"
        onClick={() => setTab("fixa")}
        className={
          active === "fixa"
            ? "rounded-2xl border border-emerald-500 bg-emerald-500/10 p-4 text-left"
            : "rounded-2xl border border-white/12 bg-[#0B1411] p-4 text-left transition hover:border-emerald-500"
        }
      >
        <p className={active === "fixa" ? "font-black text-emerald-300" : "font-black text-white"}>Reserva fixa / mensalista</p>
        <p className="mt-1 text-sm text-slate-300">Para jogar toda semana ou fechar mensal.</p>
      </button>
    </div>
  );
}

function CustomerFields({
  name,
  setName,
  whatsapp,
  setWhatsapp,
  email,
  setEmail,
}: {
  name: string;
  setName: (value: string) => void;
  whatsapp: string;
  setWhatsapp: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/12 bg-[#0B1411] p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserRound className="text-emerald-400" />
        <h3 className="text-xl font-black">Seus dados</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Nome completo</Label>
          <InputBox value={name} onChange={setName} placeholder="Seu nome" />
        </div>

        <div>
          <Label>WhatsApp</Label>
          <WhatsappInput value={whatsapp} onChange={setWhatsapp} />
        </div>

        <div className="md:col-span-2">
          <Label>Email opcional</Label>
          <InputBox value={email} onChange={setEmail} placeholder="seuemail@email.com" />
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({
  booking,
  requireDeposit,
  depositAmount,
  pixKey,
  onWhatsapp,
  onNew,
}: {
  booking: Booking;
  requireDeposit: boolean;
  depositAmount: number;
  pixKey: string;
  onWhatsapp: () => void;
  onNew: () => void;
}) {
  async function copyPix() {
    if (!pixKey) return;
    await navigator.clipboard.writeText(pixKey);
    alert("Chave Pix copiada!");
  }

  return (
    <div className="mt-6 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-emerald-500 p-3 text-white">
          <CheckCircle2 />
        </div>

        <div>
          <h3 className="text-2xl font-black">Reserva solicitada!</h3>
          <p className="mt-2 text-slate-200">
            {getFieldName(booking.fields)} • {formatDate(booking.booking_date)} • {booking.start_time.slice(0, 5)} às {booking.end_time.slice(0, 5)}
          </p>
          <p className="mt-1 font-black text-white">R$ {formatMoney(booking.amount)}</p>
        </div>
      </div>

      {requireDeposit && (
        <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4">
          <p className="font-black text-yellow-100">Para confirmar, envie o comprovante do sinal.</p>
          <p className="mt-2 text-2xl font-black text-white">R$ {formatMoney(depositAmount)}</p>

          {pixKey && (
            <button type="button" onClick={copyPix} className="mt-3 flex items-center gap-2 rounded-xl border border-yellow-300/30 px-4 py-3 font-bold text-yellow-100">
              <Copy size={16} />
              Copiar chave Pix
            </button>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <button type="button" onClick={onWhatsapp} className="rounded-2xl bg-emerald-500 px-5 py-4 font-black text-white">
          Ir para WhatsApp
        </button>

        <button type="button" onClick={onNew} className="rounded-2xl border border-white/12 px-5 py-4 font-black text-white">
          Fazer outra reserva
        </button>
      </div>
    </div>
  );
}

function FieldCard({
  field,
  active,
  priceText,
  onClick,
}: {
  field: Field;
  active: boolean;
  priceText: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "overflow-hidden rounded-3xl border border-emerald-400 bg-emerald-500/10 text-left shadow-lg shadow-emerald-500/10"
          : "overflow-hidden rounded-3xl border border-white/12 bg-[#0B1411] text-left transition hover:border-emerald-500/50"
      }
    >
      <div className="h-32 bg-slate-900">
        {field.photo_url ? (
          <img src={field.photo_url} alt={field.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-600">
            <ImageIcon />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="font-black text-white">{field.name}</p>
        <p className="mt-1 text-sm text-slate-300">
          {field.sport || "Quadra"} {field.surface ? `• ${field.surface}` : ""}
        </p>
        <p className="mt-2 text-sm font-black text-emerald-300">{priceText}</p>
      </div>
    </button>
  );
}

function ReservationCard({
  title,
  name,
  field,
  date,
  time,
  amount,
  status,
}: {
  title: string;
  name: string;
  field: string;
  date: string;
  time: string;
  amount: number;
  status: string;
}) {
  return (
    <div className="rounded-3xl border border-white/12 bg-[#0B1411] p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-emerald-400">{title}</p>
          <h3 className="mt-1 text-xl font-black text-white">{name}</h3>
          <p className="mt-2 text-sm text-slate-300">
            {field} • {date} • {time}
          </p>
        </div>

        <div className="text-left md:text-right">
          <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">{translateStatus(status)}</span>
          <p className="mt-2 text-xl font-black text-white">R$ {formatMoney(amount)}</p>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-400">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-black">{title}</h2>
      <p className="mt-2 text-sm text-slate-300">{description}</p>
    </div>
  );
}

function HeroFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur">
      <div className="mb-3 text-emerald-400">{icon}</div>
      <p className="font-black">{title}</p>
      <p className="text-xs text-slate-300">{text}</p>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-white/12 bg-[#101923]/95 p-5 shadow-xl shadow-black/10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-black">
        <span className="text-emerald-400">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-emerald-400">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function MobileTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={active ? "rounded-xl bg-emerald-500 py-3 font-black text-black" : "py-3 text-slate-300"}>
      {label}
    </button>
  );
}

function DesktopTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-2xl bg-emerald-500 px-4 py-4 font-black text-white"
          : "rounded-2xl border border-white/12 bg-[#101923] px-4 py-4 font-bold text-slate-300 transition hover:border-emerald-500/40"
      }
    >
      {label}
    </button>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-black text-slate-200">{children}</label>;
}

function InputBox({
  value,
  onChange,
  type = "text",
  placeholder = "",
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: string;
}) {
  return (
    <input
      type={type}
      min={min}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-white/12 bg-[#0B1411] p-4 text-white outline-none focus:border-emerald-400"
    />
  );
}

function WhatsappInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-2 flex overflow-hidden rounded-2xl border border-white/12 bg-[#0B1411] focus-within:border-emerald-400">
      <span className="flex items-center border-r border-white/12 px-4 font-black text-emerald-400">+55</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").replace(/^55/, ""))}
        placeholder="DDD + número"
        className="w-full bg-transparent p-4 text-white outline-none"
      />
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 w-full rounded-2xl border border-white/12 bg-[#0B1411] p-4 text-white outline-none focus:border-emerald-400"
    >
      {children}
    </select>
  );
}

function PrimaryButton({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-5 text-lg font-black text-black shadow-xl shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

function getMinimumPrice(prices: PricingOption[], fieldId: string) {
  const fieldPrices = prices.filter((price) => price.field_id === fieldId && price.is_active);
  if (!fieldPrices.length) return "Preço sob consulta";

  const min = Math.min(...fieldPrices.map((price) => Number(price.price || 0)));
  return `A partir de R$ ${formatMoney(min)}`;
}

function hasConflictAt(
  bookings: Booking[],
  recurring: RecurringBooking[],
  blocks: ScheduleBlock[],
  fieldId: string,
  date: string,
  start: number,
  end: number
) {
  const normal = bookings.some(
    (booking) =>
      booking.field_id === fieldId &&
      booking.booking_date === date &&
      booking.status !== "cancelada" &&
      start < timeToMinutes(booking.end_time.slice(0, 5)) &&
      end > timeToMinutes(booking.start_time.slice(0, 5))
  );

  const fixed = getRecurringBookingsForDate(recurring, date, fieldId).some(
    (booking) =>
      booking.status === "active" &&
      start < timeToMinutes(booking.end_time.slice(0, 5)) &&
      end > timeToMinutes(booking.start_time.slice(0, 5))
  );

  const blocked = blocks.some(
    (block) =>
      block.field_id === fieldId &&
      block.block_date === date &&
      block.status === "active" &&
      start < timeToMinutes(block.end_time.slice(0, 5)) &&
      end > timeToMinutes(block.start_time.slice(0, 5))
  );

  return normal || fixed || blocked;
}

function getRecurringBookingsForDate(bookings: RecurringBooking[], date: string, fieldId?: string) {
  const weekday = new Date(`${date}T00:00:00`).getDay();

  return bookings.filter(
    (booking) =>
      (!fieldId || booking.field_id === fieldId) &&
      booking.weekday === weekday &&
      date >= booking.start_date &&
      (!booking.end_date || date <= booking.end_date)
  );
}

function timeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function minutesToTime(total: number) {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function addMinutesToTime(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function getFieldName(fields: FieldRelation) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function getWeekdayLabel(weekday: number) {
  return weekDays[weekday] || "Dia";
}

function normalizeSocialUrl(value: string, type: "instagram" | "facebook") {
  if (!value) return "#";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;

  const clean = value.replace("@", "").replace(/^\/+/, "");

  if (type === "instagram") return `https://instagram.com/${clean}`;
  return `https://facebook.com/${clean}`;
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    aguardando_sinal: "Aguardando sinal",
    confirmada: "Confirmada",
    cancelada: "Cancelada",
    concluida: "Concluída",
    active: "Ativa",
    pending: "Pendente",
    paid: "Pago",
    partial: "Parcial",
  };

  return labels[status] || status;
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

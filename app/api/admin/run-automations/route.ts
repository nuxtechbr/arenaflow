import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Relation<T> = T | T[] | null | undefined;

type Subscription = {
  id: string;
  arena_id: string;
  plan_name: string | null;
  monthly_amount: number | null;
  due_day: number | null;
  status: string | null;
  next_due_date: string | null;
  payment_pix_key: string | null;
  payment_whatsapp: string | null;
  arenas?: Relation<{
    id: string;
    name: string;
    whatsapp: string | null;
    slug: string | null;
  }>;
};

type Invoice = {
  id: string;
  arena_id: string;
  subscription_id: string | null;
  reference_month: string | null;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string | null;
};

type BookingAutomationRow = {
  id: string;
  arena_id: string;
  customer_name: string;
  customer_whatsapp: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  amount: number | null;
  status: string | null;
  fields?: { name: string } | { name: string }[] | null;
  arenas?: Relation<{ name: string; whatsapp: string | null }>;
};

type RecurringAutomationRow = {
  id: string;
  arena_id: string;
  customer_name: string;
  customer_whatsapp: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  status: string | null;
  fields?: { name: string } | { name: string }[] | null;
  arenas?: Relation<{ name: string; whatsapp: string | null }>;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { ok: false, error: "Supabase admin env vars ausentes." },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Sessão não enviada." },
        { status: 401 }
      );
    }

    const { data: userRes, error: userError } = await adminSupabase.auth.getUser(token);

    if (userError || !userRes.user) {
      return NextResponse.json(
        { ok: false, error: "Sessão inválida." },
        { status: 401 }
      );
    }

    const today = new Date();
    const todayDate = toDateOnly(today);
    const tomorrowDate = addDays(todayDate, 1);
    const referenceMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

    const counters = {
      invoicesCreated: 0,
      invoicesMarkedOverdue: 0,
      arenasBlocked: 0,
      messagesCreated: 0,
      bookingMessagesCreated: 0,
      recurringMessagesCreated: 0,
      customerInvoicesCreated: 0,
      customerInvoicesMarkedOverdue: 0,
      customerBillingMessagesCreated: 0,
      logsCreated: 0,
      trialEndingTomorrow: 0,
      trialEndingToday: 0,
      trialsExpired: 0,
      trialMessagesCreated: 0,
    };

    const trialResult = await processTrialAutomations(todayDate);
    counters.trialEndingTomorrow += trialResult.trialEndingTomorrow;
    counters.trialEndingToday += trialResult.trialEndingToday;
    counters.trialsExpired += trialResult.trialsExpired;
    counters.trialMessagesCreated += trialResult.trialMessagesCreated;
    counters.messagesCreated += trialResult.trialMessagesCreated;
    counters.logsCreated += trialResult.logsCreated;

    const { data: subscriptions, error: subError } = await adminSupabase
      .from("subscriptions")
      .select("*, arenas(id, name, whatsapp, slug)")
      .eq("billing_provider", "manual")
      .in("status", ["active", "overdue", "pending"])
      .order("created_at", { ascending: true });

    if (subError) throw subError;

    for (const subscription of (subscriptions || []) as Subscription[]) {
      const dueDate = resolveDueDate(subscription, today);
      const amount = Number(subscription.monthly_amount || 89.9);

      const { data: existingInvoice, error: existingError } = await adminSupabase
        .from("subscription_invoices")
        .select("*")
        .eq("subscription_id", subscription.id)
        .eq("reference_month", referenceMonth)
        .maybeSingle();

      if (existingError) throw existingError;

      let invoice = existingInvoice as Invoice | null;

      if (!invoice) {
        const { data: createdInvoice, error: createInvoiceError } = await adminSupabase
          .from("subscription_invoices")
          .insert({
            arena_id: subscription.arena_id,
            subscription_id: subscription.id,
            reference_month: referenceMonth,
            due_date: dueDate,
            amount,
            paid_amount: 0,
            status: isBefore(dueDate, todayDate) ? "overdue" : "pending",
            notes: "Mensalidade gerada automaticamente pelo motor de automações.",
          })
          .select("*")
          .single();

        if (createInvoiceError) throw createInvoiceError;

        invoice = createdInvoice as Invoice;
        counters.invoicesCreated += 1;

        await createLog(subscription.arena_id, "invoice_created", `Mensalidade ${referenceMonth} gerada automaticamente.`, {
          invoice_id: invoice.id,
          amount,
          due_date: dueDate,
        });
        counters.logsCreated += 1;
      }

      if (invoice && invoice.status === "pending" && isBefore(invoice.due_date, todayDate)) {
        const { error: markError } = await adminSupabase
          .from("subscription_invoices")
          .update({ status: "overdue" })
          .eq("id", invoice.id);

        if (markError) throw markError;

        invoice.status = "overdue";
        counters.invoicesMarkedOverdue += 1;

        await createLog(subscription.arena_id, "invoice_overdue", "Mensalidade marcada como atrasada automaticamente.", {
          invoice_id: invoice.id,
          due_date: invoice.due_date,
        });
        counters.logsCreated += 1;
      }

      if (invoice && invoice.status !== "paid") {
        const days = daysBetween(todayDate, invoice.due_date);

        if (days === 3) {
          const ok = await createInvoiceMessage(subscription, invoice, "subscription_due_soon");
          if (ok) counters.messagesCreated += 1;
        }

        if (days === 0) {
          const ok = await createInvoiceMessage(subscription, invoice, "subscription_due_today");
          if (ok) counters.messagesCreated += 1;
        }

        if (days < 0) {
          const ok = await createInvoiceMessage(subscription, invoice, "subscription_overdue");
          if (ok) counters.messagesCreated += 1;
        }

        if (days <= -5) {
          const { error: arenaBlockError } = await adminSupabase
            .from("arenas")
            .update({
              subscription_status: "blocked",
              blocked_reason: "Mensalidade em atraso há 5 dias ou mais.",
            })
            .eq("id", subscription.arena_id)
            .neq("subscription_status", "blocked");

          if (arenaBlockError) throw arenaBlockError;

          const { error: subBlockError } = await adminSupabase
            .from("subscriptions")
            .update({
              status: "blocked",
              blocked_at: new Date().toISOString(),
            })
            .eq("id", subscription.id)
            .neq("status", "blocked");

          if (subBlockError) throw subBlockError;

          counters.arenasBlocked += 1;

          const ok = await createInvoiceMessage(subscription, invoice, "subscription_blocked");
          if (ok) counters.messagesCreated += 1;

          await createLog(subscription.arena_id, "arena_blocked", "Arena bloqueada automaticamente por atraso.", {
            invoice_id: invoice.id,
            due_date: invoice.due_date,
          });
          counters.logsCreated += 1;
        }
      }

      const nextDue = addMonthsKeepingDay(dueDate, 1, Number(subscription.due_day || 10));

      await adminSupabase
        .from("subscriptions")
        .update({ next_due_date: nextDue })
        .eq("id", subscription.id);
    }

    const bookingResult = await processBookingAutomations(todayDate, tomorrowDate);
    counters.bookingMessagesCreated += bookingResult.bookingMessagesCreated;
    counters.recurringMessagesCreated += bookingResult.recurringMessagesCreated;
    counters.messagesCreated += bookingResult.bookingMessagesCreated + bookingResult.recurringMessagesCreated;
    counters.logsCreated += bookingResult.logsCreated;

    const customerBillingResult = await processCustomerBillingAutomations(todayDate, referenceMonth);
    counters.customerInvoicesCreated += customerBillingResult.customerInvoicesCreated;
    counters.customerInvoicesMarkedOverdue += customerBillingResult.customerInvoicesMarkedOverdue;
    counters.customerBillingMessagesCreated += customerBillingResult.customerBillingMessagesCreated;
    counters.messagesCreated += customerBillingResult.customerBillingMessagesCreated;
    counters.logsCreated += customerBillingResult.logsCreated;

    return NextResponse.json({
      ok: true,
      message: "Automações executadas com sucesso.",
      ...counters,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Erro ao executar automações." },
      { status: 500 }
    );
  }
}


async function processTrialAutomations(todayDate: string) {
  const result = {
    trialEndingTomorrow: 0,
    trialEndingToday: 0,
    trialsExpired: 0,
    trialMessagesCreated: 0,
    logsCreated: 0,
  };

  const { data: trials, error } = await adminSupabase
    .from("subscriptions")
    .select("id, arena_id, plan_key, status, lifecycle_stage, trial_ends_at, asaas_subscription_id, arenas(id, name, whatsapp, slug)")
    .or("status.eq.trialing,lifecycle_stage.eq.trial,lifecycle_stage.eq.trial_expired")
    .is("asaas_subscription_id", null);

  if (error) throw error;

  for (const subscription of trials || []) {
    const trialEndsAt = String(subscription.trial_ends_at || "").slice(0, 10);
    if (!trialEndsAt) continue;

    const days = daysBetween(todayDate, trialEndsAt);
    const arena = getRelationItem(subscription.arenas as Relation<{ id: string; name: string; whatsapp: string | null; slug: string | null }>);

    if (days === 1) {
      const ok = await createTrialMessage(subscription, "trial_ending_tomorrow", days, arena);
      if (ok) {
        result.trialEndingTomorrow += 1;
        result.trialMessagesCreated += 1;
      }
    }

    if (days === 0) {
      const ok = await createTrialMessage(subscription, "trial_ending_today", days, arena);
      if (ok) {
        result.trialEndingToday += 1;
        result.trialMessagesCreated += 1;
      }
    }

    if (days < 0) {
      const { error: updateError } = await adminSupabase
        .from("subscriptions")
        .update({
          status: "trial_expired",
          lifecycle_stage: "trial_expired",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id)
        .neq("status", "trial_expired");

      if (updateError) throw updateError;

      const ok = await createTrialMessage(subscription, "trial_expired", days, arena);
      if (ok) result.trialMessagesCreated += 1;

      await createLog(subscription.arena_id, "trial_expired", "Teste grátis expirado automaticamente.", {
        subscription_id: subscription.id,
        trial_ends_at: trialEndsAt,
      });

      result.trialsExpired += 1;
      result.logsCreated += 1;
    }
  }

  return result;
}

async function createTrialMessage(
  subscription: any,
  type: "trial_ending_tomorrow" | "trial_ending_today" | "trial_expired",
  daysLeft: number,
  arena: { id: string; name: string; whatsapp: string | null; slug: string | null } | null
) {
  const phone = normalizePhone(arena?.whatsapp || "");

  if (!phone) return false;

  const dedupeKey = `${type}:${subscription.id}:${String(subscription.trial_ends_at || "").slice(0, 10)}`;

  const body = buildTrialMessage(type, {
    arenaName: arena?.name || "sua arena",
    trialEndsAt: String(subscription.trial_ends_at || "").slice(0, 10),
    daysLeft,
  });

  const { error } = await adminSupabase.from("message_queue").insert({
    arena_id: subscription.arena_id,
    customer_id: null,
    customer_name: arena?.name || "Responsável da arena",
    phone,
    message_type: type,
    message_body: body,
    status: "pending",
    scheduled_at: new Date().toISOString(),
    related_type: "subscription",
    related_id: subscription.id,
    dedupe_key: dedupeKey,
    metadata: {
      trial_ends_at: subscription.trial_ends_at,
      plan_key: subscription.plan_key || "essential",
    },
  });

  if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
    throw error;
  }

  return !error;
}

function buildTrialMessage(
  type: "trial_ending_tomorrow" | "trial_ending_today" | "trial_expired",
  data: {
    arenaName: string;
    trialEndsAt: string;
    daysLeft: number;
  }
) {
  const trialEndsAt = formatDate(data.trialEndsAt);

  if (type === "trial_ending_tomorrow") {
    return `Olá! Seu teste grátis do ArenaFlow da ${data.arenaName} termina amanhã (${trialEndsAt}).\n\nPara continuar usando sem bloqueio, acesse o painel e clique em Minha mensalidade > Ativar assinatura.\n\nA recorrência só começa quando você ativar.`;
  }

  if (type === "trial_ending_today") {
    return `Olá! Seu teste grátis do ArenaFlow da ${data.arenaName} termina hoje (${trialEndsAt}).\n\nAtive sua assinatura no painel para continuar usando a agenda, financeiro, clientes e link público sem interrupção.`;
  }

  return `Olá! Seu teste grátis do ArenaFlow da ${data.arenaName} terminou em ${trialEndsAt}.\n\nPara liberar o painel, acesse Minha mensalidade e ative sua assinatura pelo Asaas.`;
}


async function processBookingAutomations(todayDate: string, tomorrowDate: string) {
  const result = {
    bookingMessagesCreated: 0,
    recurringMessagesCreated: 0,
    logsCreated: 0,
  };

  const { data: confirmedBookings, error: confirmedError } = await adminSupabase
    .from("bookings")
    .select("id, arena_id, customer_name, customer_whatsapp, booking_date, start_time, end_time, amount, status, fields(name), arenas(name, whatsapp)")
    .in("status", ["confirmada", "confirmed"])
    .gte("booking_date", todayDate)
    .lte("booking_date", tomorrowDate);

  if (confirmedError) throw confirmedError;

  for (const booking of (confirmedBookings || []) as unknown as BookingAutomationRow[]) {
    const messageType = booking.booking_date === tomorrowDate ? "booking_reminder_tomorrow" : "booking_reminder_today";
    const ok = await createBookingMessage(booking, messageType);

    if (ok) {
      result.bookingMessagesCreated += 1;
      result.logsCreated += 1;
    }
  }

  const { data: depositPending, error: depositError } = await adminSupabase
    .from("bookings")
    .select("id, arena_id, customer_name, customer_whatsapp, booking_date, start_time, end_time, amount, status, fields(name), arenas(name, whatsapp)")
    .eq("status", "aguardando_sinal")
    .gte("booking_date", todayDate);

  if (depositError) throw depositError;

  for (const booking of (depositPending || []) as unknown as BookingAutomationRow[]) {
    const ok = await createBookingMessage(booking, "booking_deposit_pending");

    if (ok) {
      result.bookingMessagesCreated += 1;
      result.logsCreated += 1;
    }
  }

  const tomorrowWeekday = new Date(`${tomorrowDate}T00:00:00`).getDay();

  const { data: recurringBookings, error: recurringError } = await adminSupabase
    .from("recurring_bookings")
    .select("id, arena_id, customer_name, customer_whatsapp, weekday, start_time, end_time, start_date, end_date, status, fields(name), arenas(name, whatsapp)")
    .eq("status", "active")
    .eq("weekday", tomorrowWeekday)
    .lte("start_date", tomorrowDate)
    .or(`end_date.is.null,end_date.gte.${tomorrowDate}`);

  if (recurringError) throw recurringError;

  for (const recurring of (recurringBookings || []) as unknown as RecurringAutomationRow[]) {
    const ok = await createRecurringBookingMessage(recurring, tomorrowDate, "recurring_booking_reminder_tomorrow");

    if (ok) {
      result.recurringMessagesCreated += 1;
      result.logsCreated += 1;
    }
  }

  return result;
}

type CustomerRecurringBillingRow = {
  id: string;
  arena_id: string;
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
  payment_status: string | null;
  paid_amount: number | null;
  next_due_date: string | null;
  fields?: Relation<{ name: string }>;
  arenas?: Relation<{ name: string; whatsapp: string | null }>;
};

type CustomerRecurringInvoice = {
  id: string;
  arena_id: string;
  recurring_booking_id: string | null;
  customer_id: string | null;
  customer_name: string;
  description: string | null;
  reference_month: string | null;
  due_date: string;
  amount: number;
  paid_amount: number | null;
  status: string;
  paid_at: string | null;
};

async function processCustomerBillingAutomations(todayDate: string, referenceMonth: string) {
  const result = {
    customerInvoicesCreated: 0,
    customerInvoicesMarkedOverdue: 0,
    customerBillingMessagesCreated: 0,
    logsCreated: 0,
  };

  const { data: recurringRows, error } = await adminSupabase
    .from("recurring_bookings")
    .select("id, arena_id, customer_id, customer_name, customer_whatsapp, weekday, start_time, end_time, start_date, end_date, status, billing_type, monthly_amount, payment_status, paid_amount, next_due_date, fields(name), arenas(name, whatsapp)")
    .eq("status", "active");

  if (error) throw error;

  for (const recurring of ((recurringRows || []) as unknown as CustomerRecurringBillingRow[])) {
    const amount = Number(recurring.monthly_amount || 0);
    if (!amount || amount <= 0) continue;

    const dueDate = recurring.next_due_date || todayDate;
    const dueMonth = dueDate.slice(0, 7);

    if (dueMonth > referenceMonth) continue;

    const { data: existingInvoice, error: existingError } = await adminSupabase
      .from("recurring_invoices")
      .select("*")
      .eq("recurring_booking_id", recurring.id)
      .eq("reference_month", referenceMonth)
      .maybeSingle();

    if (existingError) throw existingError;

    let invoice = existingInvoice as CustomerRecurringInvoice | null;

    if (!invoice) {
      const field = getRelationItem(recurring.fields);

      const { data: createdInvoice, error: createError } = await adminSupabase
        .from("recurring_invoices")
        .insert({
          arena_id: recurring.arena_id,
          recurring_booking_id: recurring.id,
          customer_id: recurring.customer_id,
          customer_name: recurring.customer_name,
          description: `Mensalidade ${field?.name || "Reserva fixa"} - ${getWeekdayName(recurring.weekday)} ${recurring.start_time.slice(0, 5)} às ${recurring.end_time.slice(0, 5)}`,
          reference_month: referenceMonth,
          due_date: dueDate,
          amount,
          paid_amount: 0,
          status: isBefore(dueDate, todayDate) ? "overdue" : "pending",
        })
        .select("*")
        .single();

      if (createError) throw createError;

      invoice = createdInvoice as CustomerRecurringInvoice;
      result.customerInvoicesCreated += 1;

      await createLog(recurring.arena_id, "customer_invoice_created", "Mensalidade de cliente mensalista gerada automaticamente.", {
        recurring_booking_id: recurring.id,
        invoice_id: invoice.id,
        amount,
        due_date: dueDate,
      });
      result.logsCreated += 1;
    }

    if (invoice && invoice.status === "pending" && isBefore(invoice.due_date, todayDate)) {
      const { error: updateError } = await adminSupabase
        .from("recurring_invoices")
        .update({ status: "overdue" })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      invoice.status = "overdue";
      result.customerInvoicesMarkedOverdue += 1;

      await createLog(recurring.arena_id, "customer_invoice_overdue", "Mensalidade de mensalista marcada como atrasada automaticamente.", {
        recurring_booking_id: recurring.id,
        invoice_id: invoice.id,
        due_date: invoice.due_date,
      });
      result.logsCreated += 1;
    }

    if (invoice && invoice.status !== "paid") {
      const days = daysBetween(todayDate, invoice.due_date);

      if (days === 3) {
        const ok = await createCustomerInvoiceMessage(recurring, invoice, "customer_invoice_due_soon");
        if (ok) result.customerBillingMessagesCreated += 1;
      }

      if (days === 0) {
        const ok = await createCustomerInvoiceMessage(recurring, invoice, "customer_invoice_due_today");
        if (ok) result.customerBillingMessagesCreated += 1;
      }

      if (days < 0) {
        const ok = await createCustomerInvoiceMessage(recurring, invoice, "customer_invoice_overdue");
        if (ok) result.customerBillingMessagesCreated += 1;
      }
    }

    const nextDueDate = addMonthsKeepingDay(dueDate, 1, Number(dueDate.slice(8, 10) || 10));

    await adminSupabase
      .from("recurring_bookings")
      .update({
        next_due_date: nextDueDate,
        payment_status: invoice?.status === "paid" ? "paid" : "pending",
      })
      .eq("id", recurring.id);
  }

  return result;
}

async function createCustomerInvoiceMessage(
  recurring: CustomerRecurringBillingRow,
  invoice: CustomerRecurringInvoice,
  type: string
) {
  const arena = getRelationItem(recurring.arenas);
  const field = getRelationItem(recurring.fields);
  const phone = normalizePhone(recurring.customer_whatsapp || "");

  if (!phone) return false;

  const dedupeKey = `${type}:${invoice.id}`;

  const { data: existing } = await adminSupabase
    .from("message_queue")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();

  if (existing?.id) return false;

  const messageBody = buildCustomerInvoiceMessage(type, {
    arenaName: arena?.name || "arena",
    customerName: recurring.customer_name,
    fieldName: field?.name || "Reserva fixa",
    amount: Number(invoice.amount || 0),
    dueDate: invoice.due_date,
    weekday: getWeekdayName(recurring.weekday),
    time: `${recurring.start_time.slice(0, 5)} às ${recurring.end_time.slice(0, 5)}`,
  });

  const { error } = await adminSupabase.from("message_queue").insert({
    arena_id: recurring.arena_id,
    customer_id: recurring.customer_id,
    customer_name: recurring.customer_name,
    phone,
    message_type: type,
    message_body: messageBody,
    status: "pending",
    scheduled_at: new Date().toISOString(),
    related_type: "recurring_invoice",
    related_id: invoice.id,
    dedupe_key: dedupeKey,
    metadata: {
      invoice_id: invoice.id,
      recurring_booking_id: recurring.id,
      due_date: invoice.due_date,
      amount: invoice.amount,
    },
  });

  if (error) throw error;

  await createLog(recurring.arena_id, "customer_invoice_message_created", `Mensagem de mensalista criada: ${type}.`, {
    invoice_id: invoice.id,
    recurring_booking_id: recurring.id,
    message_type: type,
  });

  return true;
}

function buildCustomerInvoiceMessage(
  type: string,
  data: {
    arenaName: string;
    customerName: string;
    fieldName: string;
    amount: number;
    dueDate: string;
    weekday: string;
    time: string;
  }
) {
  const amount = formatMoney(data.amount);
  const dueDate = formatDate(data.dueDate);

  if (type === "customer_invoice_due_soon") {
    return `Olá, ${data.customerName}! Passando para lembrar que sua mensalidade na ${data.arenaName} vence em 3 dias, no dia ${dueDate}.\n\nReserva fixa: ${data.fieldName}\nDia/horário: ${data.weekday}, ${data.time}\nValor: R$ ${amount}\n\nApós o pagamento, envie o comprovante por aqui.`;
  }

  if (type === "customer_invoice_due_today") {
    return `Olá, ${data.customerName}! Sua mensalidade na ${data.arenaName} vence hoje (${dueDate}).\n\nReserva fixa: ${data.fieldName}\nDia/horário: ${data.weekday}, ${data.time}\nValor: R$ ${amount}\n\nApós o pagamento, envie o comprovante por aqui.`;
  }

  return `Olá, ${data.customerName}! Identificamos uma mensalidade em atraso na ${data.arenaName}.\n\nReserva fixa: ${data.fieldName}\nDia/horário: ${data.weekday}, ${data.time}\nValor: R$ ${amount}\nVencimento: ${dueDate}\n\nPor favor, envie o comprovante para regularizar.`;
}

function getWeekdayName(weekday: number) {
  return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][weekday] || "dia combinado";
}


function resolveDueDate(subscription: Subscription, today: Date) {
  if (subscription.next_due_date) return subscription.next_due_date;

  const dueDay = Number(subscription.due_day || 10);
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(dueDay, lastDay);

  return `${year}-${String(month + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateOnly(date);
}

function isBefore(dateA: string, dateB: string) {
  return dateA < dateB;
}

function daysBetween(todayDate: string, dueDate: string) {
  const today = new Date(`${todayDate}T00:00:00`);
  const due = new Date(`${dueDate}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function addMonthsKeepingDay(dateText: string, monthsToAdd: number, dueDay: number) {
  const [year, month] = dateText.split("-").map(Number);
  const next = new Date(year, month - 1 + monthsToAdd, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(dueDay, lastDay);

  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

async function createInvoiceMessage(subscription: Subscription, invoice: Invoice, type: string) {
  const subscriptionArena = getRelationItem(subscription.arenas);
  const arenaName = subscriptionArena?.name || "sua arena";
  const phone = normalizePhone(subscription.payment_whatsapp || subscriptionArena?.whatsapp || "");
  const pixKey = subscription.payment_pix_key || "";

  if (!phone) return false;

  const messageBody = buildInvoiceMessage(type, {
    arenaName,
    amount: Number(invoice.amount || 0),
    dueDate: invoice.due_date,
    pixKey,
  });

  const dedupeKey = `${type}:${invoice.id}`;

  const inserted = await insertQueuedMessage({
    arenaId: subscription.arena_id,
    phone,
    customerName: arenaName,
    messageType: type,
    messageBody,
    relatedType: "subscription_invoice",
    relatedId: invoice.id,
    dedupeKey,
    metadata: {
      invoice_id: invoice.id,
      subscription_id: subscription.id,
      due_date: invoice.due_date,
      amount: invoice.amount,
    },
  });

  if (!inserted) return false;

  await createLog(subscription.arena_id, "message_created", `Mensagem automática criada: ${type}.`, {
    invoice_id: invoice.id,
    message_type: type,
  });

  return true;
}

async function createBookingMessage(booking: BookingAutomationRow, type: string) {
  const phone = normalizePhone(booking.customer_whatsapp || "");
  if (!phone) return false;

  const bookingArena = getRelationItem(booking.arenas);
  const arenaName = bookingArena?.name || "sua arena";
  const fieldName = getFieldName(booking.fields);
  const dedupeKey = `${type}:${booking.id}`;

  const messageBody = buildBookingMessage(type, {
    arenaName,
    customerName: booking.customer_name,
    fieldName,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    amount: Number(booking.amount || 0),
  });

  const inserted = await insertQueuedMessage({
    arenaId: booking.arena_id,
    phone,
    customerName: booking.customer_name,
    messageType: type,
    messageBody,
    relatedType: "booking",
    relatedId: booking.id,
    dedupeKey,
    metadata: {
      booking_id: booking.id,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      status: booking.status,
    },
  });

  if (!inserted) return false;

  await createLog(booking.arena_id, "message_created", `Mensagem automática de reserva criada: ${type}.`, {
    booking_id: booking.id,
    message_type: type,
  });

  return true;
}

async function createRecurringBookingMessage(recurring: RecurringAutomationRow, targetDate: string, type: string) {
  const phone = normalizePhone(recurring.customer_whatsapp || "");
  if (!phone) return false;

  const recurringArena = getRelationItem(recurring.arenas);
  const arenaName = recurringArena?.name || "sua arena";
  const fieldName = getFieldName(recurring.fields);
  const dedupeKey = `${type}:${recurring.id}:${targetDate}`;

  const messageBody = buildRecurringMessage(type, {
    arenaName,
    customerName: recurring.customer_name,
    fieldName,
    bookingDate: targetDate,
    startTime: recurring.start_time,
    endTime: recurring.end_time,
  });

  const inserted = await insertQueuedMessage({
    arenaId: recurring.arena_id,
    phone,
    customerName: recurring.customer_name,
    messageType: type,
    messageBody,
    relatedType: "recurring_booking",
    relatedId: recurring.id,
    dedupeKey,
    metadata: {
      recurring_booking_id: recurring.id,
      booking_date: targetDate,
      start_time: recurring.start_time,
      end_time: recurring.end_time,
    },
  });

  if (!inserted) return false;

  await createLog(recurring.arena_id, "message_created", `Mensagem automática de reserva fixa criada: ${type}.`, {
    recurring_booking_id: recurring.id,
    message_type: type,
    booking_date: targetDate,
  });

  return true;
}

async function insertQueuedMessage(input: {
  arenaId: string;
  phone: string;
  customerName: string;
  messageType: string;
  messageBody: string;
  relatedType: string;
  relatedId: string;
  dedupeKey: string;
  metadata: Record<string, any>;
}) {
  const { data: existing, error: existingError } = await adminSupabase
    .from("message_queue")
    .select("id")
    .eq("dedupe_key", input.dedupeKey)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing?.id) return false;

  const { error } = await adminSupabase.from("message_queue").insert({
    arena_id: input.arenaId,
    customer_name: input.customerName,
    phone: input.phone,
    message_type: input.messageType,
    message_body: input.messageBody,
    status: "pending",
    scheduled_at: new Date().toISOString(),
    related_type: input.relatedType,
    related_id: input.relatedId,
    dedupe_key: input.dedupeKey,
    metadata: input.metadata,
  });

  if (error) throw error;

  return true;
}

function buildInvoiceMessage(
  type: string,
  data: {
    arenaName: string;
    amount: number;
    dueDate: string;
    pixKey: string;
  }
) {
  const amount = formatMoney(data.amount);
  const dueDate = formatDate(data.dueDate);
  const pix = data.pixKey ? `\n\nChave Pix: ${data.pixKey}` : "";

  if (type === "subscription_due_soon") {
    return `Olá! Passando para lembrar que a mensalidade do ArenaFlow da ${data.arenaName} vence em 3 dias, no dia ${dueDate}.\n\nValor: R$ ${amount}${pix}\n\nAssim que realizar o pagamento, envie o comprovante por aqui.`;
  }

  if (type === "subscription_due_today") {
    return `Olá! A mensalidade do ArenaFlow da ${data.arenaName} vence hoje (${dueDate}).\n\nValor: R$ ${amount}${pix}\n\nPara manter o sistema ativo, envie o comprovante após o pagamento.`;
  }

  if (type === "subscription_blocked") {
    return `Olá! O acesso do ArenaFlow da ${data.arenaName} foi bloqueado temporariamente por mensalidade em atraso.\n\nValor em aberto: R$ ${amount}\nVencimento: ${dueDate}${pix}\n\nApós o pagamento, envie o comprovante para reativação.`;
  }

  return `Olá! Identificamos uma mensalidade em atraso do ArenaFlow da ${data.arenaName}.\n\nValor: R$ ${amount}\nVencimento: ${dueDate}${pix}\n\nPor favor, envie o comprovante para regularizar o acesso.`;
}

function buildBookingMessage(
  type: string,
  data: {
    arenaName: string;
    customerName: string;
    fieldName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    amount: number;
  }
) {
  const date = formatDate(data.bookingDate);
  const start = data.startTime.slice(0, 5);
  const end = data.endTime.slice(0, 5);
  const amount = formatMoney(data.amount);

  if (type === "booking_reminder_tomorrow") {
    return `Olá, ${data.customerName}! Passando para lembrar sua reserva amanhã na ${data.arenaName}.\n\nQuadra: ${data.fieldName}\nData: ${date}\nHorário: ${start} às ${end}\nValor: R$ ${amount}\n\nNos vemos em quadra!`;
  }

  if (type === "booking_reminder_today") {
    return `Olá, ${data.customerName}! Sua reserva na ${data.arenaName} é hoje.\n\nQuadra: ${data.fieldName}\nHorário: ${start} às ${end}\n\nQualquer dúvida, fale com a arena por aqui.`;
  }

  return `Olá, ${data.customerName}! Sua reserva na ${data.arenaName} está aguardando o envio do sinal/comprovante.\n\nQuadra: ${data.fieldName}\nData: ${date}\nHorário: ${start} às ${end}\nValor: R$ ${amount}\n\nEnvie o comprovante para confirmar seu horário.`;
}

function buildRecurringMessage(
  type: string,
  data: {
    arenaName: string;
    customerName: string;
    fieldName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
  }
) {
  const date = formatDate(data.bookingDate);
  const start = data.startTime.slice(0, 5);
  const end = data.endTime.slice(0, 5);

  return `Olá, ${data.customerName}! Lembrete da sua reserva fixa amanhã na ${data.arenaName}.\n\nQuadra: ${data.fieldName}\nData: ${date}\nHorário: ${start} às ${end}\n\nBom jogo!`;
}

function getRelationItem<T>(relation: Relation<T>): T | null {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0] || null;
  return relation;
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function getFieldName(fields: BookingAutomationRow["fields"] | RecurringAutomationRow["fields"]) {
  if (!fields) return "Quadra";
  if (Array.isArray(fields)) return fields[0]?.name || "Quadra";
  return fields.name || "Quadra";
}

function formatMoney(value: number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

async function createLog(arenaId: string, eventType: string, description: string, metadata: Record<string, any>) {
  await adminSupabase.from("automation_logs").insert({
    arena_id: arenaId,
    event_type: eventType,
    description,
    metadata,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || "";

const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Supabase service role não configurado." }, { status: 500 });
    }

    const receivedToken = request.headers.get("asaas-access-token") || "";

    if (ASAAS_WEBHOOK_TOKEN && receivedToken !== ASAAS_WEBHOOK_TOKEN) {
      return NextResponse.json({ error: "Webhook não autorizado." }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);

    if (!payload) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }

    const eventType = String(payload.event || "");
    const payment = payload.payment || {};
    const asaasPaymentId = payment.id || null;
    const asaasSubscriptionId = payment.subscription || null;
    const asaasCustomerId = payment.customer || null;
    const eventId = payload.id || buildEventId(eventType, asaasPaymentId, payment.status, payment.dateCreated || payment.updatedAt || payment.dueDate);

    if (!eventType) {
      return NextResponse.json({ error: "Evento sem tipo." }, { status: 400 });
    }

    const { data: existingEvent } = await adminSupabase
      .from("asaas_webhook_events")
      .select("id, processed")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent?.processed) {
      return NextResponse.json({ ok: true, duplicated: true });
    }

    const { data: loggedEvent, error: logError } = await adminSupabase
      .from("asaas_webhook_events")
      .upsert({
        event_id: eventId,
        event_type: eventType,
        asaas_payment_id: asaasPaymentId,
        asaas_subscription_id: asaasSubscriptionId,
        asaas_customer_id: asaasCustomerId,
        processed: false,
        payload,
      }, {
        onConflict: "event_id",
      })
      .select("id")
      .single();

    if (logError) {
      return NextResponse.json({ error: logError.message }, { status: 500 });
    }

    const subscription = await findSubscription(asaasSubscriptionId, asaasCustomerId);

    if (asaasPaymentId) {
      await savePayment({
        payment,
        eventType,
        subscription,
      });
    }

    if (subscription) {
      await updateSubscriptionFromPayment({
        subscription,
        payment,
        eventType,
      });
    }

    await adminSupabase
      .from("asaas_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", loggedEvent.id);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const message = error?.message || "Erro ao processar webhook Asaas.";

    try {
      const payload = await request.clone().json().catch(() => null);
      const eventType = String(payload?.event || "UNKNOWN");
      const payment = payload?.payment || {};
      const eventId = payload?.id || buildEventId(eventType, payment?.id, payment?.status, payment?.dateCreated || payment?.updatedAt || payment?.dueDate);

      if (eventId) {
        await adminSupabase
          .from("asaas_webhook_events")
          .upsert({
            event_id: eventId,
            event_type: eventType,
            asaas_payment_id: payment?.id || null,
            asaas_subscription_id: payment?.subscription || null,
            asaas_customer_id: payment?.customer || null,
            processed: false,
            error: message,
            payload: payload || {},
          }, {
            onConflict: "event_id",
          });
      }
    } catch {
      // evita quebrar a resposta do webhook
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function findSubscription(asaasSubscriptionId?: string | null, asaasCustomerId?: string | null) {
  if (asaasSubscriptionId) {
    const { data } = await adminSupabase
      .from("subscriptions")
      .select("*")
      .eq("asaas_subscription_id", asaasSubscriptionId)
      .maybeSingle();

    if (data) return data;
  }

  if (asaasCustomerId) {
    const { data } = await adminSupabase
      .from("subscriptions")
      .select("*")
      .eq("asaas_customer_id", asaasCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) return data;
  }

  return null;
}

async function savePayment({
  payment,
  eventType,
  subscription,
}: {
  payment: any;
  eventType: string;
  subscription: any | null;
}) {
  const asaasPaymentId = payment.id;

  if (!asaasPaymentId) return;

  await adminSupabase.from("asaas_payments").upsert({
    subscription_id: subscription?.id || null,
    arena_id: subscription?.arena_id || null,
    plan_key: subscription?.plan_key || null,
    asaas_payment_id: asaasPaymentId,
    asaas_subscription_id: payment.subscription || subscription?.asaas_subscription_id || null,
    asaas_customer_id: payment.customer || subscription?.asaas_customer_id || null,
    event_type: eventType,
    status: payment.status || null,
    billing_type: payment.billingType || null,
    value: Number(payment.value || 0),
    net_value: Number(payment.netValue || payment.value || 0),
    due_date: payment.dueDate || null,
    payment_date: payment.paymentDate || null,
    client_payment_date: payment.clientPaymentDate || null,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    pix_qr_code: payment.pixQrCode || null,
    pix_payload: payment.pixPayload || null,
    raw_payload: payment,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "asaas_payment_id",
  });
}

async function updateSubscriptionFromPayment({
  subscription,
  payment,
  eventType,
}: {
  subscription: any;
  payment: any;
  eventType: string;
}) {
  const paymentStatus = String(payment.status || "").toUpperCase();
  const nextStatus = mapSubscriptionStatus(paymentStatus, eventType);
  const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentStatus);
  const isOverdue = paymentStatus === "OVERDUE" || eventType === "PAYMENT_OVERDUE";

  const patch: Record<string, any> = {
    billing_provider: "asaas",
    asaas_status: paymentStatus || eventType,
    asaas_last_payment_id: payment.id || subscription.asaas_last_payment_id || null,
    asaas_last_invoice_url: payment.invoiceUrl || subscription.asaas_last_invoice_url || null,
    asaas_last_bank_slip_url: payment.bankSlipUrl || subscription.asaas_last_bank_slip_url || null,
    asaas_last_pix_qr_code: payment.pixQrCode || subscription.asaas_last_pix_qr_code || null,
    asaas_last_pix_payload: payment.pixPayload || subscription.asaas_last_pix_payload || null,
    asaas_next_due_date: payment.dueDate || subscription.asaas_next_due_date || null,
    next_due_date: payment.dueDate || subscription.next_due_date || null,
    updated_at: new Date().toISOString(),
  };

  if (nextStatus) patch.status = nextStatus;

  if (isPaid) {
    patch.status = "active";
    patch.blocked_at = null;
  }

  if (isOverdue) {
    patch.status = "overdue";
  }

  await adminSupabase
    .from("subscriptions")
    .update(patch)
    .eq("id", subscription.id);

  if (subscription.arena_id) {
    const arenaPatch: Record<string, any> = {};

    if (isPaid) {
      arenaPatch.subscription_status = "active";
      arenaPatch.blocked_reason = null;
    }

    if (isOverdue) {
      arenaPatch.subscription_status = "overdue";
      arenaPatch.blocked_reason = "Mensalidade ArenaFlow em atraso no Asaas.";
    }

    if (Object.keys(arenaPatch).length > 0) {
      await adminSupabase
        .from("arenas")
        .update(arenaPatch)
        .eq("id", subscription.arena_id);
    }
  }

  await logAutomation(subscription, eventType, paymentStatus, payment);
}

async function logAutomation(subscription: any, eventType: string, paymentStatus: string, payment: any) {
  if (!subscription?.arena_id) return;

  await adminSupabase.from("automation_logs").insert({
    arena_id: subscription.arena_id,
    event_type: `asaas_${eventType.toLowerCase()}`,
    description: `Webhook Asaas processado: ${eventType} / ${paymentStatus || "sem status"}`,
    metadata: {
      asaas_payment_id: payment.id || null,
      asaas_subscription_id: payment.subscription || null,
      value: payment.value || null,
      due_date: payment.dueDate || null,
    },
  });
}

function mapSubscriptionStatus(paymentStatus: string, eventType: string) {
  if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentStatus)) return "active";
  if (paymentStatus === "OVERDUE" || eventType === "PAYMENT_OVERDUE") return "overdue";
  if (["REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"].includes(paymentStatus)) return "attention";
  if (["DELETED", "CANCELLED"].includes(paymentStatus) || eventType === "PAYMENT_DELETED") return "cancelled";
  if (["PENDING", "AWAITING_PAYMENT"].includes(paymentStatus)) return "pending";
  return null;
}

function buildEventId(eventType?: string | null, paymentId?: string | null, status?: string | null, reference?: string | null) {
  return [eventType || "UNKNOWN", paymentId || "NO_PAYMENT", status || "NO_STATUS", reference || "NO_REF"].join(":");
}

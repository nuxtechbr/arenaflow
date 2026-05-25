import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Plan = {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  monthly_price: number;
  implementation_price: number;
  max_arenas: number;
  allow_multi_arena: boolean;
};

type Arena = {
  id: string;
  name: string;
  slug: string | null;
  whatsapp: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || "";
const ASAAS_ENVIRONMENT = process.env.ASAAS_ENVIRONMENT || "sandbox";

const asaasBaseUrl =
  ASAAS_ENVIRONMENT === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

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

    if (!ASAAS_API_KEY) {
      return NextResponse.json({ error: "ASAAS_API_KEY não configurada." }, { status: 500 });
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Usuário não autenticado." }, { status: 401 });
    }

    const { data: authData, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const arenaId = body?.arena_id;

    if (!arenaId) {
      return NextResponse.json({ error: "arena_id obrigatório." }, { status: 400 });
    }

    const { data: membership } = await adminSupabase
      .from("user_arenas")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("arena_id", arenaId)
      .maybeSingle();

    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("arena_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    const isOwner = Boolean(membership) || profile?.arena_id === arenaId;

    if (!isOwner) {
      return NextResponse.json({ error: "Você não tem acesso a esta arena." }, { status: 403 });
    }

    const { data: existingSubscription } = await adminSupabase
      .from("subscriptions")
      .select("*")
      .eq("arena_id", arenaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planKey = existingSubscription?.plan_key || body?.plan_key || "essential";

    if (existingSubscription?.asaas_subscription_id) {
      return NextResponse.json({
        ok: true,
        already_active: true,
        asaas_subscription_id: existingSubscription.asaas_subscription_id,
        invoice_url: existingSubscription.asaas_last_invoice_url || null,
      });
    }

    const { data: plan, error: planError } = await adminSupabase
      .from("plans")
      .select("*")
      .eq("plan_key", planKey)
      .eq("is_active", true)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    const { data: arena, error: arenaError } = await adminSupabase
      .from("arenas")
      .select("id, name, slug, whatsapp")
      .eq("id", arenaId)
      .maybeSingle();

    if (arenaError || !arena) {
      return NextResponse.json({ error: "Arena não encontrada." }, { status: 404 });
    }

    let subscription = existingSubscription;

    if (!subscription) {
      const { data: createdSubscription, error: createSubError } = await adminSupabase
        .from("subscriptions")
        .insert({
          arena_id: arenaId,
          status: "trialing",
          lifecycle_stage: "trial",
          trial_started_at: new Date().toISOString(),
          trial_ends_at: addDaysIso(new Date(), 7),
          plan_key: plan.plan_key,
          billing_provider: "asaas",
          amount: Number(plan.monthly_price || 0),
          max_arenas: Number(plan.max_arenas || 1),
          allow_multi_arena: Boolean(plan.allow_multi_arena),
        })
        .select("*")
        .single();

      if (createSubError) {
        return NextResponse.json({ error: createSubError.message }, { status: 500 });
      }

      subscription = createdSubscription;
    }

    const customerName = subscription.customer_name || arena.name || authData.user.email || "Cliente ArenaFlow";
    const customerEmail = subscription.customer_email || authData.user.email || undefined;
    const customerPhone = normalizePhone(subscription.customer_phone || arena.whatsapp || "");
    const customerCpfCnpj = onlyDigits(subscription.customer_cpf_cnpj || body?.cpf_cnpj || "");

    if (!isValidCpfCnpjLength(customerCpfCnpj)) {
      return NextResponse.json(
        { error: "Para ativar a assinatura, o CPF ou CNPJ do cliente precisa estar cadastrado no Admin." },
        { status: 400 }
      );
    }

    let asaasCustomerId = subscription.asaas_customer_id;

    if (asaasCustomerId) {
      const updatedCustomer = await updateAsaasCustomer(asaasCustomerId, {
        name: customerName,
        email: customerEmail,
        cpfCnpj: customerCpfCnpj,
        mobilePhone: customerPhone || undefined,
        externalReference: `arena:${arena.id}`,
      });

      await adminSupabase.from("asaas_customers").upsert({
        arena_id: arena.id,
        user_id: authData.user.id,
        subscription_id: subscription.id,
        asaas_customer_id: asaasCustomerId,
        name: customerName,
        email: customerEmail || null,
        mobile_phone: customerPhone || null,
        cpf_cnpj: customerCpfCnpj,
        raw_payload: updatedCustomer,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "asaas_customer_id",
      });
    } else {
      const asaasCustomer = await asaasFetch("/customers", {
        method: "POST",
        body: {
          name: customerName,
          email: customerEmail,
          cpfCnpj: customerCpfCnpj,
          mobilePhone: customerPhone || undefined,
          externalReference: `arena:${arena.id}`,
        },
      });

      asaasCustomerId = asaasCustomer.id;

      await adminSupabase.from("asaas_customers").upsert({
        arena_id: arena.id,
        user_id: authData.user.id,
        subscription_id: subscription.id,
        asaas_customer_id: asaasCustomerId,
        name: customerName,
        email: customerEmail || null,
        mobile_phone: customerPhone || null,
        cpf_cnpj: customerCpfCnpj,
        raw_payload: asaasCustomer,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "asaas_customer_id",
      });
    }

    await adminSupabase
      .from("subscriptions")
      .update({
        customer_name: customerName,
        customer_email: customerEmail || null,
        customer_phone: customerPhone || null,
        customer_cpf_cnpj: customerCpfCnpj,
        asaas_customer_id: asaasCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    const activationDate = new Date();
    const firstDueDate = addMonths(activationDate, 1).toISOString().slice(0, 10);

    const asaasSubscription = await asaasFetch("/subscriptions", {
      method: "POST",
      body: {
        customer: asaasCustomerId,
        billingType: "PIX",
        value: Number(plan.monthly_price || 0),
        nextDueDate: firstDueDate,
        cycle: "MONTHLY",
        description: `${plan.name} - ${arena.name}`,
        externalReference: `arenaflow:${arena.id}:${plan.plan_key}`,
      },
    });

    await adminSupabase.from("asaas_subscriptions").upsert({
      subscription_id: subscription.id,
      arena_id: arena.id,
      plan_key: plan.plan_key,
      billing_type: "PIX",
      activation_date: activationDate.toISOString().slice(0, 10),
      first_due_date: firstDueDate,
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: asaasSubscription.id,
      cycle: asaasSubscription.cycle || "MONTHLY",
      value: Number(asaasSubscription.value || plan.monthly_price || 0),
      next_due_date: asaasSubscription.nextDueDate || firstDueDate,
      status: asaasSubscription.status || "ACTIVE",
      description: asaasSubscription.description || `${plan.name} - ${arena.name}`,
      raw_payload: asaasSubscription,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "asaas_subscription_id",
    });

    await adminSupabase
      .from("subscriptions")
      .update({
        status: "pending",
        lifecycle_stage: "active",
        activated_at: new Date().toISOString(),
        plan_key: plan.plan_key,
        billing_provider: "asaas",
        amount: Number(plan.monthly_price || 0),
        asaas_customer_id: asaasCustomerId,
        asaas_subscription_id: asaasSubscription.id,
        asaas_status: asaasSubscription.status || "ACTIVE",
        asaas_next_due_date: asaasSubscription.nextDueDate || firstDueDate,
        next_due_date: asaasSubscription.nextDueDate || firstDueDate,
        max_arenas: Number(plan.max_arenas || 1),
        allow_multi_arena: Boolean(plan.allow_multi_arena),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id);

    const firstPayment = await findFirstPayment(asaasSubscription.id);
    const pixQrCode = firstPayment?.id ? await getPixQrCode(firstPayment.id) : null;

    if (firstPayment) {
      await savePayment({
        payment: {
          ...firstPayment,
          pixQrCode: pixQrCode?.encodedImage || null,
          pixPayload: pixQrCode?.payload || null,
        },
        subscriptionId: subscription.id,
        arena,
        plan,
      });

      await adminSupabase
        .from("subscriptions")
        .update({
          asaas_last_payment_id: firstPayment.id || null,
          asaas_last_invoice_url: null,
          asaas_last_bank_slip_url: null,
          asaas_last_pix_qr_code: pixQrCode?.encodedImage || null,
          asaas_last_pix_payload: pixQrCode?.payload || null,
          asaas_next_due_date: firstPayment.dueDate || asaasSubscription.nextDueDate || firstDueDate,
          next_due_date: firstPayment.dueDate || asaasSubscription.nextDueDate || firstDueDate,
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscription.id);
    }

    await adminSupabase
      .from("arenas")
      .update({
        subscription_status: "active",
        blocked_reason: null,
      })
      .eq("id", arena.id);

    return NextResponse.json({
      ok: true,
      activated_at: new Date().toISOString(),
      plan_key: plan.plan_key,
      billing_type: "PIX",
      activation_date: activationDate.toISOString().slice(0, 10),
      first_due_date: firstDueDate,
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: asaasSubscription.id,
      invoice_url: null,
      bank_slip_url: null,
      pix_qr_code: pixQrCode?.encodedImage || null,
      pix_payload: pixQrCode?.payload || null,
      due_date: firstPayment?.dueDate || asaasSubscription.nextDueDate || firstDueDate,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao ativar assinatura Asaas." },
      { status: 500 }
    );
  }
}

async function asaasFetch(path: string, options: { method: "GET" | "POST"; body?: any }) {
  const response = await fetch(`${asaasBaseUrl}${path}`, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.errors?.[0]?.description || data?.message || "Erro na API Asaas.");
  }

  return data;
}



async function getPixQrCode(paymentId: string) {
  try {
    return await asaasFetch(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, {
      method: "GET",
    });
  } catch {
    return null;
  }
}

async function updateAsaasCustomer(customerId: string, data: any) {
  return asaasFetch(`/customers/${encodeURIComponent(customerId)}`, {
    method: "POST",
    body: data,
  });
}

async function findFirstPayment(asaasSubscriptionId: string) {
  try {
    const result = await asaasFetch(`/payments?subscription=${encodeURIComponent(asaasSubscriptionId)}&limit=1`, {
      method: "GET",
    });

    return result?.data?.[0] || null;
  } catch {
    return null;
  }
}

async function savePayment({
  payment,
  subscriptionId,
  arena,
  plan,
}: {
  payment: any;
  subscriptionId: string;
  arena: Arena;
  plan: Plan;
}) {
  await adminSupabase.from("asaas_payments").upsert({
    subscription_id: subscriptionId,
    arena_id: arena.id,
    plan_key: plan.plan_key,
    asaas_payment_id: payment.id,
    asaas_subscription_id: payment.subscription || null,
    asaas_customer_id: payment.customer || null,
    event_type: "PAYMENT_CREATED",
    status: payment.status || null,
    billing_type: payment.billingType || null,
    value: Number(payment.value || 0),
    net_value: Number(payment.netValue || payment.value || 0),
    due_date: payment.dueDate || null,
    payment_date: payment.paymentDate || null,
    client_payment_date: payment.clientPaymentDate || null,
    invoice_url: payment.invoiceUrl || null,
    bank_slip_url: payment.bankSlipUrl || null,
    raw_payload: payment,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: "asaas_payment_id",
  });
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpfCnpjLength(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  const originalDay = copy.getDate();

  copy.setMonth(copy.getMonth() + months);

  if (copy.getDate() < originalDay) {
    copy.setDate(0);
  }

  return copy;
}

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function addDaysIso(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString();
}

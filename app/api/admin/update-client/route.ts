import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

    const token = (request.headers.get("authorization") || "").replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Admin não autenticado." }, { status: 401 });
    }

    const { data: authData, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const arenaId = body?.arena_id;
    const subscriptionId = body?.subscription_id || null;
    const arenaName = String(body?.arena_name || "").trim();
    const arenaSlug = slugify(String(body?.arena_slug || arenaName || ""));
    const ownerName = String(body?.owner_name || "").trim();
    const ownerEmail = String(body?.owner_email || "").trim().toLowerCase();
    const ownerWhatsapp = normalizePhone(String(body?.owner_whatsapp || ""));
    const ownerCpfCnpj = onlyDigits(String(body?.owner_cpf_cnpj || ""));
    const planKey = String(body?.plan_key || "essential");
    const status = String(body?.status || "trialing");

    if (!arenaId) return NextResponse.json({ error: "arena_id obrigatório." }, { status: 400 });
    if (!arenaName) return NextResponse.json({ error: "Informe o nome da arena." }, { status: 400 });
    if (!ownerName) return NextResponse.json({ error: "Informe o nome do responsável." }, { status: 400 });
    if (!ownerEmail) return NextResponse.json({ error: "Informe o e-mail do responsável." }, { status: 400 });
    if (![11, 14].includes(ownerCpfCnpj.length)) {
      return NextResponse.json({ error: "Informe CPF ou CNPJ válido." }, { status: 400 });
    }

    const { data: plan, error: planError } = await adminSupabase
      .from("plans")
      .select("*")
      .eq("plan_key", planKey)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plano não encontrado." }, { status: 404 });
    }

    const arenaPatch: Record<string, any> = {
      name: arenaName,
      slug: arenaSlug,
      whatsapp: ownerWhatsapp || null,
      phone: ownerWhatsapp || null,
    };

    if (status === "blocked") {
      arenaPatch.subscription_status = "blocked";
      arenaPatch.blocked_reason = "Acesso bloqueado pelo Admin Master.";
    } else {
      arenaPatch.subscription_status = "active";
      arenaPatch.blocked_reason = null;
    }

    const { error: arenaError } = await adminSupabase
      .from("arenas")
      .update(arenaPatch)
      .eq("id", arenaId);

    if (arenaError) {
      return NextResponse.json({ error: arenaError.message }, { status: 500 });
    }

    const lifecycleStage =
      status === "trialing"
        ? "trial"
        : status === "active"
          ? "active"
          : status === "blocked"
            ? "blocked"
            : status === "overdue"
              ? "overdue"
              : status;

    const subscriptionPatch: Record<string, any> = {
      arena_id: arenaId,
      plan_key: plan.plan_key,
      billing_provider: "asaas",
      status,
      lifecycle_stage: lifecycleStage,
      customer_name: ownerName,
      customer_email: ownerEmail,
      customer_phone: ownerWhatsapp || null,
      customer_cpf_cnpj: ownerCpfCnpj,
      monthly_amount: Number(plan.monthly_price || 0),
      max_arenas: Number(plan.max_arenas || 1),
      allow_multi_arena: Boolean(plan.allow_multi_arena),
    };

    if (status === "trialing") {
      subscriptionPatch.trial_started_at = new Date().toISOString();
      subscriptionPatch.trial_ends_at = addDays(new Date(), 7).toISOString();
      subscriptionPatch.blocked_at = null;
    }

    if (status === "active") {
      subscriptionPatch.activated_at = new Date().toISOString();
      subscriptionPatch.blocked_at = null;
    }

    if (status === "blocked") {
      subscriptionPatch.blocked_at = new Date().toISOString();
    }

    let savedSubscription = null;

    if (subscriptionId) {
      const { data, error } = await adminSupabase
        .from("subscriptions")
        .update(subscriptionPatch)
        .eq("id", subscriptionId)
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      savedSubscription = data;
    } else {
      const { data, error } = await adminSupabase
        .from("subscriptions")
        .insert({
          ...subscriptionPatch,
          trial_started_at: new Date().toISOString(),
          trial_ends_at: addDays(new Date(), 7).toISOString(),
        })
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      savedSubscription = data;
    }

    await updateOwnerProfile(arenaId, {
      email: ownerEmail,
      name: ownerName,
      whatsapp: ownerWhatsapp || null,
      arena_id: arenaId,
      role: "arena_owner",
    });

    return NextResponse.json({
      ok: true,
      subscription: savedSubscription,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar cliente." },
      { status: 500 }
    );
  }
}

async function updateOwnerProfile(arenaId: string, patch: Record<string, any>) {
  const { data: relation } = await adminSupabase
    .from("user_arenas")
    .select("user_id")
    .eq("arena_id", arenaId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!relation?.user_id) return;

  await adminSupabase
    .from("profiles")
    .update(patch)
    .eq("id", relation.user_id);
}

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(phone: string) {
  const clean = onlyDigits(phone);
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
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

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

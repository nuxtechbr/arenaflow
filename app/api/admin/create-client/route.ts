import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://arenaflowbr.netlify.app";

const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
  },
});

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;
  let createdArenaId: string | null = null;

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Supabase service role não configurado." },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Admin não autenticado." }, { status: 401 });
    }

    const { data: authData, error: authError } = await adminSupabase.auth.getUser(token);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    const ownerName = String(body?.owner_name || "").trim();
    const ownerEmail = String(body?.owner_email || "").trim().toLowerCase();
    const ownerWhatsapp = normalizePhone(String(body?.owner_whatsapp || ""));
    const ownerCpfCnpj = onlyDigits(String(body?.owner_cpf_cnpj || ""));
    const ownerPassword = String(body?.owner_password || "").trim();
    const arenaName = String(body?.arena_name || "").trim();
    const requestedSlug = String(body?.arena_slug || "").trim();
    const planKey = String(body?.plan_key || "essential");
    const trialDays = Number(body?.trial_days || 7);

    if (!ownerName) {
      return NextResponse.json({ error: "Informe o nome do responsável." }, { status: 400 });
    }

    if (!ownerEmail) {
      return NextResponse.json({ error: "Informe o e-mail do responsável." }, { status: 400 });
    }

    if (!ownerPassword || ownerPassword.length < 6) {
      return NextResponse.json(
        { error: "A senha precisa ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    if (!isValidCpfCnpjLength(ownerCpfCnpj)) {
      return NextResponse.json(
        { error: "Informe um CPF ou CNPJ válido para o Asaas." },
        { status: 400 }
      );
    }

    if (!arenaName) {
      return NextResponse.json({ error: "Informe o nome da arena." }, { status: 400 });
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

    const slug = await createUniqueSlug(requestedSlug || arenaName);

    const { data: userData, error: userError } = await adminSupabase.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: {
        name: ownerName,
        whatsapp: ownerWhatsapp,
        cpf_cnpj: ownerCpfCnpj,
        role: "arena_owner",
      },
    });

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: userError?.message || "Erro ao criar usuário." },
        { status: 500 }
      );
    }

    createdUserId = userData.user.id;

    const { data: arena, error: arenaError } = await adminSupabase
      .from("arenas")
      .insert({
        name: arenaName,
        slug,
        whatsapp: ownerWhatsapp || null,
        phone: ownerWhatsapp || null,
        subscription_status: "active",
        blocked_reason: null,
      })
      .select("*")
      .single();

    if (arenaError || !arena) {
      await deleteAuthUser(createdUserId);
      return NextResponse.json(
        { error: arenaError?.message || "Erro ao criar arena." },
        { status: 500 }
      );
    }

    createdArenaId = arena.id;

    const now = new Date();
    const trialEndsAt = addDays(now, Number.isFinite(trialDays) ? trialDays : 7);

    const profileRes = await adminSupabase.from("profiles").upsert(
      {
        id: createdUserId,
        email: ownerEmail,
        arena_id: arena.id,
        name: ownerName,
        whatsapp: ownerWhatsapp || null,
        role: "arena_owner",
      },
      { onConflict: "id" }
    );

    if (profileRes.error) {
      await rollback(createdUserId, createdArenaId);
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    }

    const linkRes = await adminSupabase.from("user_arenas").insert({
      user_id: createdUserId,
      arena_id: arena.id,
      role: "owner",
    });

    if (linkRes.error) {
      await rollback(createdUserId, createdArenaId);
      return NextResponse.json({ error: linkRes.error.message }, { status: 500 });
    }

    const subscriptionRes = await adminSupabase
      .from("subscriptions")
      .insert({
        arena_id: arena.id,
        plan_key: plan.plan_key,
        billing_provider: "asaas",
        status: "trialing",
        lifecycle_stage: "trial",
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEndsAt.toISOString(),
        customer_name: ownerName,
        customer_email: ownerEmail,
        customer_phone: ownerWhatsapp || null,
        customer_cpf_cnpj: ownerCpfCnpj,
        monthly_amount: Number(plan.monthly_price || 0),
        max_arenas: Number(plan.max_arenas || 1),
        allow_multi_arena: Boolean(plan.allow_multi_arena),
      })
      .select("*")
      .single();

    if (subscriptionRes.error) {
      await rollback(createdUserId, createdArenaId);
      return NextResponse.json({ error: subscriptionRes.error.message }, { status: 500 });
    }

    await adminSupabase.from("arena_settings").insert({
      arena_id: arena.id,
      require_deposit: false,
      receipt_whatsapp: ownerWhatsapp || null,
    });

    await adminSupabase.from("onboarding_checklists").upsert(
      {
        arena_id: arena.id,
        has_logo: false,
        has_cover: false,
        has_gallery: false,
        has_fields: false,
        has_prices: false,
        has_hours: false,
        has_pix: false,
        public_link_tested: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "arena_id" }
    );

    return NextResponse.json({
      ok: true,
      owner_id: createdUserId,
      owner_email: ownerEmail,
      owner_password: ownerPassword,
      owner_cpf_cnpj: ownerCpfCnpj,
      owner_name: ownerName,
      arena,
      plan_key: plan.plan_key,
      plan_name: plan.name,
      subscription: subscriptionRes.data,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      login_url: `${APP_URL}/login`,
      note: "Cliente criado em trial. Nenhuma assinatura Asaas foi criada ainda.",
    });
  } catch (error: any) {
    if (createdUserId || createdArenaId) {
      await rollback(createdUserId, createdArenaId);
    }

    return NextResponse.json(
      { error: error?.message || "Erro ao criar cliente." },
      { status: 500 }
    );
  }
}

async function rollback(userId: string | null, arenaId: string | null) {
  if (arenaId) {
    await adminSupabase.from("arenas").delete().eq("id", arenaId);
  }

  if (userId) {
    await deleteAuthUser(userId);
  }
}

async function deleteAuthUser(userId: string) {
  try {
    await adminSupabase.auth.admin.deleteUser(userId);
  } catch {
    // evita quebrar resposta caso o usuário já tenha sido removido
  }
}

async function createUniqueSlug(name: string) {
  const base = slugify(name) || "arena";
  let slug = base;

  for (let index = 1; index <= 50; index++) {
    const { data } = await adminSupabase
      .from("arenas")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (!data) return slug;

    slug = `${base}-${index + 1}`;
  }

  return `${base}-${Date.now()}`;
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

function onlyDigits(value: string) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpfCnpjLength(value: string) {
  const digits = onlyDigits(value);
  return digits.length === 11 || digits.length === 14;
}

function normalizePhone(phone: string) {
  const clean = onlyDigits(phone);
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

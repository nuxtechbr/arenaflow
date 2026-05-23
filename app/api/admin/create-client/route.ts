import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEFAULT_PIX_KEY = "5522999270052";
const DEFAULT_PAYMENT_WHATSAPP = "5522999270052";
const DEFAULT_PLAN = "ArenaFlow Start";
const DEFAULT_MONTHLY_AMOUNT = 89.9;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function addOneMonth(date: Date) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Variáveis NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas.",
        },
        { status: 500 }
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const body = await request.json();

    const ownerName = String(body.ownerName || "").trim();
    const ownerWhatsapp = String(body.ownerWhatsapp || "").replace(/\D/g, "");
    const ownerEmail = String(body.ownerEmail || "").trim().toLowerCase();
    const ownerPassword = String(body.ownerPassword || "").trim();
    const arenaName = String(body.arenaName || "").trim();
    const arenaSlug = slugify(String(body.arenaSlug || arenaName || ""));
    const planName = String(body.planName || DEFAULT_PLAN).trim();
    const monthlyAmount = Number(body.monthlyAmount || DEFAULT_MONTHLY_AMOUNT);

    if (!ownerName) {
      return NextResponse.json({ error: "Informe o nome do dono." }, { status: 400 });
    }

    if (!ownerEmail) {
      return NextResponse.json({ error: "Informe o e-mail do dono." }, { status: 400 });
    }

    if (!ownerPassword || ownerPassword.length < 6) {
      return NextResponse.json(
        { error: "A senha precisa ter pelo menos 6 caracteres." },
        { status: 400 }
      );
    }

    if (!arenaName) {
      return NextResponse.json({ error: "Informe o nome da arena." }, { status: 400 });
    }

    if (!arenaSlug) {
      return NextResponse.json({ error: "Informe um slug válido." }, { status: 400 });
    }

    const fullWhatsapp = ownerWhatsapp.startsWith("55")
      ? ownerWhatsapp
      : `55${ownerWhatsapp}`;

    const { data: existingArena } = await adminSupabase
      .from("arenas")
      .select("id")
      .eq("slug", arenaSlug)
      .maybeSingle();

    if (existingArena) {
      return NextResponse.json(
        { error: "Já existe uma arena com esse slug. Escolha outro." },
        { status: 400 }
      );
    }

    const { data: userCreated, error: userError } =
      await adminSupabase.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: {
          name: ownerName,
          whatsapp: fullWhatsapp,
          role: "owner",
        },
      });

    if (userError || !userCreated.user) {
      return NextResponse.json(
        { error: userError?.message || "Erro ao criar usuário." },
        { status: 400 }
      );
    }

    const userId = userCreated.user.id;

    const { data: arena, error: arenaError } = await adminSupabase
      .from("arenas")
      .insert({
        name: arenaName,
        slug: arenaSlug,
        whatsapp: fullWhatsapp,
        phone: fullWhatsapp,
        description:
          "Arena cadastrada pelo ArenaFlow. Configure fotos, horários, quadras e valores no painel.",
        subscription_status: "active",
        blocked_reason: null,
      })
      .select("*")
      .single();

    if (arenaError || !arena) {
      await adminSupabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: arenaError?.message || "Erro ao criar arena." },
        { status: 400 }
      );
    }

    const arenaId = arena.id;

    const { error: profileError } = await adminSupabase.from("profiles").upsert({
      id: userId,
      arena_id: arenaId,
      name: ownerName,
      whatsapp: fullWhatsapp,
      email: ownerEmail,
    });

    if (profileError) {
      console.error("Erro ao criar profile:", profileError.message);
    }

    const { error: userArenaError } = await adminSupabase
      .from("user_arenas")
      .insert({
        user_id: userId,
        arena_id: arenaId,
        role: "owner",
      });

    if (userArenaError) {
      await adminSupabase.from("arenas").delete().eq("id", arenaId);
      await adminSupabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: userArenaError.message },
        { status: 400 }
      );
    }

    const today = new Date();
    const nextDue = addOneMonth(today);
    const nextDueDate = toDateOnly(nextDue);
    const dueDay = today.getDate();
    const referenceMonth = nextDueDate.slice(0, 7);

    const { data: subscription, error: subscriptionError } = await adminSupabase
      .from("subscriptions")
      .insert({
        arena_id: arenaId,
        plan_name: planName,
        monthly_amount: monthlyAmount,
        due_day: dueDay,
        status: "active",
        next_due_date: nextDueDate,
        last_paid_at: today.toISOString(),
        payment_pix_key: DEFAULT_PIX_KEY,
        payment_whatsapp: DEFAULT_PAYMENT_WHATSAPP,
        notes:
          "Cliente criado pelo Admin Master. Implementação paga. Primeira mensalidade no próximo mês.",
      })
      .select("*")
      .single();

    if (subscriptionError || !subscription) {
      await adminSupabase.from("user_arenas").delete().eq("arena_id", arenaId);
      await adminSupabase.from("arenas").delete().eq("id", arenaId);
      await adminSupabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: subscriptionError?.message || "Erro ao criar assinatura." },
        { status: 400 }
      );
    }

    const { error: invoiceError } = await adminSupabase
      .from("subscription_invoices")
      .insert({
        arena_id: arenaId,
        subscription_id: subscription.id,
        reference_month: referenceMonth,
        due_date: nextDueDate,
        amount: monthlyAmount,
        paid_amount: 0,
        status: "pending",
        notes: "Primeira mensalidade após implementação inicial.",
      });

    if (invoiceError) {
      await adminSupabase.from("subscriptions").delete().eq("id", subscription.id);
      await adminSupabase.from("user_arenas").delete().eq("arena_id", arenaId);
      await adminSupabase.from("arenas").delete().eq("id", arenaId);
      await adminSupabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: invoiceError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userId,
        email: ownerEmail,
      },
      arena: {
        id: arenaId,
        name: arenaName,
        slug: arenaSlug,
      },
      subscription: {
        id: subscription.id,
        plan_name: planName,
        monthly_amount: monthlyAmount,
        next_due_date: nextDueDate,
      },
      login: {
        url: "/login",
        email: ownerEmail,
        password: ownerPassword,
      },
      public_url: `/arena/${arenaSlug}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro interno ao criar cliente." },
      { status: 500 }
    );
  }
}
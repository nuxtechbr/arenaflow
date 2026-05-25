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

    const name = String(body?.name || "").trim();
    const whatsapp = normalizePhone(String(body?.whatsapp || ""));
    const address = String(body?.address || "").trim();
    const description = String(body?.description || "").trim();
    const sourceArenaId = body?.source_arena_id || null;

    if (!name) {
      return NextResponse.json({ error: "Informe o nome da arena." }, { status: 400 });
    }

    const { data: userArenas, error: arenasError } = await adminSupabase
      .from("user_arenas")
      .select("id, arena_id, role, arena:arenas(id, name)")
      .eq("user_id", authData.user.id);

    if (arenasError) {
      return NextResponse.json({ error: arenasError.message }, { status: 500 });
    }

    const currentArenaCount = userArenas?.length || 0;

    if (currentArenaCount > 0) {
      const arenaIdForPlan = sourceArenaId || userArenas?.[0]?.arena_id;

      const { data: subscription } = await adminSupabase
        .from("subscriptions")
        .select("id, plan_key, status, allow_multi_arena, max_arenas")
        .eq("arena_id", arenaIdForPlan)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const allowMultiArena = Boolean(subscription?.allow_multi_arena);
      const maxArenas = Number(subscription?.max_arenas || 1);

      if (!allowMultiArena || currentArenaCount >= maxArenas) {
        return NextResponse.json(
          {
            error: "Seu plano atual não permite criar outra arena. Faça upgrade para o ArenaFlow Pro.",
            code: "PLAN_LIMIT_REACHED",
          },
          { status: 403 }
        );
      }
    }

    const slug = await createUniqueSlug(name);

    const { data: arena, error: arenaError } = await adminSupabase
      .from("arenas")
      .insert({
        name,
        slug,
        whatsapp: whatsapp || null,
        phone: whatsapp || null,
        address: address || null,
        description: description || null,
        subscription_status: "active",
      })
      .select("*")
      .single();

    if (arenaError || !arena) {
      return NextResponse.json({ error: arenaError?.message || "Erro ao criar arena." }, { status: 500 });
    }

    const { error: linkError } = await adminSupabase.from("user_arenas").insert({
      user_id: authData.user.id,
      arena_id: arena.id,
      role: "owner",
    });

    if (linkError) {
      await adminSupabase.from("arenas").delete().eq("id", arena.id);
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    await adminSupabase
      .from("profiles")
      .update({ arena_id: arena.id })
      .eq("id", authData.user.id);

    await adminSupabase.from("arena_settings").insert({
      arena_id: arena.id,
      require_deposit: false,
      pix_key: null,
      receipt_whatsapp: whatsapp || null,
    }).select("id").maybeSingle();

    await adminSupabase.from("onboarding_checklists").upsert({
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
    }, {
      onConflict: "arena_id",
    });

    return NextResponse.json({
      ok: true,
      arena,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao criar nova arena." },
      { status: 500 }
    );
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

function normalizePhone(phone: string) {
  const clean = String(phone || "").replace(/\D/g, "");
  if (!clean) return "";
  return clean.startsWith("55") ? clean : `55${clean}`;
}

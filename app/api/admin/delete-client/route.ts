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

    if (!arenaId) {
      return NextResponse.json({ error: "arena_id obrigatório." }, { status: 400 });
    }

    const { data: owners } = await adminSupabase
      .from("user_arenas")
      .select("user_id")
      .eq("arena_id", arenaId);

    await adminSupabase.from("subscriptions").delete().eq("arena_id", arenaId);
    await adminSupabase.from("asaas_payments").delete().eq("arena_id", arenaId);
    await adminSupabase.from("asaas_subscriptions").delete().eq("arena_id", arenaId);
    await adminSupabase.from("asaas_customers").delete().eq("arena_id", arenaId);
    await adminSupabase.from("message_queue").delete().eq("arena_id", arenaId);
    await adminSupabase.from("automation_logs").delete().eq("arena_id", arenaId);
    await adminSupabase.from("onboarding_checklists").delete().eq("arena_id", arenaId);
    await adminSupabase.from("user_arenas").delete().eq("arena_id", arenaId);
    await adminSupabase.from("arenas").delete().eq("id", arenaId);

    for (const owner of owners || []) {
      if (owner.user_id) {
        try {
          await adminSupabase.auth.admin.deleteUser(owner.user_id);
        } catch {
          // usuário pode já ter sido removido
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir cliente." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function normalizeWhatsapp(value: string) {
  const clean = value.replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const arenaId = String(body.arenaId || "");
    const whatsapp = normalizeWhatsapp(String(body.whatsapp || ""));
    const code = String(body.code || "").replace(/\D/g, "");

    if (!arenaId || !whatsapp || !code) {
      return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("customer_login_codes")
      .select("*")
      .eq("arena_id", arenaId)
      .eq("whatsapp", whatsapp)
      .eq("code", code)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Código inválido ou expirado." }, { status: 401 });
    }

    await supabase
      .from("customer_login_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", data[0].id);

    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, whatsapp")
      .eq("arena_id", arenaId)
      .eq("whatsapp", whatsapp)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      session: {
        arenaId,
        whatsapp,
        customerId: customer?.id || null,
        customerName: customer?.name || null,
        loggedAt: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao validar código." }, { status: 500 });
  }
}
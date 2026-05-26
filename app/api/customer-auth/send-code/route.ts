import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizeWhatsapp(value: string) {
  const clean = value.replace(/\D/g, "");
  return clean.startsWith("55") ? clean : `55${clean}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const arenaId = String(body.arenaId || "");
    const whatsapp = normalizeWhatsapp(String(body.whatsapp || ""));

    if (!arenaId) {
      return NextResponse.json({ error: "Arena não informada." }, { status: 400 });
    }

    if (whatsapp.length < 12) {
      return NextResponse.json({ error: "WhatsApp inválido." }, { status: 400 });
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { error } = await supabase.from("customer_login_codes").insert({
      arena_id: arenaId,
      whatsapp,
      code,
      expires_at: expiresAt,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const message = `ArenaFlow

Seu código de acesso é: ${code}

Esse código expira em 5 minutos.`;

    return NextResponse.json({
      success: true,
      whatsapp,
      code,
      message,
      whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao enviar código." }, { status: 500 });
  }
}
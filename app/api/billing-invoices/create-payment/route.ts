import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ASAAS_API_URL = "https://sandbox.asaas.com/api/v3";
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const invoiceId = String(body.invoice_id || "");

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoice_id obrigatório." },
        { status: 400 }
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("billing_invoices")
      .select("*")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invoiceError) {
      return NextResponse.json(
        { error: invoiceError.message },
        { status: 500 }
      );
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Mensalidade não encontrada." },
        { status: 404 }
      );
    }

    if (invoice.payment_url) {
      return NextResponse.json({
        success: true,
        payment_url: invoice.payment_url,
      });
    }

    const { data: arena, error: arenaError } = await supabaseAdmin
      .from("arenas")
      .select("*")
      .eq("id", invoice.arena_id)
      .maybeSingle();

    if (arenaError) {
      return NextResponse.json(
        { error: arenaError.message },
        { status: 500 }
      );
    }

    if (!arena) {
      return NextResponse.json(
        { error: "Arena não encontrada." },
        { status: 404 }
      );
    }

    if (!process.env.ASAAS_API_KEY) {
      return NextResponse.json(
        { error: "ASAAS_API_KEY não configurada." },
        { status: 500 }
      );
    }

    let customerId = arena.asaas_customer_id;

    if (!customerId) {
      const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: process.env.ASAAS_API_KEY,
        },

       body: JSON.stringify({
  name: arena.responsible_name || arena.name || "Cliente ArenaFlow",
  email: arena.email || `cliente-${arena.id}@arenaflow.com`,
  cpfCnpj: String(arena.cpf_cnpj || "").replace(/\D/g, ""),
  mobilePhone: String(arena.whatsapp || "").replace(/\D/g, ""),
}),

      });

      const customerData = await customerResponse.json();

      if (!customerResponse.ok) {
        return NextResponse.json(
          { error: customerData.errors?.[0]?.description || "Erro ao criar cliente no Asaas." },
          { status: 500 }
        );
      }

      customerId = customerData.id;

      await supabaseAdmin
        .from("arenas")
        .update({ asaas_customer_id: customerId })
        .eq("id", arena.id);
    }

    const paymentResponse = await fetch(`${ASAAS_API_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: process.env.ASAAS_API_KEY,
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: Number(invoice.amount),
        dueDate: invoice.due_date,
        description: `Mensalidade ArenaFlow - ${arena.name || "Arena"}`,
      }),
    });

    const paymentData = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return NextResponse.json(
        { error: paymentData.errors?.[0]?.description || "Erro ao criar cobrança no Asaas." },
        { status: 500 }
      );
    }

    await supabaseAdmin
  .from("billing_invoices")
  .update({
    payment_url: paymentData.invoiceUrl || null,
    pix_payload: paymentData.pixTransaction?.payload || null,
    asaas_payment_id: paymentData.id || null,
    notes: paymentData.id ? `Asaas payment: ${paymentData.id}` : invoice.notes,
  })
  .eq("id", invoice.id);
  
    return NextResponse.json({
      success: true,
      payment_url: paymentData.invoiceUrl,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Erro interno ao gerar cobrança." },
      { status: 500 }
    );
  }
}
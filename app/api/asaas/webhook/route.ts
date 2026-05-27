import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const event = String(body.event || "");
    const payment = body.payment || {};
    const paymentId = String(payment.id || "");

    if (!paymentId) {
      return NextResponse.json({ ok: true });
    }

    const paidEvents = [
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
    ];

    const overdueEvents = ["PAYMENT_OVERDUE"];

    if (paidEvents.includes(event)) {
      await supabaseAdmin
        .from("billing_invoices")
        .update({
          status: "paid",
          paid_at:
            payment.paymentDate ||
            payment.clientPaymentDate ||
            new Date().toISOString(),
        })
        .eq("asaas_payment_id", paymentId);

      return NextResponse.json({ ok: true });
    }

    if (overdueEvents.includes(event)) {
      await supabaseAdmin
        .from("billing_invoices")
        .update({
          status: "overdue",
        })
        .eq("asaas_payment_id", paymentId);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Erro webhook Asaas:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'app', 'dashboard', 'billing', 'page.tsx');
if (!fs.existsSync(file)) {
  console.error('Arquivo não encontrado:', file);
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');

function replaceOnce(find, replacement, label) {
  if (!s.includes(find)) {
    console.warn('Não encontrei:', label);
    return false;
  }
  s = s.replace(find, replacement);
  console.log('OK:', label);
  return true;
}

// 1) Add BillingInvoice type
if (!s.includes('type BillingInvoice =')) {
  const marker = `type AsaasPayment = {
  id: string;
  arena_id: string | null;
  subscription_id: string | null;
  asaas_payment_id: string;
  status: string | null;
  billing_type: string | null;
  value: number | null;
  due_date: string | null;
  payment_date: string | null;
  invoice_url: string | null;
  bank_slip_url: string | null;
  pix_qr_code: string | null;
  pix_payload: string | null;
  created_at: string;
};`;
  const inserted = `${marker}

type BillingInvoice = {
  id: string;
  arena_id: string;
  subscription_id: string | null;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
  payment_url: string | null;
  pix_payload: string | null;
  notes: string | null;
  created_at: string;
};`;
  replaceOnce(marker, inserted, 'type BillingInvoice');
}

// 2) Add state
if (!s.includes('const [billingInvoices, setBillingInvoices]')) {
  replaceOnce(
    `  const [asaasPayments, setAsaasPayments] = useState<AsaasPayment[]>([]);`,
    `  const [asaasPayments, setAsaasPayments] = useState<AsaasPayment[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);`,
    'state billingInvoices'
  );
}

// 3) Add invoice memos after latestAsaasPayment
if (!s.includes('const sortedBillingInvoices = useMemo')) {
  replaceOnce(
    `  const latestAsaasPayment = useMemo(() => asaasPayments[0] || null, [asaasPayments]);`,
    `  const latestAsaasPayment = useMemo(() => asaasPayments[0] || null, [asaasPayments]);

  const sortedBillingInvoices = useMemo(() => {
    return [...billingInvoices].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
  }, [billingInvoices]);

  const currentBillingInvoice = useMemo(() => {
    return sortedBillingInvoices.find((invoice) => invoice.status !== "paid") || sortedBillingInvoices[0] || null;
  }, [sortedBillingInvoices]);

  const paidBillingInvoices = useMemo(() => {
    return sortedBillingInvoices.filter((invoice) => invoice.status === "paid").reverse();
  }, [sortedBillingInvoices]);`,
    'memos billingInvoices'
  );
}

// 4) Fix trial date source if still using today
s = s.replace(/daysBetween\(today,/g, 'daysBetween(getTodayDate(),');

// 5) Replace nextDueDate block
s = s.replace(
  /  const nextDueDate =\n    subscription\?\.asaas_next_due_date \|\|\n    subscription\?\.next_due_date \|\|\n    subscription\?\.current_period_end \|\|\n    latestAsaasPayment\?\.due_date \|\|\n    "";/,
  `  const nextDueDate =
    currentBillingInvoice?.due_date ||
    subscription?.next_due_date ||
    subscription?.asaas_next_due_date ||
    subscription?.current_period_end ||
    latestAsaasPayment?.due_date ||
    "";

  const shouldShowActivationCta =
    !isActive &&
    !subscription?.activated_at &&
    !subscription?.asaas_subscription_id;`
);

// 6) Load billing_invoices in Promise.all
s = s.replace(
  `    const [plansRes, subscriptionRes, paymentsRes] = await Promise.all([`,
  `    const [plansRes, subscriptionRes, paymentsRes, invoicesRes] = await Promise.all([`
);
s = s.replace(
  `      supabase
        .from("asaas_payments")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);`,
  `      supabase
        .from("asaas_payments")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("billing_invoices")
        .select("*")
        .eq("arena_id", activeArenaId)
        .order("due_date", { ascending: true }),
    ]);`
);

// 7) Add invoice error + setter
if (!s.includes('if (invoicesRes.error) return alert(invoicesRes.error.message);')) {
  s = s.replace(
    `    if (paymentsRes.error) return alert(paymentsRes.error.message);

    setPlans((plansRes.data || []) as Plan[]);`,
    `    if (paymentsRes.error) return alert(paymentsRes.error.message);
    if (invoicesRes.error) return alert(invoicesRes.error.message);

    setPlans((plansRes.data || []) as Plan[]);`
  );
}
if (!s.includes('setBillingInvoices((invoicesRes.data || []) as BillingInvoice[]);')) {
  s = s.replace(
    `    setAsaasPayments((paymentsRes.data || []) as AsaasPayment[]);`,
    `    setAsaasPayments((paymentsRes.data || []) as AsaasPayment[]);
    setBillingInvoices((invoicesRes.data || []) as BillingInvoice[]);`
  );
}

// 8) Badge Asaas/Sem recorrencia
s = s.replace(
  `{subscription?.asaas_subscription_id ? (
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-black text-blue-300">
                    Asaas conectado
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
                    Sem recorrência ativa
                  </span>
                )}`,
  `{isActive ? (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
                    Assinatura ativa
                  </span>
                ) : (
                  <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300">
                    Sem recorrência ativa
                  </span>
                )}`
);

// 9) Monthly value fallback remove subscription.amount if type may not exist in DB but TS has it; keep OK.

// 10) Cobrança atual copy
s = s.replace(
  `{subscription?.asaas_subscription_id
              ? "Sua cobrança Asaas aparece aqui."
              : "Você ainda não possui recorrência ativa. Ative a assinatura para começar."}`,
  `{isActive
              ? "Sua mensalidade atual fica sempre disponível aqui. Quando for paga, a próxima será criada automaticamente."
              : "Você ainda não possui recorrência ativa. Ative a assinatura para começar."}`
);

// 11) Insert current invoice card inside cobrança atual space before QR block
if (!s.includes('Mensalidade atual</p>')) {
  s = s.replace(
    `          <div className="mt-5 space-y-3">
            {(latestPix?.qrCode || subscription?.asaas_last_pix_qr_code || latestAsaasPayment?.pix_qr_code) && (`,
    `          <div className="mt-5 space-y-3">
            {currentBillingInvoice && (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Mensalidade atual</p>
                <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-2xl font-black text-white">R$ {formatMoney(currentBillingInvoice.amount)}</p>
                    <p className="mt-1 text-sm text-slate-300">Vencimento: {formatDate(currentBillingInvoice.due_date)}</p>
                    <StatusBadge status={currentBillingInvoice.status || "open"} />
                  </div>

                  {currentBillingInvoice.payment_url ? (
                    <a
                      href={currentBillingInvoice.payment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-400"
                    >
                      <ExternalLink size={16} />
                      Pagar agora
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={openSupportWhatsapp}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-400"
                    >
                      <MessageCircle size={16} />
                      Solicitar Pix
                    </button>
                  )}
                </div>
              </div>
            )}

            {(latestPix?.qrCode || subscription?.asaas_last_pix_qr_code || latestAsaasPayment?.pix_qr_code) && (`
  );
}

// 12) hide activation CTA conditions
s = s.replace(/!subscription\?\.asaas_subscription_id/g, 'shouldShowActivationCta');

// 13) PlanCard props canActivate may have been impacted, make explicit
s = s.replace(
  `canActivate={shouldShowActivationCta && (subscription?.plan_key || "essential") === plan.plan_key}`,
  `canActivate={shouldShowActivationCta && (subscription?.plan_key || "essential") === plan.plan_key}`
);

// 14) Add internal billing history panel before Asaas history
if (!s.includes('BillingHistoryPanel\n        title="Mensalidades ArenaFlow"')) {
  s = s.replace(
    `      <BillingHistoryPanel
        title="Pagamentos Asaas"
        empty="Nenhum pagamento Asaas registrado ainda."
      >`,
    `      <BillingHistoryPanel
        title="Mensalidades ArenaFlow"
        empty="Nenhuma mensalidade registrada ainda."
      >
        {sortedBillingInvoices.map((invoice) => (
          <PaymentRow
            key={invoice.id}
            title={invoice.status === "paid" ? "Mensalidade paga" : "Mensalidade em aberto"}
            status={invoice.status || "open"}
            amount={invoice.amount || 0}
            dueDate={invoice.due_date}
            paidDate={invoice.paid_at}
            invoiceUrl={invoice.payment_url}
          />
        ))}
      </BillingHistoryPanel>

      <BillingHistoryPanel
        title="Pagamentos Asaas"
        empty="Nenhum pagamento Asaas registrado ainda."
      >`
  );
}

// 15) Translate open/paid statuses
s = s.replace(
  `    OVERDUE: "Atrasado",`,
  `    OVERDUE: "Atrasado",
    open: "Em aberto",
    paid: "Pago",
    overdue: "Atrasado",`
);

// 16) Add getTodayDate helper if missing
if (!s.includes('function getTodayDate()')) {
  s = s.replace(
    `function daysBetween(dateA: string, dateB: string) {`,
    `function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(dateA: string, dateB: string) {`
  );
}

fs.writeFileSync(file, s, 'utf8');
console.log('\nConcluído. Rode: npm run dev');

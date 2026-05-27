const fs = require('fs');
const path = require('path');

function exists(p) {
  return fs.existsSync(path.resolve(process.cwd(), p));
}

function read(p) {
  return fs.readFileSync(path.resolve(process.cwd(), p), 'utf8');
}

function write(p, s) {
  fs.writeFileSync(path.resolve(process.cwd(), p), s, 'utf8');
}

function patchLayout() {
  const file = 'app/dashboard/layout.tsx';
  if (!exists(file)) {
    console.log('IGNORADO: app/dashboard/layout.tsx não encontrado.');
    return;
  }

  let code = read(file);
  const before = code;

  code = code.replace(
    /const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/,
    `function getTodayDate() {\n  return new Date().toISOString().slice(0, 10);\n}`
  );

  code = code.replaceAll('daysBetween(today,', 'daysBetween(getTodayDate(),');

  code = code.replace(
    /asaas_subscription_id: string \| null;\n\};/,
    `asaas_subscription_id: string | null;\n  activated_at: string | null;\n  next_due_date: string | null;\n  current_period_end: string | null;\n};`
  );

  code = code.replace(
    /\.select\("id, plan_key, status, lifecycle_stage, billing_provider, allow_multi_arena, max_arenas, asaas_status, trial_started_at, trial_ends_at, asaas_subscription_id"\)/,
    `.select("id, plan_key, status, lifecycle_stage, billing_provider, allow_multi_arena, max_arenas, asaas_status, trial_started_at, trial_ends_at, asaas_subscription_id, activated_at, next_due_date, current_period_end")`
  );

  code = code.replace(
    /function getSubscriptionBusinessStatus\(subscription: SubscriptionPlanStatus \| null\) \{[\s\S]*?\n\}\n\nfunction daysBetween/,
    `function getSubscriptionBusinessStatus(subscription: SubscriptionPlanStatus | null) {\n  if (!subscription) return "pending";\n\n  const status = String(subscription.status || "").toLowerCase();\n  const lifecycle = String(subscription.lifecycle_stage || "").toLowerCase();\n  const asaas = String(subscription.asaas_status || "").toUpperCase();\n  const hasManualActivation = Boolean(subscription.activated_at);\n  const hasAsaasSubscription = Boolean(subscription.asaas_subscription_id);\n\n  if (status === "blocked") return "blocked";\n  if (status === "overdue" || asaas === "OVERDUE") return "overdue";\n\n  if (\n    status === "active" ||\n    lifecycle === "active" ||\n    hasManualActivation ||\n    hasAsaasSubscription ||\n    ["RECEIVED", "CONFIRMED", "ACTIVE"].includes(asaas)\n  ) {\n    return "active";\n  }\n\n  if (status === "trialing" || lifecycle === "trial") {\n    if (subscription.trial_ends_at && daysBetween(getTodayDate(), subscription.trial_ends_at.slice(0, 10)) < 0) {\n      return "trial_expired";\n    }\n\n    return "trialing";\n  }\n\n  return "pending";\n}\n\nfunction daysBetween`
  );

  if (code !== before) {
    write(file, code);
    console.log('OK: app/dashboard/layout.tsx corrigido.');
  } else {
    console.log('SEM MUDANÇAS: app/dashboard/layout.tsx já parecia corrigido.');
  }
}

function patchBilling() {
  const file = 'app/dashboard/billing/page.tsx';
  if (!exists(file)) {
    console.log('IGNORADO: app/dashboard/billing/page.tsx não encontrado.');
    return;
  }

  let code = read(file);
  const before = code;

  code = code.replace(
    /const trialDaysLeft = subscription\?\.trial_ends_at \? daysBetween\(today, subscription\.trial_ends_at\.slice\(0, 10\)\) : null;/,
    `const trialDaysLeft = subscription?.trial_ends_at ? daysBetween(getTodayDate(), subscription.trial_ends_at.slice(0, 10)) : null;`
  );

  code = code.replace(
    /const firstDuePreview = addMonths\(new Date\(\), 1\)\.toISOString\(\)\.slice\(0, 10\);/,
    `const firstDuePreview = subscription?.next_due_date || addMonths(new Date(), 1).toISOString().slice(0, 10);`
  );

  code = code.replace(
    /const nextDueDate =\s*subscription\?\.asaas_next_due_date \|\|\s*subscription\?\.next_due_date \|\|\s*subscription\?\.current_period_end \|\|\s*latestAsaasPayment\?\.due_date \|\|\s*"";/,
    `const nextDueDate =\n    subscription?.next_due_date ||\n    subscription?.asaas_next_due_date ||\n    latestAsaasPayment?.due_date ||\n    subscription?.current_period_end ||\n    "";`
  );

  code = code.replace(
    /const isActive = businessStatus === "active";\n/,
    `const isActive = businessStatus === "active";\n  const hasManualActivation = Boolean(subscription?.activated_at);\n  const hasAsaasSubscription = Boolean(subscription?.asaas_subscription_id);\n  const shouldShowActivationCta = !isActive && !hasManualActivation && !hasAsaasSubscription;\n`
  );

  code = code.replace(
    /function getBusinessStatus\(subscription: Subscription \| null\) \{[\s\S]*?\n\}\n\nfunction daysBetween/,
    `function getBusinessStatus(subscription: Subscription | null) {\n  if (!subscription) return "pending";\n\n  const status = String(subscription.status || "").toLowerCase();\n  const lifecycle = String(subscription.lifecycle_stage || "").toLowerCase();\n  const asaas = String(subscription.asaas_status || "").toUpperCase();\n  const hasManualActivation = Boolean(subscription.activated_at);\n  const hasAsaasSubscription = Boolean(subscription.asaas_subscription_id);\n\n  if (status === "blocked") return "blocked";\n  if (status === "overdue" || asaas === "OVERDUE") return "overdue";\n\n  if (\n    status === "active" ||\n    lifecycle === "active" ||\n    hasManualActivation ||\n    hasAsaasSubscription ||\n    ["RECEIVED", "CONFIRMED", "ACTIVE"].includes(asaas)\n  ) {\n    return "active";\n  }\n\n  if (status === "trialing" || lifecycle === "trial") {\n    if (subscription.trial_ends_at && daysBetween(getTodayDate(), subscription.trial_ends_at.slice(0, 10)) < 0) {\n      return "trial_expired";\n    }\n\n    return "trialing";\n  }\n\n  return "pending";\n}\n\nfunction daysBetween`
  );

  if (!code.includes('function getTodayDate()')) {
    code = code.replace(
      /const ARENAFLOW_WHATSAPP = "5522999270052";\nconst today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/,
      `const ARENAFLOW_WHATSAPP = "5522999270052";\n\nfunction getTodayDate() {\n  return new Date().toISOString().slice(0, 10);\n}\n\nconst today = getTodayDate();`
    );
  }

  code = code.replaceAll('Sem recorrência ativa', 'Assinatura manual ativa');

  // Esconde botões de ativação em assinaturas já ativas/manuais.
  // Converte condicionais comuns que envolvem botão de ativar para shouldShowActivationCta.
  code = code.replace(/\{!subscription\?\.asaas_subscription_id && \(/g, '{shouldShowActivationCta && (');
  code = code.replace(/\{!isActive && \(/g, '{shouldShowActivationCta && (');

  if (code !== before) {
    write(file, code);
    console.log('OK: app/dashboard/billing/page.tsx corrigido.');
  } else {
    console.log('SEM MUDANÇAS: app/dashboard/billing/page.tsx já parecia corrigido ou tem estrutura diferente.');
  }
}

patchLayout();
patchBilling();

console.log('\nAgora rode: npm run dev');
console.log('Depois teste: /dashboard e /dashboard/billing');
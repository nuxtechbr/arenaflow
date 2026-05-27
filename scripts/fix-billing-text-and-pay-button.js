const fs = require("fs");

const filePath = "app/dashboard/billing/page.tsx";

let code = fs.readFileSync(filePath, "utf8");

const fixes = [
  ["ImplantaÃ§Ã£o", "Implantação"],
  ["configuraÃ§Ã£o", "configuração"],
  ["recorrÃªncia", "recorrência"],
  ["mensalidade atual", "mensalidade atual"],
  ["grÃ¡tis", "grátis"],
  ["mÃªs", "mês"],
  ["PrÃ³ximo", "Próximo"],
  ["CobranÃ§a", "Cobrança"],
  ["assinatura estÃ¡ ativa", "assinatura está ativa"],
  ["pÃºblico", "público"],
  ["MÃºltiplas", "Múltiplas"],
  ["automaÃ§Ãµes", "automações"],
];

fixes.forEach(([wrong, correct]) => {
  code = code.split(wrong).join(correct);
});

const oldBlock = `
<div className="rounded-[1.5rem] border border-white/10 bg-[#07111f] p-5">
`;

const newBlock = `
<div className="rounded-[1.5rem] border border-white/10 bg-[#07111f] p-5">
  {currentBillingInvoice && (
    <div className="mt-4 flex flex-col gap-3">
      {currentBillingInvoice.payment_url ? (
        <a
          href={currentBillingInvoice.payment_url}
          target="_blank"
          rel="noreferrer"
          className="flex h-12 items-center justify-center rounded-2xl bg-[#16c784] text-sm font-black text-black transition hover:opacity-90"
        >
          Pagar mensalidade
        </a>
      ) : (
        <button
          onClick={() =>
            window.open(
              "https://wa.me/5522999270052?text=Olá,%20quero%20receber%20o%20Pix%20da%20mensalidade%20ArenaFlow.",
              "_blank"
            )
          }
          className="flex h-12 items-center justify-center rounded-2xl border border-[#16c784]/40 bg-[#16c784]/10 text-sm font-black text-[#16c784] transition hover:bg-[#16c784]/20"
        >
          Solicitar Pix
        </button>
      )}
    </div>
  )}
`;

if (!code.includes("Pagar mensalidade")) {
  code = code.replace(oldBlock, newBlock);
}

fs.writeFileSync(filePath, code, "utf8");

console.log("Billing corrigido com sucesso.");
const fs = require("fs");

const filePath = "app/dashboard/billing/page.tsx";

let code = fs.readFileSync(filePath, "utf8");

const replacements = {
  "ImplantaÃ§Ã£o": "Implantação",
  "implantaÃ§Ã£o": "implantação",
  "configuraÃ§Ã£o": "configuração",
  "recorrÃªncia": "recorrência",
  "RecorrÃªncia": "Recorrência",
  "vocÃª": "você",
  "VocÃª": "Você",
  "cobranÃ§a": "cobrança",
  "CobranÃ§a": "Cobrança",
  "ativaÃ§Ã£o": "ativação",
  "AtivaÃ§Ã£o": "Ativação",
  "mÃªs": "mês",
  "MÃªs": "Mês",
  "grÃ¡tis": "grátis",
  "GrÃ¡tis": "Grátis",
  "pÃºblico": "público",
  "PÃºblico": "Público",
  "MÃºltiplas": "Múltiplas",
  "mÃºltiplas": "múltiplas",
  "automaÃ§Ãµes": "automações",
  "AutomaÃ§Ãµes": "Automações",
  "PrÃ³ximo": "Próximo",
  "prÃ³ximo": "próximo",
  "nÃ£o": "não",
  "NÃ£o": "Não",
  "sÃ£o": "são",
  "SÃ£o": "São",
  "serÃ¡": "será",
  "SerÃ¡": "Será",
  "horÃ¡rios": "horários",
  "HorÃ¡rios": "Horários",
  "PÃ¡gina": "Página",
  "pÃ¡gina": "página",
  "vÃ¡rias": "várias",
  "Ã©": "é",
  "Ã‰": "É",
  "1Âº": "1º",
  "mÃƒÂªs": "mês",
  "mÃƒÂ¡s": "más",
  "Ã§": "ç",
  "Ã£": "ã",
  "Ã¡": "á",
  "Ã©": "é",
  "Ãª": "ê",
  "Ã³": "ó",
  "Ãº": "ú",
  "Ã­": "í",
  "Âº": "º",
  "â€¢": "•"
};

for (const [wrong, right] of Object.entries(replacements)) {
  code = code.split(wrong).join(right);
}

fs.writeFileSync(filePath, code, "utf8");

console.log("Textos do billing corrigidos com sucesso.");
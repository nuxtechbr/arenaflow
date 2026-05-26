const fs = require('fs');
const path = require('path');

const candidates = [
  path.join(process.cwd(), 'app', 'arena', '[slug]', 'page.tsx'),
  path.join(process.cwd(), 'app', 'Arena', '[slug]', 'page.tsx'),
];

const filePath = candidates.find((p) => fs.existsSync(p));

if (!filePath) {
  console.error('ERRO: não encontrei app/arena/[slug]/page.tsx nem app/Arena/[slug]/page.tsx');
  process.exit(1);
}

let code = fs.readFileSync(filePath, 'utf8');
const before = code;

// Corrige espaços invisíveis que quebram o parser do Supabase/TypeScript.
code = code
  .replace(/\u00A0/g, ' ')
  .replace(/\u202F/g, ' ')
  .replace(/\u2007/g, ' ')
  .replace(/\u2009/g, ' ')
  .replace(/\u200A/g, ' ')
  .replace(/\u200B/g, '')
  .replace(/\uFEFF/g, '');

// Garante selects do Supabase com espaços normais.
const selectFixes = [
  ['select("id, image_url, image_order")', 'select("id, image_url, image_order")'],
  ['select("id, rule_text, is_active")', 'select("id, rule_text, is_active")'],
  ['select("weekday, is_open, open_time, close_time")', 'select("weekday, is_open, open_time, close_time")'],
  ['select("id, name, sport, surface, photo_url, status")', 'select("id, name, sport, surface, photo_url, status")'],
  ['select("*, fields(name)")', 'select("*, fields(name)")'],
  ['select("id, field_id, title, block_date, start_time, end_time, status")', 'select("id, field_id, title, block_date, start_time, end_time, status")'],
  ['select("id, name, whatsapp")', 'select("id, name, whatsapp")'],
];

for (const [, fixed] of selectFixes) {
  const inner = fixed.match(/select\("([^"]+)"\)/)[1];
  const compact = inner.replace(/ /g, '[\\s\\u00A0\\u202F\\u2007\\u2009\\u200A]*');
  const regex = new RegExp(`select\\("${compact}"\\)`, 'g');
  code = code.replace(regex, fixed);
}

if (code === before) {
  console.log('Nenhuma alteração aplicada. O arquivo já parece limpo.');
} else {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Arquivo corrigido:', filePath);
  console.log('Agora rode: npm run dev');
}

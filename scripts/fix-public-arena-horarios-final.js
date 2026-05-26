const fs = require('fs');
const path = require('path');
 
const filePath = path.join(process.cwd(), 'app', 'arena', '[slug]', 'page.tsx');
 
if (!fs.existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(1);
}
 
let code = fs.readFileSync(filePath, 'utf8');
let changed = false;
 
function replaceOnce(label, pattern, replacement) {
  if (!pattern.test(code)) {
    console.log('TRECHO NÃO ENCONTRADO:', label);
    return false;
  }
  code = code.replace(pattern, replacement);
  console.log('Aplicado:', label);
  changed = true;
  return true;
}
 
// 1) Remove o trecho errado que foi colado dentro da reserva avulsa e causava erro/validação indevida.
replaceOnce(
  'remover validação indevida com fixedStart/fixedEnd dentro de submitBooking',
  /\n\s*const fixedStart = timeToMinutes\(fixedStartTime\);\s*\n\s*const fixedEnd = timeToMinutes\(fixedEndTime\);\s*\n\s*if \(\s*hasConflictAt\(\s*bookings,\s*recurringBookings,\s*blocks,\s*fieldId,\s*bookingDate,\s*fixedStart,\s*fixedEnd\s*\)\s*\) \{\s*return alert\("Esse horário não está disponível\. Escolha outro horário\."\);\s*\}\s*/,
  '\n'
);
 
// 2) Corrige disponibilidade quando a arena fecha depois de meia-noite: 18:00 às 00:30.
replaceOnce(
  'corrigir fechamento após meia-noite no availableTimes',
  /const open = timeToMinutes\(opening\.open_time\.slice\(0, 5\)\);\s*\n\s*const close = timeToMinutes\(opening\.close_time\.slice\(0, 5\)\);/,
  `const open = timeToMinutes(opening.open_time.slice(0, 5));
    let close = timeToMinutes(opening.close_time.slice(0, 5));
 
    if (close <= open) {
      close += 24 * 60;
    }`
);
 
// 3) Garante que horários acima de 24h apareçam como 00:00, 00:30 etc.
replaceOnce(
  'normalizar minutesToTime para horários após meia-noite',
  /function minutesToTime\(total: number\) \{\s*\n\s*return `\$\{String\(Math\.floor\(total \/ 60\)\)\.padStart\(2, "0"\)\}:\$\{String\(total % 60\)\.padStart\(2, "0"\)\}`;\s*\n\}/,
  `function minutesToTime(total: number) {
  const normalized = total % (24 * 60);
 
  return \`${'${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}' }\`;
}`
);
 
// 4) Substitui hasConflictAt por uma versão que compara corretamente reservas/bloqueios atravessando meia-noite.
replaceOnce(
  'corrigir hasConflictAt para reservas que atravessam 00:00',
  /function hasConflictAt\([\s\S]*?\n\}\s*\n\s*function getRecurringBookingsForDate/,
  `function hasConflictAt(
  bookings: Booking[],
  recurring: RecurringBooking[],
  blocks: ScheduleBlock[],
  fieldId: string,
  date: string,
  start: number,
  end: number
) {
  const normal = bookings.some((booking) => {
    if (booking.field_id !== fieldId) return false;
    if (booking.booking_date !== date) return false;
    if (booking.status === "cancelada") return false;
 
    const range = getComparableTimeRange(
      booking.start_time.slice(0, 5),
      booking.end_time.slice(0, 5),
      start
    );
 
    return start < range.end && end > range.start;
  });
 
  const fixed = getRecurringBookingsForDate(recurring, date, fieldId).some((booking) => {
    if (booking.status !== "active") return false;
 
    const range = getComparableTimeRange(
      booking.start_time.slice(0, 5),
      booking.end_time.slice(0, 5),
      start
    );
 
    return start < range.end && end > range.start;
  });
 
  const blocked = blocks.some((block) => {
    if (block.field_id !== fieldId) return false;
    if (block.block_date !== date) return false;
    if (block.status !== "active") return false;
 
    const range = getComparableTimeRange(
      block.start_time.slice(0, 5),
      block.end_time.slice(0, 5),
      start
    );
 
    return start < range.end && end > range.start;
  });
 
  return normal || fixed || blocked;
}
 
function getComparableTimeRange(startTime: string, endTime: string, referenceStart: number) {
  let start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
 
  if (end <= start) {
    end += 24 * 60;
  }
 
  if (referenceStart >= 12 * 60 && start < 12 * 60) {
    start += 24 * 60;
    end += 24 * 60;
  }
 
  return { start, end };
}
 
function getRecurringBookingsForDate`
);
 
// 5) Adiciona validação correta na reserva fixa, sem depender de variável global.
replaceOnce(
  'adicionar validação correta de conflito na reserva fixa',
  /if \(timeToMinutes\(fixedEndTime\) <= timeToMinutes\(fixedStartTime\)\) \{\s*\n\s*return alert\("O horário final precisa ser maior que o inicial\."\);\s*\n\s*\}/,
  `if (timeToMinutes(fixedEndTime) <= timeToMinutes(fixedStartTime)) {
      return alert("O horário final precisa ser maior que o inicial.");
    }
 
    const fixedReferenceDate = getNextDateForWeekday(fixedStartDate, Number(fixedWeekday));
    const fixedStart = timeToMinutes(fixedStartTime);
    const fixedEnd = timeToMinutes(fixedEndTime);
 
    if (hasConflictAt(bookings, recurringBookings, blocks, fixedFieldId, fixedReferenceDate, fixedStart, fixedEnd)) {
      return alert("Esse horário não está disponível para reserva fixa. Escolha outro horário.");
    }`
);
 
// 6) Adiciona helper getNextDateForWeekday antes de timeToMinutes.
if (!code.includes('function getNextDateForWeekday(')) {
  replaceOnce(
    'adicionar helper getNextDateForWeekday',
    /function timeToMinutes\(time: string\) \{/,
    `function getNextDateForWeekday(date: string, weekday: number) {
  const base = new Date(\`${'${date}'}T00:00:00\`);
  const currentWeekday = base.getDay();
  const daysToAdd = (weekday - currentWeekday + 7) % 7;
 
  base.setDate(base.getDate() + daysToAdd);
 
  return base.toISOString().slice(0, 10);
}
 
function timeToMinutes(time: string) {`
  );
}
 
if (changed) {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('\n✅ Corrigido com sucesso:', filePath);
  console.log('Agora rode: npm run dev');
} else {
  console.log('\nNenhuma alteração aplicada. Talvez o arquivo já esteja corrigido ou diferente do esperado.');
}
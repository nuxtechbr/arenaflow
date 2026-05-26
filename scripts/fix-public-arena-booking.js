const fs = require('fs');
const path = require('path');
 
const filePath = path.join(process.cwd(), 'app', 'arena', '[slug]', 'page.tsx');
 
if (!fs.existsSync(filePath)) {
  console.error('Arquivo não encontrado:', filePath);
  process.exit(1);
}
 
let code = fs.readFileSync(filePath, 'utf8');
let changed = false;
 
function replaceOnce(search, replacement, label) {
  if (code.includes(replacement)) {
    console.log(`OK já aplicado: ${label}`);
    return;
  }
 
  if (!code.includes(search)) {
    console.error(`TRECHO NÃO ENCONTRADO: ${label}`);
    process.exit(1);
  }
 
  code = code.replace(search, replacement);
  changed = true;
  console.log(`Aplicado: ${label}`);
}
 
// 1) Recalcular horários da reserva fixa/mensalista com base no dia escolhido.
replaceOnce(
`  const coverImage = arena?.cover_url || gallery[0]?.image_url || "";`,
`  const fixedReferenceDate = useMemo(() => {
    return getNextDateForWeekday(fixedStartDate, Number(fixedWeekday));
  }, [fixedStartDate, fixedWeekday]);
 
  const fixedAvailableTimes = useMemo(() => {
    if (!fixedFieldId || !fixedStartDate) return [];
 
    const weekday = Number(fixedWeekday);
    const opening = hours.find((item) => item.weekday === weekday);
 
    if (!opening?.is_open || !opening.open_time || !opening.close_time) return [];
 
    const open = timeToMinutes(opening.open_time.slice(0, 5));
    const close = timeToMinutes(opening.close_time.slice(0, 5));
    const times: string[] = [];
 
    for (let current = open; current + 60 <= close; current += 30) {
      const start = current;
      const end = current + 60;
 
      if (!hasConflictAt(bookings, recurringBookings, blocks, fixedFieldId, fixedReferenceDate, start, end)) {
        times.push(minutesToTime(current));
      }
    }
 
    return times;
  }, [fixedFieldId, fixedWeekday, fixedStartDate, fixedReferenceDate, hours, bookings, recurringBookings, blocks]);
 
  useEffect(() => {
    setFixedStartTime("");
    setFixedEndTime("");
  }, [fixedFieldId, fixedWeekday, fixedStartDate]);
 
  const coverImage = arena?.cover_url || gallery[0]?.image_url || "";`,
  'memo de horários disponíveis para reserva fixa'
);
 
// 2) Validar conflito antes de salvar reserva fixa/mensalista.
replaceOnce(
`    if (timeToMinutes(fixedEndTime) <= timeToMinutes(fixedStartTime)) {
      return alert("O horário final precisa ser maior que o inicial.");
    }
 
    if (!customerName.trim()) return alert("Informe seu nome.");`,
`    if (timeToMinutes(fixedEndTime) <= timeToMinutes(fixedStartTime)) {
      return alert("O horário final precisa ser maior que o inicial.");
    }
 
    const fixedStart = timeToMinutes(fixedStartTime);
    const fixedEnd = timeToMinutes(fixedEndTime);
 
    if (hasConflictAt(bookings, recurringBookings, blocks, fixedFieldId, fixedReferenceDate, fixedStart, fixedEnd)) {
      return alert("Esse horário não está disponível para reserva fixa. Escolha outro horário.");
    }
 
    if (!customerName.trim()) return alert("Informe seu nome.");`,
  'validação de conflito da reserva fixa'
);
 
// 3) Passar os horários disponíveis para o painel de reserva fixa.
replaceOnce(
`              startDate={fixedStartDate}
              setStartDate={setFixedStartDate}
              notes={fixedNotes}`,
`              startDate={fixedStartDate}
              setStartDate={setFixedStartDate}
              availableTimes={fixedAvailableTimes}
              notes={fixedNotes}`,
  'prop availableTimes no FixedPanel'
);
 
// 4) Adicionar o tipo da prop no FixedPanel.
replaceOnce(
`  startDate: string;
  setStartDate: (value: string) => void;
  notes: string;`,
`  startDate: string;
  setStartDate: (value: string) => void;
  availableTimes: string[];
  notes: string;`,
  'tipo availableTimes no FixedPanel'
);
 
// 5) Mostrar os horários disponíveis dentro da reserva fixa.
replaceOnce(
`            <div>
              <Label>Data para começar</Label>
              <InputBox type="date" min={today} value={p.startDate} onChange={p.setStartDate} />
            </div>
 
            <div>
              <Label>WhatsApp</Label>`,
`            <div>
              <Label>Data para começar</Label>
              <InputBox type="date" min={today} value={p.startDate} onChange={p.setStartDate} />
            </div>
 
            <div className="md:col-span-2">
              <Label>Horários disponíveis para esse dia</Label>
 
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {p.availableTimes.length === 0 && (
                  <div className="col-span-full rounded-2xl border border-dashed border-white/12 p-5 text-center text-sm text-slate-300">
                    Nenhum horário disponível para essa quadra e dia.
                  </div>
                )}
 
                {p.availableTimes.map((time) => (
                  <button
                    type="button"
                    key={time}
                    onClick={() => {
                      p.setStartTime(time);
                      if (!p.endTime) p.setEndTime(addMinutesToTime(time, 60));
                    }}
                    className={
                      p.startTime === time
                        ? "rounded-2xl bg-emerald-500 px-4 py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20"
                        : "rounded-2xl border border-white/12 bg-[#0B1411] px-4 py-4 text-base font-black text-white transition hover:border-emerald-400 hover:bg-emerald-500/10"
                    }
                  >
                    {time}
                  </button>
                ))}
              </div>
 
              <p className="mt-2 text-xs text-slate-400">
                Depois de escolher o início, ajuste o horário final se quiser mais de 1 hora.
              </p>
            </div>
 
            <div>
              <Label>WhatsApp</Label>`,
  'grid de horários disponíveis no FixedPanel'
);
 
// 6) Ajustar bloqueios manuais: field_id null bloqueia todas as quadras.
replaceOnce(
`      block.field_id === fieldId &&
      block.block_date === date &&`,
`      (block.field_id === fieldId || block.field_id === null) &&
      block.block_date === date &&`,
  'bloqueio manual para quadra específica ou todas as quadras'
);
 
// 7) Considerar reservas fixas pending como ocupadas no link público.
replaceOnce(
`      booking.status === "active" &&
      start < timeToMinutes(booking.end_time.slice(0, 5)) &&`,
`      ["active", "pending"].includes(booking.status) &&
      start < timeToMinutes(booking.end_time.slice(0, 5)) &&`,
  'reservas fixas active/pending bloqueiam horário'
);
 
// 8) Adicionar helper de próxima data do dia da semana.
replaceOnce(
`function timeToMinutes(time: string) {`,
`function getNextDateForWeekday(date: string, weekday: number) {
  const base = new Date(\`${'${date}'}T00:00:00\`);
  const currentWeekday = base.getDay();
  const daysToAdd = (weekday - currentWeekday + 7) % 7;
 
  base.setDate(base.getDate() + daysToAdd);
 
  return base.toISOString().slice(0, 10);
}
 
function timeToMinutes(time: string) {`,
  'helper getNextDateForWeekday'
);
 
if (changed) {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('\nConcluído. Arquivo corrigido:', filePath);
  console.log('Agora rode: npm run dev');
} else {
  console.log('\nNenhuma mudança nova aplicada. O arquivo já parece corrigido.');
}
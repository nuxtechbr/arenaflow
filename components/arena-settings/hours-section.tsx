type OpeningHour = {
  id: string;
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

type Props = {
  openingHours: OpeningHour[];
  onUpdateHour: (
    weekday: number,
    field: "is_open" | "open_time" | "close_time",
    value: boolean | string
  ) => void;
  onCopyFirstHourToAll: () => void;
};

const days = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export default function HoursSection({
  openingHours,
  onUpdateHour,
  onCopyFirstHourToAll,
}: Props) {
  return (
    <section id="hours" className="scroll-mt-8 rounded-3xl border border-slate-800 bg-[#111827] p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h2 className="text-2xl font-bold text-white">Funcionamento</h2>
          <p className="mt-1 text-sm text-slate-400">
            Defina os dias e horários em que a arena aceita reservas.
          </p>
        </div>

        <button
          type="button"
          onClick={onCopyFirstHourToAll}
          className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-400"
        >
          Copiar primeiro horário para todos
        </button>
      </div>

      <div className="space-y-3">
        {openingHours.map((hour) => {
          const day = days.find((item) => item.value === hour.weekday);

          return (
            <div
              key={hour.weekday}
              className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[120px_130px_1fr]"
            >
              <strong className="text-white">{day?.label}</strong>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={hour.is_open}
                  onChange={(e) =>
                    onUpdateHour(hour.weekday, "is_open", e.target.checked)
                  }
                  className="h-4 w-4 accent-emerald-500"
                />
                Aberto
              </label>

              {hour.is_open ? (
                <div className="flex items-center gap-3">
                  <TimeInput
                    value={hour.open_time}
                    onChange={(value) =>
                      onUpdateHour(hour.weekday, "open_time", value)
                    }
                  />

                  <span className="text-slate-500">até</span>

                  <TimeInput
                    value={hour.close_time}
                    onChange={(value) =>
                      onUpdateHour(hour.weekday, "close_time", value)
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Fechado nesse dia</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400"
    />
  );
}
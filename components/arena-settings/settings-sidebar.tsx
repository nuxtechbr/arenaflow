type Props = {
  activeSection: string;
};

const items = [
  { id: "visual", label: "Visual da Arena" },
  { id: "info", label: "Dados da Arena" },
  { id: "hours", label: "Funcionamento" },
  { id: "rules", label: "Regras" },
  { id: "deposit", label: "Reserva com Sinal" },
];

export default function SettingsSidebar({ activeSection }: Props) {
  function scrollToSection(id: string) {
    const element = document.getElementById(id);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  return (
    <aside className="sticky top-8 h-fit rounded-3xl border border-slate-800 bg-[#111827] p-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-emerald-400">
        Configurações
      </p>

      <nav className="space-y-2">
        {items.map((item) => {
          const active = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className={`w-full rounded-xl px-4 py-3 text-left font-medium transition ${
                active
                  ? "bg-emerald-500 text-black"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
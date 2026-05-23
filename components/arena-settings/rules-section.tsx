import { Plus, Trash2 } from "lucide-react";

type ArenaRule = {
  id: string;
  rule_text: string;
  is_active: boolean;
};

type Props = {
  rules: ArenaRule[];
  newRule: string;
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onNewRuleChange: (value: string) => void;
  onAddRule: () => void;
};

export default function RulesSection({
  rules,
  newRule,
  onToggleRule,
  onDeleteRule,
  onNewRuleChange,
  onAddRule,
}: Props) {
  return (
    <section
      id="rules"
      className="scroll-mt-8 rounded-3xl border border-slate-800 bg-[#111827] p-6"
    >
      <h2 className="text-2xl font-bold text-white">Regras da Arena</h2>

      <p className="mt-1 text-sm text-slate-400">
        Escolha quais regras aparecem para o cliente antes do agendamento.
      </p>

      <div className="mt-6 space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4"
          >
            <p className={rule.is_active ? "text-slate-100" : "text-slate-500"}>
              {rule.rule_text}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleRule(rule.id)}
                className={
                  rule.is_active
                    ? "rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-black"
                    : "rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-400"
                }
              >
                {rule.is_active ? "Ativa" : "Inativa"}
              </button>

              <button
                type="button"
                onClick={() => onDeleteRule(rule.id)}
                className="rounded-xl border border-red-500/40 p-2 text-red-400 hover:bg-red-500 hover:text-white"
                title="Excluir regra"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-700 p-4">
        <label className="text-sm font-medium text-slate-200">
          Criar nova regra
        </label>

        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <input
            value={newRule}
            onChange={(event) => onNewRuleChange(event.target.value)}
            placeholder="Exemplo: É obrigatório usar chuteira society."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400"
          />

          <button
            type="button"
            onClick={onAddRule}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-5 py-3 font-semibold text-white hover:bg-slate-700"
          >
            <Plus size={18} />
            Adicionar
          </button>
        </div>
      </div>
    </section>
  );
}
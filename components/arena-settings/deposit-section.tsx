type DepositSettings = {
  requireDeposit: boolean;
  depositAmountType: "fixed" | "percentage";
  depositFixedAmount: string;
  depositPercentage: string;
  pixKey: string;
  pixKeyType: string;
  pixReceiverName: string;
  receiptWhatsapp: string;
  depositMessage: string;
};

type Props = {
  deposit: DepositSettings;
  onChange: (field: string, value: string | boolean) => void;
};

export default function DepositSection({ deposit, onChange }: Props) {
  return (
    <section
      id="deposit"
      className="scroll-mt-8 rounded-3xl border border-slate-800 bg-[#111827] p-6"
    >
      <h2 className="text-2xl font-bold text-white">Reserva com Sinal</h2>

      <p className="mt-1 text-sm text-slate-400">
        Defina se o cliente precisa pagar um sinal via Pix para confirmar a reserva.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
        <div>
          <h3 className="font-bold text-white">Exigir pagamento antecipado?</h3>

          <p className="mt-1 text-sm text-slate-400">
            Escolha se a reserva exige pagamento de sinal antes da confirmação.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange("requireDeposit", true)}
              className={
                deposit.requireDeposit
                  ? "rounded-2xl border border-emerald-500 bg-emerald-500 px-4 py-4 font-bold text-black"
                  : "rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 font-bold text-white hover:border-emerald-400"
              }
            >
              Ativar sinal
            </button>

            <button
              type="button"
              onClick={() => onChange("requireDeposit", false)}
              className={
                !deposit.requireDeposit
                  ? "rounded-2xl border border-red-500 bg-red-500 px-4 py-4 font-bold text-white"
                  : "rounded-2xl border border-slate-700 bg-slate-900 px-4 py-4 font-bold text-white hover:border-red-400"
              }
            >
              Desativar sinal
            </button>
          </div>
        </div>
      </div>

      {!deposit.requireDeposit && (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
          <p className="text-sm text-slate-400">
            Com essa opção desligada, o cliente agenda normalmente e segue direto
            para o WhatsApp da arena.
          </p>
        </div>
      )}

      {deposit.requireDeposit && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
            <h3 className="font-bold text-white">Como funciona para o cliente?</h3>

            <p className="mt-1 text-sm text-slate-300">
              O cliente escolhe o horário, vê sua chave Pix, paga o sinal e envia
              o comprovante pelo WhatsApp informado abaixo.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-200">
                Como cobrar o sinal?
              </span>

              <select
                value={deposit.depositAmountType}
                onChange={(event) =>
                  onChange("depositAmountType", event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
              >
                <option value="fixed">Valor fixo por reserva</option>
                <option value="percentage">
                  Porcentagem do valor da reserva
                </option>
              </select>
            </label>

            {deposit.depositAmountType === "fixed" ? (
              <MoneyInput
                label="Valor do sinal"
                value={deposit.depositFixedAmount}
                onChange={(value) => onChange("depositFixedAmount", value)}
              />
            ) : (
              <PercentInput
                label="Porcentagem do sinal"
                value={deposit.depositPercentage}
                onChange={(value) => onChange("depositPercentage", value)}
              />
            )}

            <Input
              label="Chave Pix"
              helper="Chave exibida ao cliente."
              placeholder="Digite a chave Pix"
              value={deposit.pixKey}
              onChange={(value) => onChange("pixKey", value)}
            />

            <label>
              <span className="text-sm font-medium text-slate-200">
                Tipo da chave Pix
              </span>

              <select
                value={deposit.pixKeyType}
                onChange={(event) => onChange("pixKeyType", event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
              >
                <option value="">Selecione</option>
                <option value="cpf">CPF</option>
                <option value="cnpj">CNPJ</option>
                <option value="email">E-mail</option>
                <option value="phone">Telefone</option>
                <option value="random">Chave aleatória</option>
              </select>
            </label>

            <Input
              label="Nome do recebedor"
              helper="Nome exibido no Pix."
              placeholder="Arena Flow"
              value={deposit.pixReceiverName}
              onChange={(value) => onChange("pixReceiverName", value)}
            />

            <WhatsappInput
              label="WhatsApp para comprovante"
              value={deposit.receiptWhatsapp}
              onChange={(value) => onChange("receiptWhatsapp", value)}
            />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-slate-200">
              Mensagem para o cliente
            </span>

            <textarea
              value={deposit.depositMessage}
              onChange={(event) =>
                onChange("depositMessage", event.target.value)
              }
              className="mt-2 min-h-40 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
            />
          </label>
        </div>
      )}
    </section>
  );
}

function Input({
  label,
  helper,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  helper: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none"
      />
      <span className="mt-1 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      label={label}
      helper="Exemplo: 30,00"
      placeholder="30,00"
      value={value}
      onChange={onChange}
    />
  );
}

function PercentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-200">{label}</span>

      <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-emerald-400">
        <input
          value={value}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, ""))
          }
          placeholder="30"
          className="w-full bg-transparent p-3 text-white outline-none"
        />

        <span className="flex items-center border-l border-slate-700 bg-slate-900 px-4 font-bold text-emerald-400">
          %
        </span>
      </div>

      <span className="mt-1 block text-xs text-slate-500">
        Exemplo: 30 para cobrar 30% do valor da reserva.
      </span>
    </label>
  );
}

function WhatsappInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const cleanValue = value.replace(/^55/, "");

  return (
    <label>
      <span className="text-sm font-medium text-slate-200">{label}</span>

      <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
        <span className="flex items-center border-r border-slate-700 bg-slate-900 px-4 font-bold text-emerald-400">
          +55
        </span>

        <input
          value={cleanValue}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, ""))
          }
          placeholder="22999999999"
          className="w-full bg-transparent p-3 text-white outline-none"
        />
      </div>
    </label>
  );
}
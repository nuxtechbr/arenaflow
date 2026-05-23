"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type Field = {
  id: string;
  arena_id: string;
  name: string;
  photo_url: string | null;
  sport: string | null;
  surface: string | null;
  price: number;
  weekend_price: number | null;
  use_weekend_price: boolean;
  min_duration_minutes: number;
  interval_minutes: number;
  status: string;
};

type PricingOption = {
  id?: string;
  duration_minutes: number;
  label: string;
  price: string;
  weekend_price: string;
  is_active: boolean;
};

const defaultPricingOptions: PricingOption[] = [
  { duration_minutes: 60, label: "1 hora", price: "120", weekend_price: "", is_active: true },
  { duration_minutes: 90, label: "1h30", price: "170", weekend_price: "", is_active: true },
  { duration_minutes: 120, label: "2 horas", price: "220", weekend_price: "", is_active: true },
  { duration_minutes: 150, label: "2h30", price: "270", weekend_price: "", is_active: false },
  { duration_minutes: 180, label: "3 horas", price: "300", weekend_price: "", is_active: false },
];

const emptyForm = {
  id: "",
  name: "Campo 1",
  sport: "Society",
  surface: "Grama sintética",
  interval_minutes: "0",
  status: "active",
  photo_url: "",
};

const sports = ["Society", "Beach Tennis", "Tênis", "Futsal", "Vôlei", "Poliesportiva", "Outro"];
const surfaces = ["Grama sintética", "Areia", "Saibro", "Concreto", "Madeira", "Piso modular", "Outro"];

export default function FieldsPage() {
 const { activeArenaId } = useActiveArena();
  const [fields, setFields] = useState<Field[]>([]);
  const [pricingMap, setPricingMap] = useState<Record<string, PricingOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pricingOptions, setPricingOptions] = useState<PricingOption[]>(defaultPricingOptions);

 useEffect(() => {
  if (activeArenaId) {
    loadData();
  }
}, [activeArenaId]);

  async function loadData() {
   if (!activeArenaId) return;

    const { data: fieldsData } = await supabase
      .from("fields")
      .select("*")
      .eq("arena_id", activeArenaId)
      .order("created_at", { ascending: true });

    const loadedFields = fieldsData || [];
    setFields(loadedFields);

    if (loadedFields.length > 0) {
      const fieldIds = loadedFields.map((field) => field.id);

      const { data: pricingData } = await supabase
        .from("field_pricing_options")
        .select("*")
        .in("field_id", fieldIds)
        .order("duration_minutes", { ascending: true });

      const map: Record<string, PricingOption[]> = {};

      for (const field of loadedFields) {
        const optionsForField = pricingData?.filter((item) => item.field_id === field.id);

        map[field.id] = defaultPricingOptions.map((defaultOption) => {
          const found = optionsForField?.find(
            (item) => item.duration_minutes === defaultOption.duration_minutes
          );

          return {
            id: found?.id,
            duration_minutes: defaultOption.duration_minutes,
            label: defaultOption.label,
            price: found?.price ? String(found.price) : defaultOption.price,
            weekend_price: found?.weekend_price ? String(found.weekend_price) : "",
            is_active: found?.is_active ?? defaultOption.is_active,
          };
        });
      }

      setPricingMap(map);
    }

    setLoading(false);
  }

  function openNewForm() {
    setForm({
      ...emptyForm,
      name: `Campo ${fields.length + 1}`,
    });

    setPricingOptions(defaultPricingOptions);
    setShowForm(true);
  }

  function openEditForm(field: Field) {
    setForm({
      id: field.id,
      name: field.name || "",
      sport: field.sport || "Society",
      surface: field.surface || "Grama sintética",
      interval_minutes: String(field.interval_minutes || 0),
      status: field.status || "active",
      photo_url: field.photo_url || "",
    });

    setPricingOptions(pricingMap[field.id] || defaultPricingOptions);
    setShowForm(true);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setForm({ ...form, [name]: value });
  }

  function updatePricingOption(
    durationMinutes: number,
    field: "price" | "weekend_price" | "is_active",
    value: string | boolean
  ) {
    setPricingOptions((current) =>
      current.map((option) =>
        option.duration_minutes === durationMinutes ? { ...option, [field]: value } : option
      )
    );
  }

  async function uploadFieldPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 5MB.");
      return;
    }

    const fileExt = file.name.split(".").pop();
    const fileName = `${activeArenaId}/fields/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("arena-media")
      .upload(fileName, file, { upsert: true });

    if (error) {
      alert(error.message);
      return;
    }

    const { data } = supabase.storage.from("arena-media").getPublicUrl(fileName);

    setForm({ ...form, photo_url: data.publicUrl });
  }

  async function saveField(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Informe o nome da quadra.");
      return;
    }

    const activePricing = pricingOptions.filter((option) => option.is_active);

    if (activePricing.length === 0) {
      alert("Ative pelo menos uma duração de reserva.");
      return;
    }

    for (const option of activePricing) {
      if (!option.price) {
        alert(`Informe o valor normal para ${option.label}.`);
        return;
      }
    }

    const firstActiveOption = activePricing[0];

    setSaving(true);

    const payload = {
      arena_id: activeArenaId,
      name: form.name,
      photo_url: form.photo_url || null,
      sport: form.sport,
      surface: form.surface,
      price: Number(firstActiveOption.price),
      use_weekend_price: activePricing.some((option) => option.weekend_price),
      weekend_price: firstActiveOption.weekend_price
        ? Number(firstActiveOption.weekend_price)
        : null,
      min_duration_minutes: firstActiveOption.duration_minutes,
      interval_minutes: Number(form.interval_minutes || 0),
      status: form.status,
    };

    let fieldId = form.id;

    if (form.id) {
      const { error } = await supabase.from("fields").update(payload).eq("id", form.id);

      if (error) {
        setSaving(false);
        alert(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("fields")
        .insert(payload)
        .select("id")
        .single();

      if (error) {
        setSaving(false);
        alert(error.message);
        return;
      }

      fieldId = data.id;
    }

    for (const option of pricingOptions) {
      await supabase.from("field_pricing_options").upsert({
        field_id: fieldId,
        duration_minutes: option.duration_minutes,
        price: Number(option.price || 0),
        weekend_price: option.weekend_price ? Number(option.weekend_price) : null,
        is_active: option.is_active,
      });
    }

    setSaving(false);
    setShowForm(false);
    setForm(emptyForm);
    await loadData();
  }

  async function deleteField(fieldId: string) {
    if (!confirm("Deseja excluir esta quadra?")) return;

    const { error } = await supabase.from("fields").delete().eq("id", fieldId);

    if (error) {
      alert(error.message);
      return;
    }

    setFields((current) => current.filter((field) => field.id !== fieldId));
  }

  if (loading) {
    return <p className="text-white">Carregando quadras...</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold text-emerald-400">Gestão da arena</p>
          <h1 className="mt-1 text-4xl font-bold text-white">Quadras</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Cadastre quadras, duração das reservas e preços por período.
          </p>
        </div>

        <button
          onClick={openNewForm}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
        >
          <Plus size={18} />
          Nova quadra
        </button>
      </div>

      {showForm && (
        <form onSubmit={saveField} className="rounded-3xl border border-slate-800 bg-[#111827] p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {form.id ? "Editar quadra" : "Nova quadra"}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Configure os preços por duração. Se o fim de semana for diferente, preencha a coluna de sábado/domingo.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-slate-700 p-2 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Input
              label="Nome da quadra"
              helper="Exemplo: Campo 1, Quadra Beach 1, Quadra Principal"
              name="name"
              value={form.name}
              onChange={handleChange}
            />

            <Select
              label="Esporte principal"
              helper="Escolha o esporte mais usado nessa quadra."
              name="sport"
              value={form.sport}
              onChange={handleChange}
              options={sports}
            />

            <Select
              label="Tipo de piso"
              helper="Ajuda o cliente a entender a estrutura da quadra."
              name="surface"
              value={form.surface}
              onChange={handleChange}
              options={surfaces}
            />

            <Select
              label="Intervalo entre reservas"
              helper="Use 0 se uma reserva puder começar logo após a outra."
              name="interval_minutes"
              value={form.interval_minutes}
              onChange={handleChange}
              options={["0", "5", "10", "15", "30"]}
            />

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:col-span-2">
              <h3 className="font-bold text-white">Durações e preços disponíveis</h3>
              <p className="mt-1 text-sm text-slate-400">
                Ative as durações que o cliente pode reservar. Preço normal vale para dias úteis.
                Preço sábado/domingo é opcional; se ficar vazio, usa o preço normal.
              </p>

              <div className="mt-5 space-y-3">
                {pricingOptions.map((option) => (
                  <div
                    key={option.duration_minutes}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[120px_120px_1fr_1fr]">
                      <button
                        type="button"
                        onClick={() =>
                          updatePricingOption(
                            option.duration_minutes,
                            "is_active",
                            !option.is_active
                          )
                        }
                        className={
                          option.is_active
                            ? "rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black"
                            : "rounded-xl bg-slate-800 px-4 py-2 font-bold text-slate-400"
                        }
                      >
                        {option.is_active ? "Ativo" : "Inativo"}
                      </button>

                      <strong className="text-white">{option.label}</strong>

                      <MoneyInputSimple
                        label="Preço normal"
                        value={option.price}
                        disabled={!option.is_active}
                        onChange={(value) =>
                          updatePricingOption(option.duration_minutes, "price", value)
                        }
                      />

                      <MoneyInputSimple
                        label="Preço sábado/domingo"
                        value={option.weekend_price}
                        disabled={!option.is_active}
                        placeholder="Opcional"
                        onChange={(value) =>
                          updatePricingOption(option.duration_minutes, "weekend_price", value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-white">Quadra ativa?</h3>
                  <p className="text-sm text-slate-400">
                    Quadras inativas não aparecem no agendamento público.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      status: form.status === "active" ? "inactive" : "active",
                    })
                  }
                  className={
                    form.status === "active"
                      ? "rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black"
                      : "rounded-xl bg-slate-800 px-4 py-2 font-bold text-slate-300"
                  }
                >
                  {form.status === "active" ? "Ativa" : "Inativa"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 md:col-span-2">
              <h3 className="font-bold text-white">Foto da quadra</h3>
              <p className="mt-1 text-sm text-slate-400">
                Opcional. Essa foto ajuda o cliente a reconhecer o espaço.
              </p>

              {form.photo_url && (
                <img
                  src={form.photo_url}
                  alt="Foto da quadra"
                  className="mt-4 h-48 w-full max-w-md rounded-xl object-cover"
                />
              )}

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <label className="cursor-pointer rounded-xl bg-slate-800 px-4 py-3 text-center font-semibold text-white hover:bg-slate-700">
                  {form.photo_url ? "Trocar foto" : "Enviar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadFieldPhoto}
                    className="hidden"
                  />
                </label>

                {form.photo_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, photo_url: "" })}
                    className="rounded-xl border border-red-500/40 px-4 py-3 font-semibold text-red-400 hover:bg-red-500 hover:text-white"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            disabled={saving}
            className="mt-6 flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? "Salvando..." : "Salvar quadra"}
          </button>
        </form>
      )}

      {fields.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-700 bg-[#111827] p-8 text-center">
          <h2 className="text-2xl font-bold text-white">Nenhuma quadra cadastrada</h2>
          <p className="mt-2 text-slate-400">
            Cadastre a primeira quadra para começar a receber reservas.
          </p>
          <button
            onClick={openNewForm}
            className="mt-5 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
          >
            Cadastrar primeira quadra
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {fields.map((field) => {
            const prices = pricingMap[field.id] || [];

            return (
              <div
                key={field.id}
                className="overflow-hidden rounded-3xl border border-slate-800 bg-[#111827]"
              >
                {field.photo_url ? (
                  <img
                    src={field.photo_url}
                    alt={field.name}
                    className="h-40 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center bg-slate-950 text-slate-500">
                    Sem foto
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{field.name}</h3>
                      <p className="text-sm text-slate-400">
                        {field.sport} • {field.surface}
                      </p>
                    </div>

                    <span
                      className={
                        field.status === "active"
                          ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300"
                          : "rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-slate-400"
                      }
                    >
                      {field.status === "active" ? "Ativa" : "Inativa"}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-950/60 p-4">
                    <p className="text-sm font-semibold text-slate-300">Preços disponíveis</p>

                    <div className="mt-3 space-y-2">
                      {prices
                        .filter((option) => option.is_active)
                        .map((option) => (
                          <div key={option.duration_minutes} className="text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-400">{option.label}</span>
                              <strong className="text-white">
                                R$ {formatMoney(option.price)}
                              </strong>
                            </div>

                            {option.weekend_price && (
                              <div className="mt-1 flex justify-between text-xs">
                                <span className="text-slate-500">Sáb/Dom</span>
                                <strong className="text-emerald-300">
                                  R$ {formatMoney(option.weekend_price)}
                                </strong>
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => openEditForm(field)}
                      className="flex-1 rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-700"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => deleteField(field.id)}
                      className="rounded-xl border border-red-500/40 px-4 py-3 text-red-400 hover:bg-red-500 hover:text-white"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatMoney(value: string | number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function Input({
  label,
  helper,
  name,
  value,
  onChange,
}: {
  label: string;
  helper: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400"
      />
      <span className="mt-1 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}

function MoneyInputSimple({
  label,
  value,
  disabled,
  placeholder = "0,00",
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs font-medium text-slate-400">{label}</span>

      <div className="mt-1 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-emerald-400">
        <span className="flex items-center border-r border-slate-700 bg-slate-900 px-4 font-bold text-emerald-400">
          R$
        </span>

        <input
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value.replace(",", "."))}
          className="w-full bg-transparent p-3 text-white outline-none disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
    </label>
  );
}

function Select({
  label,
  helper,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  helper: string;
  name: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement>;
  options: string[];
}) {
  return (
    <label>
      <span className="text-sm font-medium text-slate-200">{label}</span>

      <select
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {name.includes("minutes") ? `${option} minutos` : option}
          </option>
        ))}
      </select>

      <span className="mt-1 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}
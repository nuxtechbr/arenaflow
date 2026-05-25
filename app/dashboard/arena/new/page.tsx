"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Crown,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "../../../../lib/supabase";
import { useActiveArena } from "../../../../hooks/use-active-arena";

type SubscriptionPlanStatus = {
  id: string;
  plan_key: string | null;
  status: string | null;
  allow_multi_arena: boolean | null;
  max_arenas: number | null;
};

const SUPPORT_WHATSAPP = "5522999270052";

const emptyForm = {
  name: "",
  whatsapp: "",
  address: "",
  description: "",
};

export default function NewArenaPage() {
  const {
    arenas,
    activeArenaId,
    activeArenaInfo,
    setActiveArenaId,
    loading: arenasLoading,
  } = useActiveArena();

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [planStatus, setPlanStatus] = useState<SubscriptionPlanStatus | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!arenasLoading) loadPlanStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenasLoading, activeArenaId]);

  const arenaCount = arenas?.length || 0;
  const maxArenas = Number(planStatus?.max_arenas || 1);
  const isProPlan = Boolean(planStatus?.allow_multi_arena);
  const canCreateArena = arenaCount === 0 || isProPlan || arenaCount < maxArenas;

  const planName = useMemo(() => {
    return isProPlan ? "ArenaFlow Pro" : "ArenaFlow Essencial";
  }, [isProPlan]);

  async function loadPlanStatus() {
    if (!activeArenaId) {
      setPlanStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("subscriptions")
      .select("id, plan_key, status, allow_multi_arena, max_arenas")
      .eq("arena_id", activeArenaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      setPlanStatus(null);
      setLoading(false);
      return;
    }

    setPlanStatus((data || null) as SubscriptionPlanStatus | null);
    setLoading(false);
  }

  async function createArena(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) return alert("Informe o nome da nova arena.");
    if (arenaCount > 0 && !canCreateArena) return alert("Seu plano atual não permite criar outra arena.");

    setCreating(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch("/api/arenas/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          whatsapp: form.whatsapp.trim(),
          address: form.address.trim(),
          description: form.description.trim(),
          source_arena_id: activeArenaId,
        }),
      });

      const data = await response.json().catch(() => null);

      setCreating(false);

      if (!response.ok) {
        alert(data?.error || "Não foi possível criar a arena.");
        return;
      }

      if (data?.arena?.id) {
        setActiveArenaId(data.arena.id);
      }

      window.location.href = "/dashboard/onboarding";
    } catch {
      setCreating(false);
      alert("Erro ao criar arena agora.");
    }
  }

  function openUpgradeWhatsapp() {
    const message = `Olá! Quero fazer upgrade para o ArenaFlow Pro e liberar multiarenas.\n\nArena atual: ${activeArenaInfo?.name || ""}`;
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`, "_blank");
  }

  if (arenasLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Verificando plano...
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-24 text-white md:pb-0">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />

          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
            <div>
              <Link
                href="/dashboard"
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition hover:border-emerald-400"
              >
                <ArrowLeft size={15} />
                Voltar
              </Link>

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <Building2 size={16} />
                Multiarenas
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Nova arena
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
                Crie outro estabelecimento ou unidade para controlar agenda, quadras, clientes e financeiro separadamente.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-[#07111B] p-5 lg:min-w-[280px]">
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Plano atual</p>
              <div className="mt-2 flex items-center gap-2">
                {isProPlan ? <Crown className="text-emerald-300" /> : <Lock className="text-yellow-300" />}
                <p className="text-xl font-black">{planName}</p>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {arenaCount} de {isProPlan ? maxArenas : 1} arena(s) em uso
              </p>
            </div>
          </div>
        </div>
      </section>

      {!canCreateArena ? (
        <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="rounded-[2rem] border border-yellow-500/20 bg-yellow-500/10 p-6 md:p-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-yellow-500/10 text-yellow-300">
              <Lock size={34} />
            </div>

            <h2 className="mt-5 text-3xl font-black text-yellow-50">
              Multiarenas é recurso do Pro
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-yellow-50/80 md:text-base">
              O plano Essencial permite apenas uma arena/estabelecimento. Para criar outras arenas,
              unidades ou estabelecimentos, faça upgrade para o ArenaFlow Pro.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <FeatureItem title="Essencial" description="1 arena ativa com todos os recursos principais." locked />
              <FeatureItem title="Pro" description="Criação e alternância entre múltiplas arenas." />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/billing"
                className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 font-black text-black transition hover:bg-emerald-400"
              >
                Ver plano Pro
                <Crown size={18} />
              </Link>

              <button
                type="button"
                onClick={openUpgradeWhatsapp}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-4 font-black text-white transition hover:border-emerald-400"
              >
                <MessageCircle size={18} />
                Falar no WhatsApp
              </button>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6">
            <h3 className="text-2xl font-black">Quando usar o Pro?</h3>

            <div className="mt-5 space-y-3">
              <FeatureItem title="Mais de um estabelecimento" description="Ex: unidade no Centro e unidade no bairro." />
              <FeatureItem title="Multiarenas no mesmo local" description="Ex: futebol, beach tennis, tênis e society separados." />
              <FeatureItem title="Gestão separada" description="Cada arena com link, clientes, agenda e financeiro próprios." />
            </div>
          </aside>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
          <form onSubmit={createArena} className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-5 shadow-2xl shadow-black/20 md:p-7">
            <div className="mb-6">
              <div className="mb-3 inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-300">
                Cadastro
              </div>

              <h2 className="text-2xl font-black md:text-3xl">Dados da nova arena</h2>

              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Depois de criar, você será levado para a implantação da nova arena.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <InputBox
                label="Nome da arena"
                placeholder="Ex: Arena Beach Cabo Frio"
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />

              <InputBox
                label="WhatsApp da arena"
                placeholder="Ex: 22999999999"
                value={form.whatsapp}
                onChange={(value) => setForm({ ...form, whatsapp: value.replace(/\D/g, "") })}
              />

              <div className="md:col-span-2">
                <InputBox
                  label="Endereço"
                  placeholder="Rua, bairro, cidade"
                  value={form.address}
                  onChange={(value) => setForm({ ...form, address: value })}
                  icon={<MapPin size={18} />}
                />
              </div>

              <label className="md:col-span-2">
                <span className="text-sm font-black text-slate-200">Descrição</span>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Fale um pouco sobre essa arena, estrutura e modalidades..."
                  rows={5}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07111B] p-4 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 py-5 text-lg font-black text-black transition hover:bg-emerald-400 disabled:opacity-60 md:w-auto"
            >
              {creating ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              {creating ? "Criando arena..." : "Criar nova arena"}
            </button>
          </form>

          <aside className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
              {isProPlan ? <Crown size={28} /> : <ShieldCheck size={28} />}
            </div>

            <h3 className="mt-4 text-2xl font-black">Organização profissional</h3>

            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Cada arena criada tem configuração, quadras, clientes, reservas, financeiro e link público próprios.
            </p>

            <div className="mt-5 space-y-3">
              <FeatureItem title="Agenda separada" description="Cada arena controla seus horários." />
              <FeatureItem title="Link público próprio" description="Cada unidade pode divulgar seu link." />
              <FeatureItem title="Clientes separados" description="CRM mais organizado por operação." />
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}

function FeatureItem({
  title,
  description,
  locked = false,
}: {
  title: string;
  description: string;
  locked?: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/10 bg-[#07111B] p-4">
      <div
        className={
          locked
            ? "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-300"
            : "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300"
        }
      >
        {locked ? <Lock size={17} /> : <CheckCircle2 size={17} />}
      </div>

      <div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function InputBox({
  label,
  value,
  onChange,
  placeholder,
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label>
      <span className="text-sm font-black text-slate-200">{label}</span>

      <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#07111B] px-4 focus-within:border-emerald-400">
        {icon && <span className="text-slate-500">{icon}</span>}

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-4 text-white outline-none placeholder:text-slate-600"
        />
      </div>
    </label>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ImageIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trophy,
  Wallet,
  Clock,
} from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

type Arena = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  cover_url: string | null;
};

type ArenaSettings = {
  arena_id: string;
  pix_key: string | null;
  receipt_whatsapp: string | null;
};

type OnboardingChecklist = {
  id?: string;
  arena_id: string;
  has_logo: boolean;
  has_cover: boolean;
  has_gallery: boolean;
  has_fields: boolean;
  has_prices: boolean;
  has_hours: boolean;
  has_pix: boolean;
  public_link_tested: boolean;
  updated_at?: string;
};

type ChecklistKey =
  | "has_logo"
  | "has_cover"
  | "has_gallery"
  | "has_fields"
  | "has_prices"
  | "has_hours"
  | "has_pix"
  | "public_link_tested";

type ChecklistItem = {
  key: ChecklistKey;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  done: boolean;
  action: string;
};

export default function DashboardOnboardingPage() {
  const { activeArenaId, activeArenaInfo, loading: arenaLoading } = useActiveArena();

  const [loading, setLoading] = useState(true);
  const [savingTest, setSavingTest] = useState(false);

  const [arena, setArena] = useState<Arena | null>(null);
  const [settings, setSettings] = useState<ArenaSettings | null>(null);
  const [checklist, setChecklist] = useState<OnboardingChecklist | null>(null);

  const [galleryCount, setGalleryCount] = useState(0);
  const [fieldsCount, setFieldsCount] = useState(0);
  const [pricesCount, setPricesCount] = useState(0);
  const [hoursCount, setHoursCount] = useState(0);

  useEffect(() => {
    if (!arenaLoading && activeArenaId) loadChecklist();
    if (!arenaLoading && !activeArenaId) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arenaLoading, activeArenaId]);

  const computed = useMemo(() => {
    return {
      has_logo: Boolean(arena?.logo_url),
      has_cover: Boolean(arena?.cover_url),
      has_gallery: galleryCount >= 3,
      has_fields: fieldsCount > 0,
      has_prices: pricesCount > 0,
      has_hours: hoursCount > 0,
      has_pix: Boolean(settings?.pix_key || settings?.receipt_whatsapp),
      public_link_tested: Boolean(checklist?.public_link_tested),
    };
  }, [arena, settings, galleryCount, fieldsCount, pricesCount, hoursCount, checklist]);

  const publicUrl = useMemo(() => {
    if (!arena?.slug) return "#";
    if (typeof window === "undefined") return `/arena/${arena.slug}`;
    return `${window.location.origin}/arena/${arena.slug}`;
  }, [arena]);

  const items: ChecklistItem[] = [
    {
      key: "has_logo",
      title: "Adicionar logo da arena",
      description: "A logo aparece no topo do link público e passa confiança para quem vai reservar.",
      href: "/dashboard/arena?tab=visual",
      icon: <ImageIcon />,
      done: computed.has_logo,
      action: "Adicionar logo",
    },
    {
      key: "has_cover",
      title: "Adicionar foto de capa",
      description: "A capa é a primeira imagem que o cliente vê ao abrir o link da arena.",
      href: "/dashboard/arena?tab=visual",
      icon: <Trophy />,
      done: computed.has_cover,
      action: "Adicionar capa",
    },
    {
      key: "has_gallery",
      title: "Adicionar fotos da estrutura",
      description: "Use pelo menos 3 fotos da arena para valorizar quadras, entrada, bar e ambiente.",
      href: "/dashboard/arena?tab=visual",
      icon: <Sparkles />,
      done: computed.has_gallery,
      action: "Adicionar fotos",
    },
    {
      key: "has_fields",
      title: "Cadastrar quadras",
      description: "As quadras precisam estar cadastradas para aparecer no agendamento.",
      href: "/dashboard/fields",
      icon: <MapPin />,
      done: computed.has_fields,
      action: "Cadastrar quadras",
    },
    {
      key: "has_prices",
      title: "Cadastrar preços",
      description: "Configure valores por duração para liberar horários no link público.",
      href: "/dashboard/fields",
      icon: <Wallet />,
      done: computed.has_prices,
      action: "Cadastrar preços",
    },
    {
      key: "has_hours",
      title: "Configurar funcionamento",
      description: "Defina os dias e horários em que a arena aceita reservas.",
      href: "/dashboard/arena?tab=hours",
      icon: <Clock />,
      done: computed.has_hours,
      action: "Configurar horários",
    },
    {
      key: "has_pix",
      title: "Configurar Pix / sinal",
      description: "Configure chave Pix e WhatsApp de comprovante para confirmação das reservas.",
      href: "/dashboard/arena?tab=deposit",
      icon: <CreditCard />,
      done: computed.has_pix,
      action: "Configurar Pix",
    },
    {
      key: "public_link_tested",
      title: "Testar link público",
      description: "Abra o link da arena, simule uma reserva e confira se está pronto para divulgar.",
      href: publicUrl,
      icon: <ExternalLink />,
      done: computed.public_link_tested,
      action: "Abrir link",
    },
  ];

  const completed = items.filter((item) => item.done).length;
  const progress = Math.round((completed / items.length) * 100);
  const ready = completed === items.length;

  async function loadChecklist() {
    if (!activeArenaId) return;

    setLoading(true);

    const [arenaRes, settingsRes, galleryRes, fieldsRes, hoursRes, checklistRes] =
      await Promise.all([
        supabase
          .from("arenas")
          .select("id, name, slug, logo_url, cover_url")
          .eq("id", activeArenaId)
          .maybeSingle(),
        supabase
          .from("arena_settings")
          .select("arena_id, pix_key, receipt_whatsapp")
          .eq("arena_id", activeArenaId)
          .maybeSingle(),
        supabase.from("arena_gallery").select("id", { count: "exact" }).eq("arena_id", activeArenaId),
        supabase
          .from("fields")
          .select("id", { count: "exact" })
          .eq("arena_id", activeArenaId)
          .or("status.is.null,status.eq.active,status.eq.ativo,status.eq.available,status.eq.disponivel"),
        supabase
          .from("arena_opening_hours")
          .select("id", { count: "exact" })
          .eq("arena_id", activeArenaId)
          .eq("is_open", true),
        supabase
          .from("onboarding_checklists")
          .select("*")
          .eq("arena_id", activeArenaId)
          .maybeSingle(),
      ]);

    const loadedArena = (arenaRes.data || null) as Arena | null;
    const loadedSettings = (settingsRes.data || null) as ArenaSettings | null;

    setArena(loadedArena);
    setSettings(loadedSettings);
    setGalleryCount(galleryRes.count || 0);
    setFieldsCount(fieldsRes.count || 0);
    setHoursCount(hoursRes.count || 0);
    setChecklist((checklistRes.data || null) as OnboardingChecklist | null);

    const fieldIds = ((fieldsRes.data || []) as any[]).map((field) => field.id);

    let prices = 0;
    if (fieldIds.length > 0) {
      const { count } = await supabase
        .from("field_pricing_options")
        .select("id", { count: "exact" })
        .in("field_id", fieldIds)
        .eq("is_active", true);

      prices = count || 0;
    }

    setPricesCount(prices);

    const payload: OnboardingChecklist = {
      arena_id: activeArenaId,
      has_logo: Boolean(loadedArena?.logo_url),
      has_cover: Boolean(loadedArena?.cover_url),
      has_gallery: (galleryRes.count || 0) >= 3,
      has_fields: (fieldsRes.count || 0) > 0,
      has_prices: prices > 0,
      has_hours: (hoursRes.count || 0) > 0,
      has_pix: Boolean(loadedSettings?.pix_key || loadedSettings?.receipt_whatsapp),
      public_link_tested: Boolean(checklistRes.data?.public_link_tested),
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("onboarding_checklists")
      .upsert(payload, { onConflict: "arena_id" });

    const { data } = await supabase
      .from("onboarding_checklists")
      .select("*")
      .eq("arena_id", activeArenaId)
      .maybeSingle();

    setChecklist((data || null) as OnboardingChecklist | null);
    setLoading(false);
  }

  async function markPublicLinkTested() {
    if (!activeArenaId) return;

    setSavingTest(true);

    const { error } = await supabase
      .from("onboarding_checklists")
      .upsert(
        {
          arena_id: activeArenaId,
          ...computed,
          public_link_tested: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "arena_id" }
      );

    setSavingTest(false);

    if (error) {
      alert(error.message);
      return;
    }

    await loadChecklist();
  }

  if (arenaLoading || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center text-white">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0F172A] px-6 py-4">
          <Loader2 className="animate-spin text-emerald-400" />
          Carregando implantação...
        </div>
      </main>
    );
  }

  if (!activeArenaId) {
    return (
      <main className="min-h-screen text-white">
        <div className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-8">
          <h1 className="text-3xl font-black">Nenhuma arena selecionada</h1>
          <p className="mt-2 text-slate-400">
            Selecione uma arena para acompanhar a implantação.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-24 text-white md:pb-0">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-[#0F172A] shadow-2xl shadow-black/20">
        <div className="relative p-6 md:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.16),transparent_35%)]" />

          <div className="relative grid gap-6 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                <Sparkles size={16} />
                Implantação da arena
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                Complete sua arena
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 md:text-base">
                Checklist para deixar o link público pronto para vender horários com aparência profissional.
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                {arena?.slug && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3 font-black text-black transition hover:bg-emerald-400"
                  >
                    Abrir link público
                    <ExternalLink size={18} />
                  </a>
                )}

                <button
                  type="button"
                  onClick={loadChecklist}
                  className="rounded-2xl border border-white/10 px-5 py-3 font-black text-white transition hover:border-emerald-400"
                >
                  Atualizar checklist
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#07111B] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-400">Progresso</p>
                  <p className="mt-1 text-4xl font-black">{progress}%</p>
                </div>

                <div
                  className={
                    ready
                      ? "rounded-2xl bg-emerald-500 p-4 text-black"
                      : "rounded-2xl bg-yellow-500/10 p-4 text-yellow-300"
                  }
                >
                  {ready ? <CheckCircle2 size={28} /> : <AlertTriangle size={28} />}
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <p className="mt-3 text-sm text-slate-400">
                {completed} de {items.length} etapas concluídas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {ready ? (
        <section className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-6">
          <h2 className="text-2xl font-black text-emerald-100">
            Arena pronta para divulgar
          </h2>
          <p className="mt-2 text-sm text-emerald-100/80">
            Agora você já pode mandar o link para os clientes reservarem online.
          </p>
        </section>
      ) : (
        <section className="rounded-[2rem] border border-yellow-500/20 bg-yellow-500/10 p-6">
          <div className="flex gap-3">
            <AlertTriangle className="mt-1 shrink-0 text-yellow-300" />
            <div>
              <h2 className="text-xl font-black text-yellow-100">
                Ainda faltam configurações
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-yellow-100/80">
                Complete os itens abaixo para deixar a arena com aparência profissional e pronta para receber reservas.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {items.map((item) => (
          <ChecklistCard
            key={item.key}
            item={item}
            publicUrl={publicUrl}
            savingTest={savingTest}
            onMarkPublicLinkTested={markPublicLinkTested}
          />
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-[#0F172A] p-6">
        <h2 className="text-2xl font-black">Resumo da arena</h2>

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Fotos na galeria" value={galleryCount} />
          <Metric label="Quadras" value={fieldsCount} />
          <Metric label="Preços ativos" value={pricesCount} />
          <Metric label="Dias abertos" value={hoursCount} />
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-[#07111B] p-5">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-400">
            Link público
          </p>
          <p className="mt-2 break-all text-sm font-bold text-white">
            {arena?.slug ? publicUrl : "Slug ainda não configurado"}
          </p>
        </div>
      </section>
    </main>
  );
}

function ChecklistCard({
  item,
  publicUrl,
  savingTest,
  onMarkPublicLinkTested,
}: {
  item: ChecklistItem;
  publicUrl: string;
  savingTest: boolean;
  onMarkPublicLinkTested: () => void;
}) {
  const isPublicLink = item.key === "public_link_tested";

  return (
    <div
      className={
        item.done
          ? "rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-5"
          : "rounded-[2rem] border border-white/10 bg-[#0F172A] p-5"
      }
    >
      <div className="flex gap-4">
        <div
          className={
            item.done
              ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-black"
              : "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-emerald-400"
          }
        >
          {item.done ? <CheckCircle2 /> : item.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h3 className="text-lg font-black text-white">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">
                {item.description}
              </p>
            </div>

            <span
              className={
                item.done
                  ? "w-fit rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-black text-emerald-300"
                  : "w-fit rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-black text-yellow-300"
              }
            >
              {item.done ? "Concluído" : "Pendente"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {isPublicLink ? (
              <>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-400"
                >
                  Abrir link
                  <ExternalLink size={16} />
                </a>

                <button
                  type="button"
                  disabled={savingTest}
                  onClick={onMarkPublicLinkTested}
                  className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >
                  {savingTest ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Marcar como testado
                </button>
              </>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black transition hover:bg-emerald-400"
              >
                {item.action}
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#07111B] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

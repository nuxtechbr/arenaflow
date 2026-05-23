"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "../../../../lib/supabase";

export default function NewArenaPage() {
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    whatsapp: "",
  });

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  }

  async function createArena(event: React.FormEvent) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Informe o nome da arena.");
      return;
    }

    if (!form.slug.trim()) {
      alert("Informe o link público da arena.");
      return;
    }

    const slugIsValid = /^[a-z0-9-]+$/.test(form.slug);

    if (!slugIsValid) {
      alert("O link público deve ter apenas letras minúsculas, números e hífen.");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const fullWhatsapp = form.whatsapp
      ? form.whatsapp.startsWith("55")
        ? form.whatsapp
        : `55${form.whatsapp}`
      : "";

    const { data: arena, error: arenaError } = await supabase
      .from("arenas")
      .insert({
        name: form.name.trim(),
        slug: form.slug.trim(),
        whatsapp: fullWhatsapp,
      })
      .select("id")
      .single();

    if (arenaError || !arena) {
      setSaving(false);
      alert(arenaError?.message || "Erro ao criar arena.");
      return;
    }

    const { error: userArenaError } = await supabase.from("user_arenas").insert({
      user_id: user.id,
      arena_id: arena.id,
      role: "owner",
    });

    if (userArenaError) {
      setSaving(false);
      alert(userArenaError.message);
      return;
    }

    const defaultHours = [
      { weekday: 1, is_open: true, open_time: "08:00", close_time: "23:00" },
      { weekday: 2, is_open: true, open_time: "08:00", close_time: "23:00" },
      { weekday: 3, is_open: true, open_time: "08:00", close_time: "23:00" },
      { weekday: 4, is_open: true, open_time: "08:00", close_time: "23:00" },
      { weekday: 5, is_open: true, open_time: "08:00", close_time: "23:00" },
      { weekday: 6, is_open: true, open_time: "08:00", close_time: "23:00" },
      { weekday: 0, is_open: true, open_time: "08:00", close_time: "23:00" },
    ];

    await supabase.from("arena_opening_hours").insert(
      defaultHours.map((hour) => ({
        arena_id: arena.id,
        ...hour,
      }))
    );

    await supabase.from("arena_settings").upsert(
      {
        arena_id: arena.id,
        require_deposit: false,
        deposit_amount_type: "fixed",
      },
      { onConflict: "arena_id" }
    );

    localStorage.setItem("arenaflow_active_arena_id", arena.id);

    setSaving(false);
    window.location.href = "/dashboard/arena?tab=visual";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm font-semibold text-[#22C55E]">Multi-arena</p>
        <h1 className="mt-1 text-4xl font-black text-white">Nova Arena</h1>
        <p className="mt-2 text-slate-400">
          Cadastre uma nova unidade para gerenciar agenda, quadras, reservas e financeiro separadamente.
        </p>
      </div>

      <form
        onSubmit={createArena}
        className="rounded-3xl border border-white/10 bg-[#0F172A]/80 p-6 shadow-2xl shadow-black/20"
      >
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-bold text-slate-200">Nome da arena</span>
            <input
              value={form.name}
              onChange={(event) => {
                updateField("name", event.target.value);

                if (!form.slug) {
                  updateField("slug", generateSlug(event.target.value));
                }
              }}
              placeholder="Exemplo: Arena Society Centro"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07111B] px-4 py-3 text-white outline-none focus:border-[#22C55E]"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-200">Nome do link público</span>
            <input
              value={form.slug}
              onChange={(event) => updateField("slug", generateSlug(event.target.value))}
              placeholder="arena-society-centro"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07111B] px-4 py-3 text-white outline-none focus:border-[#22C55E]"
            />
            <p className="mt-2 text-xs text-slate-500">
              Use letras minúsculas, números e hífen.
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-slate-200">WhatsApp principal</span>
            <div className="mt-2 flex overflow-hidden rounded-2xl border border-white/10 bg-[#07111B] focus-within:border-[#22C55E]">
              <span className="flex items-center border-r border-white/10 bg-white/[0.03] px-4 font-bold text-[#22C55E]">
                +55
              </span>
              <input
                value={form.whatsapp}
                onChange={(event) =>
                  updateField("whatsapp", event.target.value.replace(/\D/g, "").replace(/^55/, ""))
                }
                placeholder="22999999999"
                className="w-full bg-transparent px-4 py-3 text-white outline-none"
              />
            </div>
          </label>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-6 py-3 font-black text-black shadow-lg shadow-emerald-500/20 disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? "Criando..." : "Criar arena"}
          </button>
        </div>
      </form>
    </div>
  );
}
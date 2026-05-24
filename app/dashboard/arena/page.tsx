"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Save } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useActiveArena } from "../../../hooks/use-active-arena";

import VisualSection from "../../../components/arena-settings/visual-section";
import InfoSection from "../../../components/arena-settings/info-section";
import HoursSection from "../../../components/arena-settings/hours-section";
import RulesSection from "../../../components/arena-settings/rules-section";
import DepositSection from "../../../components/arena-settings/deposit-section";

type OpeningHour = {
  id: string;
  weekday: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
};

type ArenaRule = {
  id: string;
  rule_text: string;
  is_active: boolean;
};

type GalleryImage = {
  id: string;
  image_url: string;
  image_order: number;
};

type ArenaTab = "visual" | "info" | "hours" | "rules" | "deposit";

const defaultDepositMessage =
  "Olá! 👋\n\nPara confirmar sua reserva, realize o pagamento do sinal via Pix e envie o comprovante no WhatsApp informado.\n\n✅ Assim que confirmarmos o pagamento, sua reserva será aprovada.\n\nSe tiver qualquer dúvida, é só falar com a gente.\n\nObrigado! 🙏";

const days = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

const tabTitles: Record<ArenaTab, { title: string; description: string }> = {
  visual: {
    title: "Visual da Arena",
    description: "Configure logo, capa e fotos exibidas no link público.",
  },
  info: {
    title: "Dados da Arena",
    description:
      "Configure nome, contato, redes sociais, endereço e link público.",
  },
  hours: {
    title: "Funcionamento",
    description: "Configure os dias e horários em que a arena aceita reservas.",
  },
  rules: {
    title: "Regras",
    description:
      "Configure as regras que aparecem para o cliente antes do agendamento.",
  },
  deposit: {
    title: "Reserva com Sinal",
    description:
      "Configure se a reserva exige sinal via Pix e os dados de pagamento.",
  },
};

function getValidTab(value: string | null): ArenaTab {
  if (
    value === "visual" ||
    value === "info" ||
    value === "hours" ||
    value === "rules" ||
    value === "deposit"
  ) {
    return value;
  }

  return "visual";
}

export default function ArenaPage() {
  const searchParams = useSearchParams();
  const activeTab = getValidTab(searchParams.get("tab"));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    whatsapp: "",
    phone: "",
    instagram: "",
    facebook: "",
    address: "",
    maps_url: "",
    description: "",
    logo_url: "",
    cover_url: "",
  });

  const [deposit, setDeposit] = useState({
    requireDeposit: false,
    depositAmountType: "fixed" as "fixed" | "percentage",
    depositFixedAmount: "",
    depositPercentage: "",
    pixKey: "",
    pixKeyType: "",
    pixReceiverName: "",
    receiptWhatsapp: "",
    depositMessage: defaultDepositMessage,
  });

  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);
  const [rules, setRules] = useState<ArenaRule[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [newRule, setNewRule] = useState("");

  const { activeArenaId } = useActiveArena();

  useEffect(() => {
    if (activeArenaId) loadData();
  }, [activeArenaId]);

  async function loadData() {
    setLoading(true);

    if (!activeArenaId) {
      setLoading(false);
      return;
    }

    const { data: arena } = await supabase
      .from("arenas")
      .select("*")
      .eq("id", activeArenaId)
      .single();

    if (arena) {
      setForm({
        name: arena.name || "",
        slug: arena.slug || "",
        whatsapp: arena.whatsapp?.replace(/^55/, "") || "",
        phone: arena.phone || "",
        instagram: arena.instagram || "",
        facebook: arena.facebook || "",
        address: arena.address || "",
        maps_url: arena.maps_url || "",
        description: arena.description || "",
        logo_url: arena.logo_url || "",
        cover_url: arena.cover_url || "",
      });
    }

    const { data: settings } = await supabase
      .from("arena_settings")
      .select("*")
      .eq("arena_id", activeArenaId)
      .maybeSingle();

    if (settings) {
      setDeposit({
        requireDeposit: settings.require_deposit || false,
        depositAmountType: settings.deposit_amount_type || "fixed",
        depositFixedAmount: settings.deposit_fixed_amount?.toString() || "",
        depositPercentage: settings.deposit_percentage?.toString() || "",
        pixKey: settings.pix_key || "",
        pixKeyType: settings.pix_key_type || "",
        pixReceiverName: settings.pix_receiver_name || "",
        receiptWhatsapp: settings.receipt_whatsapp?.replace(/^55/, "") || "",
        depositMessage: settings.deposit_message || defaultDepositMessage,
      });
    }

    const { data: hours } = await supabase
      .from("arena_opening_hours")
      .select("*")
      .eq("arena_id", activeArenaId);

    if (hours) {
      setOpeningHours(
        days.map((day) => {
          const found = hours.find((item) => item.weekday === day.value);

          return {
            id: found?.id || "",
            weekday: day.value,
            is_open: found?.is_open ?? true,
            open_time: found?.open_time?.slice(0, 5) || "08:00",
            close_time: found?.close_time?.slice(0, 5) || "23:00",
          };
        })
      );
    } else {
      setOpeningHours(
        days.map((day) => ({
          id: "",
          weekday: day.value,
          is_open: true,
          open_time: "08:00",
          close_time: "23:00",
        }))
      );
    }

    const { data: arenaRules } = await supabase
      .from("arena_rules")
      .select("id, rule_text, is_active")
      .eq("arena_id", activeArenaId)
      .order("created_at", { ascending: true });

    if (arenaRules) setRules(arenaRules);

    const { data: galleryImages } = await supabase
      .from("arena_gallery")
      .select("id, image_url, image_order")
      .eq("arena_id", activeArenaId)
      .order("image_order", { ascending: true });

    if (galleryImages) setGallery(galleryImages);

    setLoading(false);
  }

  function handleChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleDepositChange(field: string, value: string | boolean) {
    setDeposit({ ...deposit, [field]: value });
  }

  function updateHour(
    weekday: number,
    field: "is_open" | "open_time" | "close_time",
    value: boolean | string
  ) {
    setOpeningHours((current) =>
      current.map((item) =>
        item.weekday === weekday ? { ...item, [field]: value } : item
      )
    );
  }

  function copyFirstHourToAll() {
    const firstOpenDay = openingHours.find((item) => item.is_open);
    if (!firstOpenDay) return;

    setOpeningHours((current) =>
      current.map((item) => ({
        ...item,
        is_open: true,
        open_time: firstOpenDay.open_time,
        close_time: firstOpenDay.close_time,
      }))
    );
  }

  async function uploadImage(file: File, folder: string) {
    if (!activeArenaId) {
      alert("Arena não carregada. Aguarde e tente novamente.");
      return null;
    }

    if (!file.type.startsWith("image/")) {
      alert("Envie apenas arquivos de imagem.");
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 5MB.");
      return null;
    }

    const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase();
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    const fileName = `${activeArenaId}/${safeFolder}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from("arena-media")
      .upload(fileName, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      alert(error.message);
      return null;
    }

    const { data } = supabase.storage.from("arena-media").getPublicUrl(fileName);

    return data.publicUrl;
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file, "logo");
    if (!url) return;

    setForm((current) => ({ ...current, logo_url: url }));
  }

  async function handleCoverUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file, "cover");
    if (!url) return;

    setForm((current) => ({ ...current, cover_url: url }));
  }

  async function handleGalleryUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    if (gallery.length + files.length > 8) {
      alert("A galeria permite no máximo 8 fotos.");
      return;
    }

    for (const file of files) {
      const url = await uploadImage(file, "gallery");
      if (!url) continue;

      const { data, error } = await supabase
        .from("arena_gallery")
        .insert({
          arena_id: activeArenaId,
          image_url: url,
          image_order: gallery.length + 1,
        })
        .select("id, image_url, image_order")
        .single();

      if (!error && data) {
        setGallery((current) => [...current, data]);
      }
    }
  }

  async function deleteGalleryImage(imageId: string) {
    if (!confirm("Deseja remover esta foto da galeria?")) return;

    const { error } = await supabase
      .from("arena_gallery")
      .delete()
      .eq("id", imageId);

    if (error) {
      alert(error.message);
      return;
    }

    setGallery((current) => current.filter((item) => item.id !== imageId));
  }

  async function addRule() {
    if (!newRule.trim()) {
      alert("Digite a regra antes de adicionar.");
      return;
    }

    const { data, error } = await supabase
      .from("arena_rules")
      .insert({
        arena_id: activeArenaId,
        rule_key: `custom_${Date.now()}`,
        rule_text: newRule.trim(),
        is_active: true,
      })
      .select("id, rule_text, is_active")
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setRules([...rules, data]);
    setNewRule("");
  }

  async function deleteRule(ruleId: string) {
    if (!confirm("Deseja excluir esta regra?")) return;

    const { error } = await supabase
      .from("arena_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      alert(error.message);
      return;
    }

    setRules((current) => current.filter((rule) => rule.id !== ruleId));
  }

  function toggleRule(ruleId: string) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId ? { ...rule, is_active: !rule.is_active } : rule
      )
    );
  }

  function validateForm() {
    const slugIsValid = /^[a-z0-9-]+$/.test(form.slug);

    if (!slugIsValid) {
      alert(
        "O nome do link público deve ter apenas letras minúsculas, números e hífen."
      );
      return false;
    }

    const links = [
      { label: "Instagram", value: form.instagram },
      { label: "Facebook", value: form.facebook },
      { label: "Google Maps", value: form.maps_url },
    ];

    for (const link of links) {
      if (link.value && !link.value.startsWith("https://")) {
        alert(`${link.label} precisa começar com https://`);
        return false;
      }
    }

    return true;
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    if (!activeArenaId) {
      alert("Arena não carregada. Aguarde e tente novamente.");
      return;
    }

    if (!validateForm()) return;

    setSaving(true);

    const fullWhatsapp = form.whatsapp
      ? form.whatsapp.startsWith("55")
        ? form.whatsapp
        : `55${form.whatsapp}`
      : "";

    const fullReceiptWhatsapp = deposit.receiptWhatsapp
      ? deposit.receiptWhatsapp.startsWith("55")
        ? deposit.receiptWhatsapp
        : `55${deposit.receiptWhatsapp}`
      : "";

    const { error: arenaError } = await supabase
      .from("arenas")
      .update({
        ...form,
        whatsapp: fullWhatsapp,
      })
      .eq("id", activeArenaId);

    if (arenaError) {
      setSaving(false);
      alert(arenaError.message);
      return;
    }

    const { error: hoursError } = await supabase
  .from("arena_opening_hours")
  .upsert(
    openingHours.map((hour) => ({
      arena_id: activeArenaId,
      weekday: hour.weekday,
      is_open: hour.is_open,
      open_time: hour.is_open ? hour.open_time : null,
      close_time: hour.is_open ? hour.close_time : null,
    })),
    { onConflict: "arena_id,weekday" }
  );

if (hoursError) {
  setSaving(false);
  alert(hoursError.message);
  return;
}

    for (const rule of rules) {
      await supabase
        .from("arena_rules")
        .update({
          is_active: rule.is_active,
          rule_text: rule.rule_text,
        })
        .eq("id", rule.id);
    }

   const { error: settingsError } = await supabase
  .from("arena_settings")
  .upsert(
    {
      arena_id: activeArenaId,
      require_deposit: deposit.requireDeposit,
      deposit_amount_type: deposit.depositAmountType,
      deposit_fixed_amount: deposit.depositFixedAmount || null,
      deposit_percentage: deposit.depositPercentage || null,
      pix_key: deposit.pixKey,
      pix_key_type: deposit.pixKeyType,
      pix_receiver_name: deposit.pixReceiverName,
      receipt_whatsapp: fullReceiptWhatsapp,
      deposit_message: deposit.depositMessage,
    },
    { onConflict: "arena_id" }
  );

    if (settingsError) {
      setSaving(false);
      alert(settingsError.message);
      return;
    }

    setSaving(false);
    alert("Configurações salvas com sucesso!");
  }

  function renderActiveSection() {
    if (activeTab === "visual") {
      return (
        <VisualSection
          logoUrl={form.logo_url}
          coverUrl={form.cover_url}
          gallery={gallery}
          uploading={saving}
          onLogoUpload={handleLogoUpload}
          onCoverUpload={handleCoverUpload}
          onGalleryUpload={handleGalleryUpload}
          onRemoveLogo={() => setForm({ ...form, logo_url: "" })}
          onRemoveCover={() => setForm({ ...form, cover_url: "" })}
          onDeleteGalleryImage={deleteGalleryImage}
        />
      );
    }

    if (activeTab === "info") {
      return (
        <InfoSection
          form={form}
          onChange={handleChange}
          onWhatsappChange={(value) => setForm({ ...form, whatsapp: value })}
        />
      );
    }

    if (activeTab === "hours") {
      return (
        <HoursSection
          openingHours={openingHours}
          onUpdateHour={updateHour}
          onCopyFirstHourToAll={copyFirstHourToAll}
        />
      );
    }

    if (activeTab === "rules") {
      return (
        <RulesSection
          rules={rules}
          newRule={newRule}
          onToggleRule={toggleRule}
          onDeleteRule={deleteRule}
          onNewRuleChange={setNewRule}
          onAddRule={addRule}
        />
      );
    }

    return <DepositSection deposit={deposit} onChange={handleDepositChange} />;
  }

  if (loading) {
    return <p className="text-white">Carregando configurações...</p>;
  }

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-[1500px] space-y-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-semibold text-[#22C55E]">
            Configuração pública
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-white">
            {tabTitles[activeTab].title}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            {tabTitles[activeTab].description}
          </p>
        </div>

        <button
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-5 py-3 font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:opacity-90 disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>

      {renderActiveSection()}
    </form>
  );
}

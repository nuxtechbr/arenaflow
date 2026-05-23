import { Copy, ExternalLink } from "lucide-react";

type ArenaForm = {
  name: string;
  slug: string;
  whatsapp: string;
  phone: string;
  instagram: string;
  facebook: string;
  address: string;
  maps_url: string;
  description: string;
};

type Props = {
  form: ArenaForm;
  onChange: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  onWhatsappChange: (value: string) => void;
};

export default function InfoSection({
  form,
  onChange,
  onWhatsappChange,
}: Props) {
  const publicLink = `/agendar/${form.slug || "nome-da-arena"}`;

  async function copyPublicLink() {
    await navigator.clipboard.writeText(publicLink);
    alert("Link copiado!");
  }

  return (
    <section
      id="info"
      className="scroll-mt-8 rounded-3xl border border-slate-800 bg-[#111827] p-6"
    >
      <h2 className="text-2xl font-bold text-white">Dados da Arena</h2>

      <p className="mt-1 text-sm text-slate-400">
        Essas informações aparecem no perfil público onde o cliente faz o agendamento.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <Input
          label="Nome da arena"
          helper="Nome que aparece para o cliente. Exemplo: Arena Flow Society"
          name="name"
          value={form.name}
          onChange={onChange}
        />

        <Input
          label="Nome do link público"
          helper="Use letras minúsculas, números e hífen. Exemplo: arena-flow-society"
          name="slug"
          value={form.slug}
          onChange={onChange}
        />

        <WhatsappInput value={form.whatsapp} onChange={onWhatsappChange} />

        <Input
          label="Telefone comercial"
          helper="Opcional. Exemplo: (22) 99999-9999"
          name="phone"
          value={form.phone}
          onChange={onChange}
        />

        <Input
          label="Link do Instagram"
          helper="Cole o link completo. Exemplo: https://instagram.com/suaarena"
          name="instagram"
          value={form.instagram}
          onChange={onChange}
        />

        <Input
          label="Link do Facebook"
          helper="Cole o link completo. Exemplo: https://facebook.com/suaarena"
          name="facebook"
          value={form.facebook}
          onChange={onChange}
        />

        <Input
          label="Endereço completo"
          helper="Esse endereço aparece para o cliente. Exemplo: Rua das Quadras, 123 - Centro"
          name="address"
          value={form.address}
          onChange={onChange}
        />

        <Input
          label="Link do Google Maps"
          helper="Abra sua arena no Google Maps, clique em compartilhar e cole o link aqui."
          name="maps_url"
          value={form.maps_url}
          onChange={onChange}
        />
      </div>

      <div className="mt-5">
        <Textarea
          label="Descrição curta da arena"
          helper="Texto rápido para vender melhor seu espaço. Exemplo: Quadras modernas, ambiente familiar e reservas online."
          name="description"
          value={form.description}
          onChange={onChange}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
        <p className="text-sm font-semibold text-emerald-300">
          Link público de agendamento
        </p>

        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 rounded-xl border border-emerald-500/20 bg-black/30 px-4 py-3 font-mono text-sm text-white">
            {publicLink}
          </div>

          <button
            type="button"
            onClick={copyPublicLink}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-black hover:bg-emerald-400"
          >
            <Copy size={18} />
            Copiar
          </button>

          <a
            href={publicLink}
            target="_blank"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 font-bold text-white hover:border-emerald-400 hover:text-emerald-400"
          >
            <ExternalLink size={18} />
            Ver página
          </a>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Quando o domínio oficial estiver configurado, esse link será exibido com o endereço completo do ArenaFlow.
        </p>
      </div>
    </section>
  );
}

function WhatsappInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">
        WhatsApp principal da arena
      </span>

      <div className="mt-2 flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950 focus-within:border-emerald-400">
        <span className="flex items-center border-r border-slate-700 bg-slate-900 px-4 font-bold text-emerald-400">
          +55
        </span>

        <input
          value={value}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, "").replace(/^55/, ""))
          }
          placeholder="22999999999"
          className="w-full bg-transparent p-3 text-white outline-none"
        />
      </div>

      <span className="mt-1 block text-xs text-slate-500">
        Digite apenas DDD + número. Esse WhatsApp será usado no contato com o cliente.
      </span>
    </label>
  );
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
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>

      <input
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none transition focus:border-emerald-400"
      />

      <span className="mt-1 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}

function Textarea({
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
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-200">{label}</span>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        className="mt-2 min-h-28 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none transition focus:border-emerald-400"
      />

      <span className="mt-1 block text-xs text-slate-500">{helper}</span>
    </label>
  );
}
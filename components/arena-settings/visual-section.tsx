import { ImagePlus, Trash2, Upload } from "lucide-react";

type GalleryImage = {
  id: string;
  image_url: string;
  image_order: number;
};

type Props = {
  logoUrl: string;
  coverUrl: string;
  gallery: GalleryImage[];
  uploading?: boolean;
  onLogoUpload: React.ChangeEventHandler<HTMLInputElement>;
  onCoverUpload: React.ChangeEventHandler<HTMLInputElement>;
  onGalleryUpload: React.ChangeEventHandler<HTMLInputElement>;
  onRemoveLogo: () => void;
  onRemoveCover: () => void;
  onDeleteGalleryImage: (imageId: string) => void;
};

export default function VisualSection({
  logoUrl,
  coverUrl,
  gallery,
  uploading = false,
  onLogoUpload,
  onCoverUpload,
  onGalleryUpload,
  onRemoveLogo,
  onRemoveCover,
  onDeleteGalleryImage,
}: Props) {
  return (
    <section
      id="visual"
      className="scroll-mt-8 rounded-3xl border border-slate-800 bg-[#111827] p-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">Visual da Arena</h2>

        <p className="mt-1 text-sm text-slate-400">
          Adicione a identidade visual que será exibida no link público de
          agendamento.
        </p>
      </div>

      {uploading && (
        <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-300">
          Enviando imagem, aguarde...
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
        <ImageBox
          title="Logo da arena"
          description="Use uma imagem quadrada. Ela aparece no perfil público e ajuda o cliente a reconhecer sua marca."
          imageUrl={logoUrl}
          buttonText={logoUrl ? "Trocar logo" : "Enviar logo"}
          onChange={onLogoUpload}
          onRemove={onRemoveLogo}
        />

        <ImageBox
          title="Foto de capa"
          description="Use uma imagem horizontal mostrando a arena. Essa será a primeira imagem vista pelo cliente."
          imageUrl={coverUrl}
          buttonText={coverUrl ? "Trocar capa" : "Enviar capa"}
          onChange={onCoverUpload}
          onRemove={onRemoveCover}
        />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="font-bold text-white">Galeria da arena</h3>

            <p className="text-sm text-slate-400">
              Adicione até 8 fotos para mostrar quadras, entrada, bar,
              arquibancada, estacionamento e estrutura.
            </p>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            <ImagePlus size={18} />
            Adicionar fotos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={onGalleryUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {gallery.map((image) => (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950"
            >
              <img
                src={image.image_url}
                alt="Foto da arena"
                className="h-36 w-full object-cover"
              />

              <button
                type="button"
                onClick={() => onDeleteGalleryImage(image.id)}
                className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white hover:bg-red-500"
                title="Remover foto"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          {gallery.length < 8 && (
            <label className="flex h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950 text-slate-400 hover:border-emerald-400 hover:text-emerald-400">
              <Upload size={22} />
              <span className="mt-2 text-sm">Enviar foto</span>

              <input
                type="file"
                accept="image/*"
                onChange={onGalleryUpload}
                className="hidden"
              />
            </label>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <p className="text-sm text-slate-400">
            {gallery.length}/8 fotos adicionadas. Recomendação: use fotos bem
            iluminadas, na horizontal, mostrando o espaço real da arena.
          </p>
        </div>
      </div>
    </section>
  );
}

function ImageBox({
  title,
  description,
  imageUrl,
  buttonText,
  onChange,
  onRemove,
}: {
  title: string;
  description: string;
  imageUrl: string;
  buttonText: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{description}</p>

      {imageUrl ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
          <img
            src={imageUrl}
            alt={title}
            className="h-44 w-full object-cover"
          />
        </div>
      ) : (
        <div className="mt-4 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 text-slate-500">
          <Upload size={24} />
          <span className="mt-2 text-sm">Nenhuma imagem enviada</span>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 font-semibold text-white hover:bg-slate-700">
          <Upload size={18} />
          {buttonText}
          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
          />
        </label>

        {imageUrl && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 px-4 py-3 font-semibold text-red-400 hover:bg-red-500 hover:text-white"
          >
            <Trash2 size={18} />
            Remover
          </button>
        )}
      </div>
    </div>
  );
}
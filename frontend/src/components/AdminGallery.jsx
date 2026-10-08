import { useState, useRef } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { api, formatApiError, imgSrc } from "@/lib/api";
import { toast } from "sonner";

export function AdminGallery({ items, onChange }) {
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const upload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    let ok = 0;
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name}: muito grande (máx. 8MB).`); continue; }
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("caption", caption);
        await api.post("/admin/gallery", fd);
        ok++;
      } catch (err) {
        toast.error(formatApiError(err.response?.data?.detail));
      }
    }
    setUploading(false);
    if (ok) { toast.success(`${ok} foto(s) adicionada(s) à galeria.`); setCaption(""); onChange(); }
  };

  const remove = async (item) => {
    if (!window.confirm("Remover esta foto da galeria?")) return;
    try { await api.delete(`/admin/gallery/${item.id}`); toast.success("Foto removida."); onChange(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="space-y-4" data-testid="admin-gallery-section">
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">Legenda (opcional)</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} placeholder="Ex: Degradê + barba"
            data-testid="admin-gallery-caption-input"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
        </label>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="admin-gallery-upload-btn"
          className="flex items-center justify-center gap-2 rounded-md bg-white px-5 py-2.5 font-heading font-bold uppercase text-zinc-950 hover:bg-amber-400 disabled:opacity-60">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          {uploading ? "Enviando..." : "Enviar fotos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={upload} className="hidden" data-testid="admin-gallery-file-input" />
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma foto na galeria ainda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.map((it) => (
            <div key={it.id} className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-800" data-testid="admin-gallery-item">
              <img src={imgSrc(it.url)} alt={it.caption} className="h-full w-full object-cover" />
              {it.caption && <div className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-[11px] text-zinc-200">{it.caption}</div>}
              <button onClick={() => remove(it)} data-testid="admin-gallery-delete-btn"
                className="absolute right-1.5 top-1.5 rounded-md bg-black/70 p-1.5 text-zinc-300 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

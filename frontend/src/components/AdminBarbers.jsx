import { useState, useRef } from "react";
import { Plus, Pencil, Trash2, Save, X, Camera, Loader2 } from "lucide-react";
import { api, formatApiError, imgSrc, WEEKDAY_LABELS } from "@/lib/api";
import { toast } from "sonner";
import { LOGO_URL } from "@/components/Logo";

const SLOTS = ["09:00","09:40","10:20","11:00","11:40","13:00","13:40","14:20","15:00","15:40","16:20","17:00","17:40","18:20"];
const ENDS = ["09:40","10:20","11:00","11:40","12:20","13:40","14:20","15:00","15:40","16:20","17:00","17:40","18:20","19:00"];
const EMPTY = { name: "", specialty: "", avatar: "", days: [1, 2, 3, 4, 5], start: "09:00", end: "19:00" };

export function AdminBarbers({ barbers, onChange }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleDay = (d) =>
    setForm((f) => ({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort() }));
  const startEdit = (b) => {
    setEditing(b.id);
    setForm({ name: b.name, specialty: b.specialty || "", avatar: b.avatar || "",
      days: b.days || EMPTY.days, start: b.start || "09:00", end: b.end || "19:00" });
    window.scrollTo({ top: document.getElementById("admin-barber-form")?.offsetTop - 90, behavior: "smooth" });
  };
  const cancel = () => { setEditing(null); setForm(EMPTY); };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Imagem muito grande (máx. 8MB)."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/upload-photo", fd);
      setForm((f) => ({ ...f, avatar: data.url }));
      toast.success("Foto carregada. Clique em salvar.");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) await api.put(`/admin/barbers/${editing}`, form);
      else await api.post("/admin/barbers", form);
      toast.success(editing ? "Barbeiro atualizado." : "Barbeiro adicionado.");
      cancel(); onChange();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (b) => {
    if (!window.confirm(`Remover ${b.name}?`)) return;
    try { await api.delete(`/admin/barbers/${b.id}`); toast.success("Barbeiro removido."); onChange(); }
    catch (err) { toast.error(formatApiError(err.response?.data?.detail)); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]" data-testid="admin-barbers-section">
      <div className="grid h-fit gap-3 sm:grid-cols-2">
        {barbers.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3" data-testid="admin-barber-item">
            <img src={imgSrc(b.avatar) || LOGO_URL} alt={b.name} className="h-14 w-14 rounded-md bg-black object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-heading text-lg font-bold uppercase text-white">{b.name}</div>
              <div className="truncate font-mono text-[11px] text-zinc-400">
                {(b.days || []).map((d) => WEEKDAY_LABELS[d]).join(" • ")}
              </div>
              <div className="font-mono text-[11px] text-amber-400">{b.start || "09:00"} – {b.end || "19:00"}</div>
            </div>
            <button onClick={() => startEdit(b)} data-testid="admin-barber-edit-btn" className="rounded-md p-2 text-zinc-400 hover:text-amber-400"><Pencil size={15} /></button>
            <button onClick={() => remove(b)} data-testid="admin-barber-delete-btn" className="rounded-md p-2 text-zinc-400 hover:text-red-400"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <form id="admin-barber-form" onSubmit={save} className="h-fit space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-5" data-testid="admin-barber-form">
        <h3 className="font-heading text-lg font-bold uppercase text-white">{editing ? "Editar barbeiro" : "Novo barbeiro"}</h3>

        <div className="flex items-center gap-4">
          <img src={imgSrc(form.avatar) || LOGO_URL} alt="" className="h-20 w-20 rounded-lg bg-black object-cover ring-1 ring-zinc-700" data-testid="admin-barber-photo-preview" />
          <div className="space-y-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="admin-barber-photo-btn"
              className="flex items-center gap-2 rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-amber-400 disabled:opacity-60">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {uploading ? "Enviando..." : "Enviar foto"}
            </button>
            {form.avatar && (
              <button type="button" onClick={() => setForm({ ...form, avatar: "" })} className="block text-xs text-zinc-500 hover:text-red-400">Remover foto</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} className="hidden" data-testid="admin-barber-photo-input" />
        </div>

        <Input label="Nome" value={form.name} onChange={set("name")} testid="admin-barber-name-input" required />
        <Input label="Especialidade" value={form.specialty} onChange={set("specialty")} testid="admin-barber-specialty-input" />

        <div>
          <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">Dias de atendimento</span>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(WEEKDAY_LABELS).map(([d, label]) => {
              const on = form.days.includes(Number(d));
              return (
                <button type="button" key={d} onClick={() => toggleDay(Number(d))} data-testid={`admin-barber-day-${label}`}
                  className={`rounded-md border px-3 py-1.5 font-mono text-xs uppercase transition ${on ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-700 text-zinc-400 hover:border-zinc-500"}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Início" value={form.start} onChange={set("start")} options={SLOTS} testid="admin-barber-start-select" />
          <Select label="Fim" value={form.end} onChange={set("end")} options={ENDS} testid="admin-barber-end-select" />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={saving || uploading} data-testid="admin-barber-save-btn"
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-white py-2.5 font-heading font-bold uppercase text-zinc-950 hover:bg-amber-400 disabled:opacity-60">
            {editing ? <><Save size={15} /> Salvar</> : <><Plus size={15} /> Adicionar</>}
          </button>
          {editing && (
            <button type="button" onClick={cancel} data-testid="admin-barber-cancel-edit-btn" className="rounded-md border border-zinc-700 px-3 text-zinc-300"><X size={15} /></button>
          )}
        </div>
      </form>
    </div>
  );
}

const fieldCls = "w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400";

function Input({ label, testid, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input {...props} data-testid={testid} className={fieldCls} />
    </label>
  );
}

function Select({ label, testid, options, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <select {...props} data-testid={testid} className={fieldCls}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

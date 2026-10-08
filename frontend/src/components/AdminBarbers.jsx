import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { LOGO_URL } from "@/components/Logo";

const EMPTY = { name: "", specialty: "", avatar: "" };

export function AdminBarbers({ barbers, onChange }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const startEdit = (b) => { setEditing(b.id); setForm({ name: b.name, specialty: b.specialty || "", avatar: b.avatar || "" }); };
  const cancel = () => { setEditing(null); setForm(EMPTY); };

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
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]" data-testid="admin-barbers-section">
      <div className="grid gap-3 sm:grid-cols-2">
        {barbers.map((b) => (
          <div key={b.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3" data-testid="admin-barber-item">
            <img src={b.avatar || LOGO_URL} alt={b.name} className="h-14 w-14 rounded-md bg-black object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-heading text-lg font-bold uppercase text-white">{b.name}</div>
              <div className="truncate text-xs text-zinc-400">{b.specialty}</div>
            </div>
            <button onClick={() => startEdit(b)} data-testid="admin-barber-edit-btn" className="rounded-md p-2 text-zinc-400 hover:text-amber-400"><Pencil size={15} /></button>
            <button onClick={() => remove(b)} data-testid="admin-barber-delete-btn" className="rounded-md p-2 text-zinc-400 hover:text-red-400"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <form onSubmit={save} className="h-fit space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-5" data-testid="admin-barber-form">
        <h3 className="font-heading text-lg font-bold uppercase text-white">{editing ? "Editar barbeiro" : "Novo barbeiro"}</h3>
        <Input label="Nome" value={form.name} onChange={set("name")} testid="admin-barber-name-input" required />
        <Input label="Especialidade" value={form.specialty} onChange={set("specialty")} testid="admin-barber-specialty-input" />
        <Input label="URL da foto (opcional)" value={form.avatar} onChange={set("avatar")} testid="admin-barber-avatar-input" placeholder="https://..." />
        <div className="flex gap-2">
          <button type="submit" disabled={saving} data-testid="admin-barber-save-btn"
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

function Input({ label, testid, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input {...props} data-testid={testid}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
    </label>
  );
}

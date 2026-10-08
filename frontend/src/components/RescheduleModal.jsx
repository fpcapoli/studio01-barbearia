import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function RescheduleModal({ apt, onClose, onDone }) {
  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 21; i++) {
      const d = new Date(); d.setDate(d.getDate() + i);
      if ([2, 3, 4, 5, 6].includes(d.getDay())) out.push(d);
    }
    return out;
  }, []);
  const [date, setDate] = useState(null);
  const [slots, setSlots] = useState(null);
  const [time, setTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true); setTime(null);
    api.get("/availability", { params: { date, barber_id: apt.barber_id } })
      .then((r) => setSlots(r.data))
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)))
      .finally(() => setLoading(false));
  }, [date, apt.barber_id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/appointments/${apt.id}/reschedule`, { date, time });
      toast.success(`Reagendado para ${date} às ${time}.`);
      onDone();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-6" data-testid="reschedule-modal">
          <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white" data-testid="reschedule-close-btn"><X size={20} /></button>
          <h2 className="font-heading text-2xl font-extrabold uppercase text-white">Reagendar horário</h2>
          <p className="mt-1 text-sm text-zinc-400">Atual: {apt.date} às {apt.time} • {apt.barber_name}</p>

          <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const key = ymd(d); const on = date === key;
              return (
                <button key={key} onClick={() => setDate(key)} data-testid="reschedule-day-btn"
                  className={`flex min-w-[58px] flex-col items-center rounded-lg border px-2 py-2 transition ${on ? "border-amber-400 bg-amber-400/10 text-white" : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-600"}`}>
                  <span className="font-mono text-[10px] uppercase text-zinc-500">{WEEKDAYS[d.getDay()]}</span>
                  <span className="font-heading text-lg font-bold">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          {date && (
            <div className="mt-4">
              {loading ? (
                <div className="flex items-center gap-2 text-zinc-500"><Loader2 className="animate-spin" size={16} /> Carregando...</div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {slots?.slots.map((s) => {
                    const current = date === apt.date && s.time === apt.time;
                    const avail = s.status === "available" && !current;
                    const on = time === s.time;
                    return (
                      <button key={s.time} disabled={!avail} onClick={() => setTime(s.time)} data-testid="reschedule-slot-btn"
                        className={`rounded-md border py-2 font-mono text-sm transition ${on ? "border-amber-400 bg-amber-400 text-black" : avail ? "border-zinc-700 bg-zinc-950 text-white hover:border-amber-400" : "cursor-not-allowed border-zinc-900 bg-zinc-950 text-zinc-700 line-through"}`}>
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button onClick={save} disabled={!date || !time || saving} data-testid="reschedule-confirm-btn"
            className="mt-6 w-full rounded-md bg-white py-3 font-heading font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40">
            {saving ? "Salvando..." : "Confirmar novo horário"}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

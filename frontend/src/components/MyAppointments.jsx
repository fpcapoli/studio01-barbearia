import { useState, useEffect, useCallback } from "react";
import { MessageCircle, X, Clock, Calendar } from "lucide-react";
import { api, BRL, formatApiError } from "@/lib/api";
import { toast } from "sonner";

const STATUS_STYLE = {
  confirmado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  pendente: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  concluido: "border-sky-500/40 bg-sky-500/10 text-sky-400",
  cancelado: "border-red-500/40 bg-red-500/10 text-red-400",
};

export function MyAppointments() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/appointments/me");
      setList(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id) => {
    try {
      await api.patch(`/appointments/${id}/cancel`);
      toast.success("Agendamento cancelado.");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (loading) return <p className="text-zinc-500">Carregando...</p>;
  if (!list.length) return (
    <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-zinc-400">
      Você ainda não tem agendamentos. Marque seu horário acima!
    </div>
  );

  return (
    <div className="grid gap-3 md:grid-cols-2" data-testid="my-appointments-list">
      {list.map((a) => (
        <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Protocolo {a.protocol}</div>
              <h3 className="font-heading text-xl font-bold uppercase text-white">{a.services.map((s) => s.name).join(", ")}</h3>
            </div>
            <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase ${STATUS_STYLE[a.status] || ""}`}>{a.status}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
            <span className="flex items-center gap-1.5"><Calendar size={13} /> {a.date}</span>
            <span className="flex items-center gap-1.5"><Clock size={13} /> {a.time}</span>
            <span>• {a.barber_name}</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-zinc-800 pt-4">
            <span className="font-mono text-lg font-bold text-amber-400">{BRL(a.total_price)}</span>
            {a.status === "confirmado" && (
              <button onClick={() => cancel(a.id)} data-testid="cancel-appointment-btn"
                className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-red-500 hover:text-red-400">
                <X size={13} /> Cancelar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

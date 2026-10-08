import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp, Users, DollarSign, Ban, Check, X, CheckCircle2, Lock } from "lucide-react";
import { api, BRL, formatApiError, worksOn } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { AuthModal } from "@/components/AuthModal";
import { AdminBarbers } from "@/components/AdminBarbers";
import { toast } from "sonner";

const SLOTS = ["09:00","09:40","10:20","11:00","11:40","13:00","13:40","14:20","15:00","15:40","16:20","17:00","17:40","18:20"];
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export default function Admin() {
  const { user, checked } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(ymd(new Date()));
  const [appointments, setAppointments] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [metrics, setMetrics] = useState({ total: 0, revenue: 0, active: 0, occupancy: 0 });
  const [authOpen, setAuthOpen] = useState(false);

  const isAdmin = user && user.role === "admin";

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [a, b, bl, m] = await Promise.all([
        api.get("/admin/appointments", { params: { date } }),
        api.get("/barbers"),
        api.get("/admin/blocks", { params: { date } }),
        api.get("/admin/metrics", { params: { date } }),
      ]);
      setAppointments(a.data); setBarbers(b.data); setBlocks(bl.data); setMetrics(m.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  }, [date, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try { await api.patch(`/admin/appointments/${id}/status`, { status }); toast.success("Atualizado."); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const toggleBlock = async (barber_id, time) => {
    try { await api.post("/admin/blocks", { barber_id, date, time }); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  const isBlocked = (bid, t) => blocks.some((b) => b.barber_id === bid && b.time === t);
  const aptAt = (bid, t) => appointments.find((a) => a.barber_id === bid && a.time === t && a.status !== "cancelado");
  const toMin = (s) => { const [h, m] = s.split(":"); return +h * 60 + +m; };
  const worksAt = (b, t) => {
    const jsDay = new Date(`${date}T12:00:00`).getDay();
    return worksOn(b, jsDay) && toMin(b.start || "09:00") <= toMin(t) && toMin(t) + 40 <= toMin(b.end || "19:00");
  };

  if (!checked) return <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">Carregando...</div>;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-5 text-center">
        <Lock size={34} className="text-amber-400" />
        <h1 className="font-heading text-3xl font-extrabold uppercase text-white">Área Administrativa</h1>
        <p className="max-w-sm text-zinc-400">Acesso restrito ao administrador da Studio01 Barbearia. Entre com a conta de administrador.</p>
        <div className="flex gap-3">
          <button onClick={() => setAuthOpen(true)} data-testid="admin-login-open-btn" className="rounded-md bg-white px-5 py-2.5 font-heading font-bold uppercase text-zinc-950 hover:bg-amber-400">Entrar como Admin</button>
          <button onClick={() => navigate("/")} className="rounded-md border border-zinc-700 px-5 py-2.5 font-heading font-bold uppercase text-white">Voltar ao site</button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => {}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="rounded-md p-2 text-zinc-400 hover:text-white"><ArrowLeft size={18} /></button>
            <Logo showText={false} />
            <div>
              <div className="font-heading text-lg font-extrabold uppercase text-white">Painel Admin</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Studio01 Barbearia</div>
            </div>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="admin-date-input"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white" />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8">
        {/* metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Users size={18} />} label="Agendamentos ativos" value={metrics.active} />
          <Metric icon={<DollarSign size={18} />} label="Faturamento previsto" value={BRL(metrics.revenue)} accent />
          <Metric icon={<TrendingUp size={18} />} label="Taxa de ocupação" value={`${metrics.occupancy}%`} />
          <Metric icon={<Check size={18} />} label="Total do dia" value={metrics.total} />
        </div>

        {/* grid per barber */}
        <h2 className="mb-4 mt-10 font-heading text-2xl font-extrabold uppercase text-white">Grade de Horários</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-zinc-900">
                <th className="sticky left-0 z-10 bg-zinc-900 p-3 text-left font-mono text-xs uppercase text-zinc-500">Horário</th>
                {barbers.map((b) => (
                  <th key={b.id} className="min-w-[180px] p-3 text-left font-heading text-sm font-bold uppercase text-white">{b.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((t) => (
                <tr key={t} className="border-t border-zinc-800">
                  <td className="sticky left-0 z-10 bg-zinc-950 p-3 font-mono text-zinc-400">{t}</td>
                  {barbers.map((b) => {
                    const apt = aptAt(b.id, t);
                    const blocked = isBlocked(b.id, t);
                    return (
                      <td key={b.id} className="p-2">
                        {apt ? (
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
                            <div className="truncate font-semibold text-white">{apt.client_name}</div>
                            <div className="truncate font-mono text-[10px] text-zinc-400">{apt.services.map((s)=>s.name).join(", ")}</div>
                            <div className="mt-1.5 flex gap-1">
                              <button onClick={() => setStatus(apt.id, "concluido")} data-testid="admin-appointment-confirm-btn" title="Concluir" className="rounded bg-sky-600/80 p-1 hover:bg-sky-600"><CheckCircle2 size={13} /></button>
                              <button onClick={() => setStatus(apt.id, "cancelado")} data-testid="admin-appointment-cancel-btn" title="Cancelar" className="rounded bg-red-600/80 p-1 hover:bg-red-600"><X size={13} /></button>
                            </div>
                          </div>
                        ) : !worksAt(b, t) ? (
                          <div className="flex w-full items-center justify-center rounded-md border border-dashed border-zinc-900 py-2 font-mono text-[11px] uppercase text-zinc-700" data-testid="admin-slot-off">
                            Folga
                          </div>
                        ) : (
                          <button onClick={() => toggleBlock(b.id, t)} data-testid="admin-slot-block-toggle-btn"
                            className={`flex w-full items-center justify-center gap-1 rounded-md border py-2 font-mono text-[11px] uppercase transition ${
                              blocked ? "border-red-500/40 bg-red-500/10 text-red-400" : "border-zinc-800 bg-zinc-900 text-zinc-500 hover:border-amber-400/50 hover:text-amber-400"
                            }`}>
                            {blocked ? <><Ban size={11} /> Bloqueado</> : "Livre"}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* barbers management */}
        <h2 className="mb-4 mt-10 font-heading text-2xl font-extrabold uppercase text-white">Barbeiros</h2>
        <AdminBarbers barbers={barbers} onChange={load} />

        {/* appointment list */}
        <h2 className="mb-4 mt-10 font-heading text-2xl font-extrabold uppercase text-white">Agendamentos do dia</h2>
        {appointments.length === 0 ? (
          <p className="text-zinc-500">Nenhum agendamento nesta data.</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-lg font-bold text-amber-400">{a.time}</span>
                  <div>
                    <div className="font-semibold text-white">{a.client_name} <span className="font-mono text-xs text-zinc-500">• {a.client_phone}</span></div>
                    <div className="text-xs text-zinc-400">{a.services.map((s)=>s.name).join(", ")} • {a.barber_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-zinc-300">{BRL(a.total_price)}</span>
                  <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 font-mono text-[10px] uppercase text-zinc-400">{a.status}</span>
                  {a.status !== "cancelado" && (
                    <button onClick={() => setStatus(a.id, "cancelado")} className="rounded-md border border-zinc-700 p-1.5 text-zinc-400 hover:border-red-500 hover:text-red-400"><X size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Metric({ icon, label, value, accent }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-2 flex items-center gap-2 text-zinc-500">{icon}<span className="font-mono text-[10px] uppercase tracking-widest">{label}</span></div>
      <div className={`font-heading text-3xl font-black ${accent ? "text-amber-400" : "text-white"}`}>{value}</div>
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Calendar as CalIcon, User, MessageCircle, Loader2, PartyPopper } from "lucide-react";
import { api, BRL, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const SHOP_PHONE = "5511999999999"; // WhatsApp da barbearia

function nextDays(count = 21) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const nd = new Date(d);
    nd.setDate(d.getDate() + i);
    out.push(nd);
  }
  return out;
}
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function BookingWidget({ services, barbers, onRequireAuth }) {
  const { user } = useAuth();
  const [selected, setSelected] = useState([]);
  const [barberId, setBarberId] = useState("any");
  const [date, setDate] = useState(null);
  const [slotsData, setSlotsData] = useState(null);
  const [time, setTime] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  const days = useMemo(() => nextDays(21).filter((d) => [2, 3, 4].includes(d.getDay())), []);
  const total = selected.reduce((s, id) => s + (services.find((x) => x.id === id)?.price || 0), 0);
  const duration = selected.reduce((s, id) => s + (services.find((x) => x.id === id)?.duration || 0), 0);

  const toggleService = (id) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const loadSlots = useCallback(async () => {
    if (!date) return;
    setLoadingSlots(true); setTime(null);
    try {
      const { data } = await api.get("/availability", { params: { date, barber_id: barberId } });
      setSlotsData(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoadingSlots(false);
    }
  }, [date, barberId]);

  useEffect(() => { loadSlots(); }, [loadSlots]);
  // auto-refresh grid every 20s so slots update live
  useEffect(() => {
    if (!date) return;
    const t = setInterval(loadSlots, 20000);
    return () => clearInterval(t);
  }, [date, loadSlots]);

  const submit = async () => {
    if (!user) { onRequireAuth(); return; }
    if (!selected.length || !date || !time) {
      toast.error("Escolha serviço, data e horário.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/appointments", {
        barber_id: barberId, date, time, service_ids: selected,
      });
      setConfirmed(data);
      toast.success("Agendamento confirmado!");
      loadSlots();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setConfirmed(null); setSelected([]); setTime(null); setDate(null); setSlotsData(null); setBarberId("any");
  };

  const whatsappLink = (apt) => {
    const sv = apt.services.map((s) => s.name).join(", ");
    const msg = `Olá! Confirmei meu agendamento na Studio01 Barbearia.%0A%0A*Protocolo:* ${apt.protocol}%0A*Serviços:* ${sv}%0A*Barbeiro:* ${apt.barber_name}%0A*Data:* ${apt.date} às ${apt.time}%0A*Total:* ${BRL(apt.total_price)}`;
    return `https://wa.me/${SHOP_PHONE}?text=${msg}`;
  };

  if (confirmed) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-amber-400/40 bg-zinc-900 p-8 text-center"
        data-testid="booking-confirmation"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/15 text-amber-400">
          <PartyPopper size={26} />
        </div>
        <h3 className="font-heading text-3xl font-extrabold uppercase text-white">Agendado!</h3>
        <p className="mt-1 font-mono text-xs uppercase tracking-widest text-amber-400">Protocolo {confirmed.protocol}</p>
        <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-5 text-left text-sm">
          <Row label="Serviços" value={confirmed.services.map((s) => s.name).join(", ")} />
          <Row label="Barbeiro" value={confirmed.barber_name} />
          <Row label="Data / Hora" value={`${confirmed.date} • ${confirmed.time}`} />
          <Row label="Duração" value={`${confirmed.duration} min`} />
          <Row label="Total" value={BRL(confirmed.total_price)} highlight />
        </div>
        <a
          href={whatsappLink(confirmed)} target="_blank" rel="noreferrer"
          data-testid="whatsapp-confirm-link"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-6 py-3 font-heading text-base font-bold uppercase tracking-wide text-black transition hover:brightness-110"
        >
          <MessageCircle size={18} /> Confirmar no WhatsApp
        </a>
        <button onClick={reset} className="mt-4 block w-full text-sm text-zinc-400 hover:text-white" data-testid="booking-new-btn">
          Fazer outro agendamento
        </button>
      </motion.div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        {/* Step 1 services */}
        <Step n={1} title="Escolha os serviços">
          <div className="grid gap-2 sm:grid-cols-2">
            {services.map((s) => {
              const on = selected.includes(s.id);
              return (
                <button
                  key={s.id} onClick={() => toggleService(s.id)}
                  data-testid="service-card-select-btn"
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    on ? "border-amber-400 bg-amber-400/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                  }`}
                >
                  <div>
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="font-mono text-xs text-zinc-500">
                      {s.starting_at ? "a partir de " : ""}{BRL(s.price)} • {s.duration}min
                    </div>
                  </div>
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${on ? "border-amber-400 bg-amber-400 text-black" : "border-zinc-600"}`}>
                    {on && <Check size={14} />}
                  </span>
                </button>
              );
            })}
          </div>
        </Step>

        {/* Step 2 barber */}
        <Step n={2} title="Escolha o barbeiro">
          <div className="flex flex-wrap gap-2">
            <BarberChip active={barberId === "any"} onClick={() => setBarberId("any")} name="Primeiro Disponível" testid="barber-card-select-btn" />
            {barbers.map((b) => (
              <BarberChip key={b.id} active={barberId === b.id} onClick={() => setBarberId(b.id)} name={b.name} avatar={b.avatar} testid="barber-card-select-btn" />
            ))}
          </div>
        </Step>

        {/* Step 3 date */}
        <Step n={3} title="Escolha a data">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {days.map((d) => {
              const key = ymd(d);
              const on = date === key;
              return (
                <button
                  key={key} onClick={() => setDate(key)}
                  data-testid="booking-calendar-day"
                  className={`flex min-w-[64px] flex-col items-center rounded-lg border px-3 py-2 transition ${
                    on ? "border-amber-400 bg-amber-400/10 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{WEEKDAYS[d.getDay()]}</span>
                  <span className="font-heading text-xl font-bold">{d.getDate()}</span>
                  <span className="font-mono text-[10px] text-zinc-500">{String(d.getMonth() + 1).padStart(2, "0")}</span>
                </button>
              );
            })}
          </div>
        </Step>

        {/* Step 4 slots */}
        {date && (
          <Step n={4} title="Horário disponível">
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-zinc-500"><Loader2 className="animate-spin" size={16} /> Atualizando grade...</div>
            ) : slotsData && !slotsData.open ? (
              <p className="text-sm text-red-400">{slotsData.message}</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  <AnimatePresence>
                    {slotsData?.slots.map((s) => {
                      const avail = s.status === "available";
                      const on = time === s.time;
                      return (
                        <motion.button
                          layout key={s.time}
                          disabled={!avail}
                          onClick={() => setTime(s.time)}
                          data-testid="time-slot-btn"
                          className={`rounded-md border py-2 font-mono text-sm transition ${
                            on ? "border-amber-400 bg-amber-400 text-black"
                            : avail ? "border-zinc-700 bg-zinc-900 text-white hover:border-amber-400"
                            : "cursor-not-allowed border-zinc-900 bg-zinc-950 text-zinc-700 line-through"
                          }`}
                          title={!avail ? (s.status === "past" ? "Encerrado" : s.status === "blocked" ? "Bloqueado" : "Ocupado") : ""}
                        >
                          {s.time}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <p className="mt-3 font-mono text-[11px] text-zinc-600">
                  A grade se atualiza automaticamente • dias de pico após 19:00: ordem de chegada no balcão.
                </p>
              </>
            )}
          </Step>
        )}
      </div>

      {/* Summary sidebar */}
      <div className="h-fit lg:sticky lg:top-24">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="font-heading text-xl font-bold uppercase text-white">Resumo</h3>
          <div className="mt-4 space-y-2 text-sm">
            <SummaryRow icon={<User size={14} />} label="Barbeiro" value={barberId === "any" ? "Primeiro Disponível" : barbers.find((b) => b.id === barberId)?.name} />
            <SummaryRow icon={<CalIcon size={14} />} label="Data" value={date || "—"} />
            <SummaryRow icon={<Clock size={14} />} label="Hora" value={time || "—"} />
          </div>
          <div className="my-4 dotted-rule" />
          <div className="space-y-1 text-sm">
            {selected.length === 0 && <p className="text-zinc-500">Nenhum serviço selecionado.</p>}
            {selected.map((id) => {
              const s = services.find((x) => x.id === id);
              return (
                <div key={id} className="flex justify-between text-zinc-300">
                  <span>{s.name}</span><span className="font-mono">{BRL(s.price)}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-zinc-800 pt-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total</div>
              <div className="font-heading text-3xl font-black text-amber-400" data-testid="booking-summary-total-price">{BRL(total)}</div>
            </div>
            <div className="text-right font-mono text-xs text-zinc-500">{duration} min</div>
          </div>
          <button
            onClick={submit} disabled={submitting}
            data-testid="booking-submit-btn"
            className="mt-5 w-full rounded-md bg-white py-3 font-heading text-base font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {submitting ? "Agendando..." : user ? "Confirmar agendamento" : "Entrar para agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value, highlight }) => (
  <div className="flex justify-between">
    <span className="text-zinc-500">{label}</span>
    <span className={highlight ? "font-mono font-bold text-amber-400" : "font-medium text-white"}>{value}</span>
  </div>
);

const SummaryRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-2 text-zinc-500">{icon}{label}</span>
    <span className="font-medium text-white">{value}</span>
  </div>
);

function Step({ n, title, children }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-400/50 font-mono text-sm font-bold text-amber-400">{n}</span>
        <h3 className="font-heading text-xl font-bold uppercase tracking-tight text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function BarberChip({ active, onClick, name, avatar, testid }) {
  return (
    <button
      onClick={onClick} data-testid={testid}
      className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-sm transition ${
        active ? "border-amber-400 bg-amber-400/10 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="h-7 w-7 rounded-full object-cover" />
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800"><User size={14} /></span>
      )}
      {name}
    </button>
  );
}

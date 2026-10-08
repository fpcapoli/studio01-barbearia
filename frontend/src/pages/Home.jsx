import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scissors, MapPin, Clock, ShieldCheck, MessageCircle, LogOut, CalendarCheck, Menu, X } from "lucide-react";
import { api, BRL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo, LOGO_URL } from "@/components/Logo";
import { AuthModal } from "@/components/AuthModal";
import { BookingWidget } from "@/components/BookingWidget";
import { MyAppointments } from "@/components/MyAppointments";
import { useNavigate } from "react-router-dom";


export default function Home() {
  const { user, logout } = useAuth();
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/services").then((r) => setServices(r.data));
    api.get("/barbers").then((r) => setBarbers(r.data));
  }, []);

  const go = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); };

  const navItems = [
    ["servicos", "Serviços"],
    ["agendar", "Agendar"],
    ["barbeiros", "Barbeiros"],
    ["meus-agendamentos", "Meus Agendamentos"],
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* NAV */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><Logo /></button>
          <nav className="hidden items-center gap-7 lg:flex">
            {navItems.map(([id, label]) => (
              <button key={id} onClick={() => go(id)} data-testid={`nav-${id}-link`}
                className="font-mono text-xs uppercase tracking-wider text-zinc-400 transition hover:text-amber-400">
                {label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-zinc-400 sm:inline">Olá, {user.name.split(" ")[0]}</span>
                {user.role === "admin" && (
                  <button onClick={() => navigate("/admin")} data-testid="nav-admin-link"
                    className="rounded-md border border-amber-400/50 px-3 py-1.5 font-mono text-xs uppercase text-amber-400 hover:bg-amber-400/10">
                    Admin
                  </button>
                )}
                <button onClick={logout} data-testid="nav-logout-btn" className="rounded-md p-2 text-zinc-400 hover:text-white"><LogOut size={18} /></button>
              </>
            ) : (
              <button onClick={() => setAuthOpen(true)} data-testid="nav-login-btn"
                className="rounded-md bg-white px-4 py-1.5 font-heading text-sm font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-400">
                Entrar
              </button>
            )}
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-1 text-zinc-300 lg:hidden">
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="border-t border-zinc-800 bg-zinc-950 px-5 py-3 lg:hidden">
            {navItems.map(([id, label]) => (
              <button key={id} onClick={() => go(id)} className="block w-full py-2 text-left font-mono text-sm uppercase text-zinc-300">{label}</button>
            ))}
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-black pt-20">
        <div className="absolute inset-0">
          <img src={LOGO_URL} alt="Studio01 Barbearia" data-testid="hero-logo-bg"
            style={{ maskImage: "radial-gradient(ellipse at center, black 50%, transparent 78%)", WebkitMaskImage: "radial-gradient(ellipse at center, black 50%, transparent 78%)" }}
            className="absolute left-1/2 top-1/2 w-[180%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-30 lg:left-[30%] lg:w-[70%] lg:translate-x-0 lg:opacity-100" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent lg:via-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>
        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 lg:grid-cols-2">
          <div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.25em] text-amber-400">
                <MapPin size={13} /> Barbearia • Brasil
              </div>
              <h1 className="font-heading text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Seu corte,<br />no seu <span className="text-amber-400">horário</span>.
              </h1>
              <p className="mt-6 max-w-md text-base text-zinc-300">
                Escolha o serviço, o barbeiro e o horário direto pelo site. Grade de horários que se atualiza automaticamente, sem telefone, sem espera.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button onClick={() => go("agendar")} data-testid="hero-book-btn"
                  className="rounded-md bg-amber-400 px-7 py-3.5 font-heading text-base font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-300">
                  Agendar agora
                </button>
                <button onClick={() => go("servicos")}
                  className="rounded-md border border-zinc-700 px-7 py-3.5 font-heading text-base font-bold uppercase tracking-wide text-white transition hover:border-amber-400">
                  Ver preços
                </button>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 font-mono text-xs text-zinc-400">
                <span className="flex items-center gap-2"><Clock size={14} className="text-amber-400" /> Ter a Sáb • 09h–19h</span>
                <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-amber-400" /> CNPJ 62.773.547/0001-87</span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="servicos" className="relative border-t border-zinc-900 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead eyebrow="Tabela de Preços" title="Serviços & Valores" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.05 }}
                className="group flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-amber-400/50 hover:bg-zinc-900"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{s.category}</div>
                  <div className="font-heading text-xl font-bold uppercase text-white">{s.name}</div>
                  <div className="font-mono text-xs text-zinc-500">{s.duration} min</div>
                </div>
                <div className="text-right">
                  {s.starting_at && <div className="font-mono text-[9px] uppercase text-zinc-600">a partir de</div>}
                  <div className="font-mono text-xl font-bold text-amber-400">{BRL(s.price)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* BOOKING */}
      <section id="agendar" className="relative border-t border-zinc-900 bg-zinc-950 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead eyebrow="Agende Online" title="Marque seu horário" />
          <BookingWidget services={services} barbers={barbers} onRequireAuth={() => setAuthOpen(true)} />
        </div>
      </section>

      {/* BARBERS */}
      <section id="barbeiros" className="relative border-t border-zinc-900 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead eyebrow="A Equipe" title="Nossos Barbeiros" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {barbers.map((b) => (
              <div key={b.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={b.avatar} alt={b.name} className="h-full w-full object-cover grayscale transition duration-500 hover:grayscale-0" />
                </div>
                <div className="p-5">
                  <h3 className="font-heading text-xl font-bold uppercase text-white">{b.name}</h3>
                  <p className="mt-1 text-sm text-zinc-400">{b.specialty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MY APPOINTMENTS */}
      <section id="meus-agendamentos" className="relative border-t border-zinc-900 bg-zinc-950 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead eyebrow="Área do Cliente" title="Meus Agendamentos" />
          {user ? (
            <MyAppointments />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
              <CalendarCheck size={32} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-zinc-400">Entre na sua conta para ver seus agendamentos.</p>
              <button onClick={() => setAuthOpen(true)} className="mt-4 rounded-md bg-white px-5 py-2.5 font-heading font-bold uppercase text-zinc-950 hover:bg-amber-400">Entrar</button>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 text-center">
          <Logo />
          <div className="my-2 h-[5px] w-40 dotted-rule" />
          <p className="font-mono text-xs text-zinc-500">Ter a Sáb • 09:00 às 19:00 • CNPJ 62.773.547/0001-87</p>
          <a href="https://wa.me/5521972016917" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-[#25D366] hover:text-[#25D366]">
            <MessageCircle size={16} /> Fale no WhatsApp
          </a>
          <p className="mt-4 font-mono text-[11px] text-zinc-700">© {new Date().getFullYear()} Studio01 Barbearia</p>
        </div>
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => go("agendar")} />
    </div>
  );
}

function SectionHead({ eyebrow, title }) {
  return (
    <div className="mb-10">
      <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-amber-400">
        <Scissors size={14} /> {eyebrow}
      </div>
      <h2 className="font-heading text-4xl font-extrabold uppercase tracking-tight text-white lg:text-5xl">{title}</h2>
    </div>
  );
}

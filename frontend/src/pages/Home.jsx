import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scissors, MapPin, Clock, ShieldCheck, MessageCircle, LogOut, CalendarCheck, Menu, X, Lock, Instagram } from "lucide-react";
import { api, BRL, imgSrc } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo, LOGO_URL } from "@/components/Logo";
import { AuthModal } from "@/components/AuthModal";
import { BookingWidget } from "@/components/BookingWidget";
import { MyAppointments } from "@/components/MyAppointments";
import { Gallery } from "@/components/Gallery";

const INSTAGRAM = "https://www.instagram.com/studio01barber/";
import { useNavigate } from "react-router-dom";


export default function Home() {
  const { user, logout } = useAuth();
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/services").then((r) => setServices(r.data));
    api.get("/barbers").then((r) => setBarbers(r.data));
    api.get("/gallery").then((r) => setGallery(r.data));
  }, []);

  const go = (id) => { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); setMenuOpen(false); };

  const navItems = [
    ["servicos", "Serviços"],
    ["agendar", "Agendar"],
    ["galeria", "Galeria"],
    ["barbeiros", "Barbeiros"],
    ["meus-agendamentos", "Meus Agendamentos"],
    ["localizacao", "Localização"],
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
            {(!user || user.role === "admin") && (
              <button onClick={() => navigate("/admin")} data-testid="nav-admin-link"
                className="flex items-center gap-1.5 rounded-md border border-amber-400/50 px-3 py-1.5 font-mono text-xs uppercase text-amber-400 hover:bg-amber-400/10">
                <Lock size={12} /> <span className="hidden sm:inline">Painel Admin</span>
              </button>
            )}
            {user ? (
              <>
                <span className="hidden text-sm text-zinc-400 sm:inline">Olá, {user.name.split(" ")[0]}</span>
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
            <button onClick={() => navigate("/admin")} className="block w-full py-2 text-left font-mono text-sm uppercase text-amber-400">Painel Admin</button>
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
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-4 py-1.5 font-mono text-[11px] uppercase tracking-wider text-amber-400 sm:tracking-[0.25em]" data-testid="hero-address">
                <MapPin size={13} /> Rua Guará, 10 • Penha Circular – RJ
              </div>
              <h1 className="font-heading text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-6xl lg:text-7xl">
                Bem-vindo ao<br /><span className="text-amber-400">Studio 01</span>!
              </h1>
              <p className="mt-6 max-w-md font-heading text-2xl font-bold uppercase text-white" data-testid="hero-welcome-text">
                Como podemos renovar seu visual hoje?
              </p>
              <p className="mt-3 max-w-md border-l-2 border-amber-400 pl-3 text-sm text-zinc-400" data-testid="hero-delay-note">
                Às vezes pode atrasar um pouquinho, porque cada cliente recebe o tempo que merece. Mas nem tanto, fica tranquilo.
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
                <a href={INSTAGRAM} target="_blank" rel="noreferrer" data-testid="hero-instagram-link"
                  className="flex items-center gap-2 transition hover:text-amber-400"><Instagram size={14} className="text-amber-400" /> @studio01barber</a>
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

      {/* GALLERY */}
      <section id="galeria" className="relative border-t border-zinc-900 bg-zinc-950 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead eyebrow="Nosso Trabalho" title="Galeria de Cortes" />
          <Gallery items={gallery} />
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
                  <img src={imgSrc(b.avatar) || LOGO_URL} alt={b.name} className={`h-full w-full transition duration-500 ${b.avatar ? "object-cover grayscale hover:grayscale-0" : "object-contain bg-black"}`} />
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

      {/* LOCATION */}
      <section id="localizacao" className="relative border-t border-zinc-900 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <SectionHead eyebrow="Como Chegar" title="Localização" />
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <iframe
                title="Mapa Studio01 Barbearia" data-testid="location-map"
                src="https://www.google.com/maps?q=Rua+Guar%C3%A1,+10+-+Penha+Circular,+Rio+de+Janeiro+-+RJ&output=embed"
                className="h-[360px] w-full grayscale invert-[0.9] hue-rotate-180 contrast-[0.9]"
                loading="lazy" referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="h-fit space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Endereço</div>
                <div className="mt-1 font-heading text-2xl font-bold uppercase text-white">Rua Guará, 10</div>
                <div className="text-zinc-400">Penha Circular, Rio de Janeiro – RJ</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Horário</div>
                <div className="text-zinc-200">Terça a Sábado • 09:00 às 19:00</div>
              </div>
              <a href="https://www.google.com/maps/dir/?api=1&destination=Rua+Guar%C3%A1+10+Penha+Circular+Rio+de+Janeiro+RJ"
                target="_blank" rel="noreferrer" data-testid="location-directions-btn"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-amber-400 py-3 font-heading font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-300">
                <MapPin size={16} /> Como chegar
              </a>
              <a href="https://wa.me/5521972016917" target="_blank" rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 py-3 font-heading font-bold uppercase tracking-wide text-white hover:border-[#25D366] hover:text-[#25D366]">
                <MessageCircle size={16} /> WhatsApp
              </a>
              <a href={INSTAGRAM} target="_blank" rel="noreferrer" data-testid="location-instagram-link"
                className="flex w-full items-center justify-center gap-2 rounded-md border border-zinc-700 py-3 font-heading font-bold uppercase tracking-wide text-white hover:border-pink-500 hover:text-pink-400">
                <Instagram size={16} /> @studio01barber
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 text-center">
          <Logo />
          <div className="my-2 h-[5px] w-40 dotted-rule" />
          <p className="font-mono text-xs text-zinc-500">Ter a Sáb • 09:00 às 19:00 • CNPJ 62.773.547/0001-87</p>
          <a href="https://www.google.com/maps/search/?api=1&query=Rua+Guar%C3%A1+10+Penha+Circular+Rio+de+Janeiro" target="_blank" rel="noreferrer"
            data-testid="footer-address-link" className="flex items-center gap-2 text-sm text-zinc-300 hover:text-amber-400">
            <MapPin size={15} /> Rua Guará, 10 – Penha Circular, Rio de Janeiro – RJ
          </a>
          <button onClick={() => navigate("/admin")} data-testid="footer-admin-link"
            className="font-mono text-[11px] uppercase tracking-wider text-zinc-600 hover:text-amber-400">
            Painel dos Administradores
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            <a href="https://wa.me/5521972016917" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-[#25D366] hover:text-[#25D366]">
              <MessageCircle size={16} /> Fale no WhatsApp
            </a>
            <a href={INSTAGRAM} target="_blank" rel="noreferrer" data-testid="footer-instagram-link"
              className="inline-flex items-center gap-2 rounded-md border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-pink-500 hover:text-pink-400">
              <Instagram size={16} /> @studio01barber
            </a>
          </div>
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

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Scissors } from "lucide-react";
import { useAuth, formatApiError } from "@/context/AuthContext";

export function AuthModal({ open, onClose, onSuccess }) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-8"
            data-testid="auth-modal"
          >
            <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white" data-testid="auth-modal-close">
              <X size={20} />
            </button>
            <div className="mb-6 flex items-center gap-2 text-amber-400">
              <Scissors size={18} />
              <span className="font-mono text-xs uppercase tracking-[0.25em]">Studio01 Barbearia</span>
            </div>
            <h2 className="mb-1 font-heading text-3xl font-extrabold uppercase text-white">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>
            <p className="mb-6 text-sm text-zinc-400">
              {mode === "login" ? "Acesse para agendar seu horário." : "Cadastre-se para marcar seu corte."}
            </p>

            <form onSubmit={submit} className="space-y-3">
              {mode === "register" && (
                <>
                  <Field label="Nome completo" value={form.name} onChange={set("name")} testid="auth-input-name" required />
                  <Field label="WhatsApp (DDD + número)" value={form.phone} onChange={set("phone")} testid="auth-input-phone" required placeholder="11999999999" />
                </>
              )}
              <Field label="Email" type="email" value={form.email} onChange={set("email")} testid="auth-input-email" required />
              <Field label="Senha" type="password" value={form.password} onChange={set("password")} testid="auth-input-password" required />

              {error && <p className="text-sm text-red-400" data-testid="auth-error">{error}</p>}

              <button
                type="submit" disabled={loading}
                data-testid="auth-submit-btn"
                className="mt-2 w-full rounded-md bg-white py-3 font-heading text-base font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
              >
                {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Cadastrar"}
              </button>
            </form>

            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="mt-5 w-full text-center text-sm text-zinc-400 hover:text-amber-400"
              data-testid="auth-toggle-mode"
            >
              {mode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, testid, ...props }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <input
        {...props} data-testid={testid}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-amber-400"
      />
    </label>
  );
}

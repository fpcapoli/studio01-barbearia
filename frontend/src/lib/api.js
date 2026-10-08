import axios from "axios";

const BACKEND_URL = "https://zmwjqsrlkmapfrkxglkt.supabase.co";

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
});

export function formatApiError(detail) {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(", ");
  }
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const BRL = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export const imgScr = (u) => (u && u.startsWith("/api/") ? `${BACKEND_URL}${u}` : u);

export const WEEKDAY_LABELS = { 1: "Ter", 2: "Qua", 3: "Qui", 4: "Sex", 5: "Sáb" };

export const worksOn = (b, jsDay) => (b.days || [1, 2, 3, 4, 5]).includes(jsDay - 1);

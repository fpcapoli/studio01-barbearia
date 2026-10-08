export const api = {
  get: async (url) => {
    if (url.includes("/barbers")) {
      return { 
        data: [
          { id: 1, name: "Carlos", specialty: "Corte Clássico & Barba", days: [1,2,3,4,5] },
          { id: 2, name: "Renato", specialty: "Degradê & Estilo Moderno", days: [1,2,3,4,5] }
        ] 
      };
    }
    if (url.includes("/gallery")) {
      return { data: [] };
    }
    if (url.includes("/auth/me")) {
      return { data: { name: "Cliente", email: "cliente@studio01.com" } };
    }
    return { data: [] };
  },
  post: async (url, data) => {
    return { data: { success: true, ...data } };
  },
  put: async (url, data) => {
    return { data: { success: true, ...data } };
  },
  delete: async (url) => {
    return { data: { success: true } };
  }
};

export function formatApiError(detail) {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  return String(detail);
}

export const BRL = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

export const imgSrc = (path) => path;

export const WEEKDAY_LABELS = { 1: "Ter", 2: "Qua", 3: "Qui", 4: "Sex", 5: "Sáb" };

export const worksOn = (b, jsDay) => true;

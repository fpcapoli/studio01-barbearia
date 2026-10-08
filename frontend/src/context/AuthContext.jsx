import React, { createContext, useContext, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState({ name: "Cliente", email: "cliente@studio01.com" });
  const [checked, setChecked] = useState(true);

  const refresh = useCallback(async () => {
    setUser({ name: "Cliente", email: "cliente@studio01.com" });
    setChecked(true);
  }, []);

  const login = async (email, password) => {
    const mockUser = { name: email.split("@")[0], email };
    setUser(mockUser);
    return { data: mockUser };
  };

  const register = async (payload) => {
    const mockUser = { name: payload.name || "Cliente", email: payload.email };
    setUser(mockUser);
    return { data: mockUser };
  };

  const logout = async () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, checked, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const formatApiError = (detail) => {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  return String(detail);
};

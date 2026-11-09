import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem("token"));

  const refresh = useCallback(async () => {
    if (!localStorage.getItem("token")) { setUser(null); setLoading(false); return null; }
    try {
      const { data } = await api.get("/voters/profile");
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* token may already be invalid */ }
    localStorage.removeItem("token");
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

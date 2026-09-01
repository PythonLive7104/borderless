import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, tokens, type User } from "../lib/api";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (p: { first_name: string; last_name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    if (!tokens.access) { setUser(null); return; }
    try { setUser(await authApi.me()); } catch { setUser(null); tokens.clear(); }
  }

  useEffect(() => { refreshUser().finally(() => setLoading(false)); }, []);

  async function login(email: string, password: string) {
    const t = await authApi.login(email, password);
    tokens.set(t);
    await refreshUser();
  }
  async function register(p: { first_name: string; last_name: string; email: string; password: string }) {
    await authApi.register(p);
    await login(p.email, p.password);
  }
  function logout() { tokens.clear(); setUser(null); }

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
}

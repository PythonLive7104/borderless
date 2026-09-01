import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, tokens, ApiError, type User } from "../lib/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    // A hard refresh on a slow/overloaded server can make me() fail transiently
    // (timeout, 5xx). Only a definitive 401 (invalid session) should log the
    // user out — everything else is retried so a blip doesn't sign them out.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        setUser(await authApi.me());
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setUser(null); tokens.clear(); return;
        }
        if (attempt < 2) { await sleep(600 * (attempt + 1)); continue; }
        // Out of retries on a transient error: keep the tokens so the next
        // navigation can recover, but we can't confirm the user right now.
        setUser(null); return;
      }
    }
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

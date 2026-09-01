import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { orgApi, type Organization } from "../lib/api";
import { useAuth } from "./AuthContext";

const KEY = "bl_org";
interface WsCtx {
  orgs: Organization[];
  current: Organization | null;
  loading: boolean;
  switchTo: (id: number) => void;
  reload: () => Promise<void>;
}
const Ctx = createContext<WsCtx>(null as any);
export const useWorkspace = () => useContext(Ctx);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [currentId, setCurrentId] = useState<number | null>(() => {
    try { return Number(localStorage.getItem(KEY)) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  async function reload() {
    if (!user) { setOrgs([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await orgApi.list();
      const list = Array.isArray(res) ? res : res.results;
      setOrgs(list);
      setCurrentId((prev) => (list.find((o) => o.id === prev) ? prev : list[0]?.id ?? null));
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user]);
  useEffect(() => { if (currentId) localStorage.setItem(KEY, String(currentId)); }, [currentId]);

  const current = orgs.find((o) => o.id === currentId) ?? null;
  return (
    <Ctx.Provider value={{ orgs, current, loading, switchTo: setCurrentId, reload }}>
      {children}
    </Ctx.Provider>
  );
}

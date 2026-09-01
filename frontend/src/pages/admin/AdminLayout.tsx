import { NavLink, Outlet, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/organizations", label: "Organizations" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen bg-bg-soft">
      <header className="bg-navy-900 text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-extrabold">
              Borderless <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide">Admin</span>
            </span>
            <nav className="hidden gap-1 sm:flex">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end}
                  className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-white/15 text-white" : "text-slate-300 hover:text-white"}`}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-slate-300 hover:text-white">← Back to app</Link>
            <span className="hidden text-slate-400 sm:block">{user?.email}</span>
            <button onClick={logout} className="rounded-lg border border-white/25 px-3 py-1.5 font-semibold hover:bg-white/10">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8"><Outlet /></main>
    </div>
  );
}

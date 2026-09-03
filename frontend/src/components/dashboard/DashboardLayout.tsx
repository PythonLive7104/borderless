import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import Logo from "../marketing/Logo";
import Button from "../ui/Button";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import HelpChat from "./HelpChat";
import AccessGate from "./AccessGate";
import CommandPalette from "./CommandPalette";
import VerifyEmailGate from "./VerifyEmailGate";
import { TourProvider } from "../../context/TourContext";
import { useAuth } from "../../context/AuthContext";
import {
  IHome, IGlobe, ITarget, IFilter, IShieldGold, ILink, IRadar, IUsers, IList,
  IChart, IFunnel, ISources, IPlug, IKey, IBolt, ICard, IGauge, IGear,
} from "../ui/icons";
import type { SVGProps, ComponentType } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type Item = { label: string; to?: string; soon?: boolean; icon?: IconType };
type Group = { title: string; items: Item[] };

const NAV: Group[] = [
  { title: "Overview", items: [
    { label: "Dashboard", to: "/dashboard", icon: IHome },
    { label: "Websites", to: "/dashboard/websites", icon: IGlobe },
  ]},
  { title: "Traffic", items: [
    { label: "Campaigns", to: "/dashboard/campaigns", icon: ITarget },
    { label: "Traffic Rules", to: "/dashboard/traffic-rules", icon: IFilter },
    { label: "Shield", to: "/dashboard/shield", icon: IShieldGold },
    { label: "Link Shortener", to: "/dashboard/links", icon: ILink },
    { label: "Bot Scanner", to: "/dashboard/scanner", icon: IRadar },
    { label: "Visitors", to: "/dashboard/visitors", icon: IUsers },
    { label: "Click Log", to: "/dashboard/click-log", icon: IList },
  ]},
  { title: "Analytics", items: [
    { label: "Reports", to: "/dashboard/reports", icon: IChart },
    { label: "Conversions", to: "/dashboard/conversions", icon: IFunnel },
    { label: "Traffic Sources", to: "/dashboard/traffic-sources", icon: ISources },
  ]},
  { title: "Developer", items: [
    { label: "Integrations", to: "/dashboard/integrations", icon: IPlug },
    { label: "API Keys", to: "/dashboard/api", icon: IKey },
    { label: "Webhooks", to: "/dashboard/webhooks", icon: IBolt },
  ]},
  { title: "Settings", items: [
    { label: "Team", to: "/dashboard/team", icon: IUsers },
    { label: "Billing", to: "/dashboard/billing", icon: ICard },
    { label: "Usage", to: "/dashboard/usage", icon: IGauge },
    { label: "Settings", to: "/dashboard/settings", icon: IGear },
  ]},
];

function SidebarLink({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (item.soon || !item.to) {
    return (
      <span className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-dim/70">
        {Icon && <Icon width={18} className="shrink-0" />}
        <span className="flex-1">{item.label}</span>
        <span className="rounded-full bg-bg-mute px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">soon</span>
      </span>
    );
  }
  return (
    <NavLink to={item.to} end={item.to === "/dashboard"} onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-brand/10 text-brand" : "text-fg-muted hover:bg-bg-mute hover:text-fg"}`}>
      {Icon && <Icon width={18} className="shrink-0" />}
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <TourProvider>
    <VerifyEmailGate>
    <div className="min-h-screen bg-bg-soft">
      {/* sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center border-b border-line px-5"><Logo /></div>
        <nav className="space-y-6 overflow-y-auto px-3 py-5" style={{ maxHeight: "calc(100vh - 4rem)" }}>
          {NAV.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-fg-dim">{g.title}</div>
              <div className="space-y-0.5">{g.items.map((it) => <SidebarLink key={it.label} item={it} onNavigate={() => setOpen(false)} />)}</div>
            </div>
          ))}
        </nav>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setOpen(false)} />}

      {/* main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between gap-3 px-5">
            <div className="flex items-center gap-3">
              <button className="rounded-lg p-2 text-fg-muted hover:bg-bg-mute lg:hidden" onClick={() => setOpen(!open)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
              </button>
              <WorkspaceSwitcher />
              <button onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
                className="hidden items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-fg-dim hover:border-brand/40 hover:text-fg md:flex" title="Search (Ctrl/Cmd + K)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
                Search <kbd className="rounded border border-line px-1 py-0.5 text-[9px]">⌘K</kbd>
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm">
              {user?.is_staff && <Link to="/admin" className="rounded-lg bg-navy-900 px-3 py-1.5 font-semibold text-white hover:opacity-90">Admin</Link>}
              <span className="hidden text-fg-muted sm:block">{user?.email}</span>
              <Button variant="outline" onClick={logout}>Sign out</Button>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8"><AccessGate><Outlet /></AccessGate></main>
      </div>
      <HelpChat />
      <CommandPalette />
    </div>
    </VerifyEmailGate>
    </TourProvider>
  );
}

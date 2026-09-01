import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

type Cmd = { label: string; hint: string; group: string; to: string; keywords?: string };

const NAV: Cmd[] = [
  { label: "Dashboard", hint: "Traffic overview", group: "Go to", to: "/dashboard", keywords: "home overview control center" },
  { label: "Websites", hint: "Your tracked sites", group: "Go to", to: "/dashboard/websites", keywords: "site tracker snippet install" },
  { label: "Campaigns", hint: "Ad campaigns & A/B tests", group: "Go to", to: "/dashboard/campaigns", keywords: "ads split test variant" },
  { label: "Traffic Rules", hint: "Allow / block / redirect", group: "Go to", to: "/dashboard/traffic-rules", keywords: "rule filter ip block country device" },
  { label: "Bot Scanner", hint: "Scan a site's bot exposure", group: "Go to", to: "/dashboard/scanner", keywords: "scan exposure check" },
  { label: "Visitors", hint: "Every visit & its score", group: "Go to", to: "/dashboard/visitors", keywords: "visitor fingerprint" },
  { label: "Click Log", hint: "Raw event stream", group: "Go to", to: "/dashboard/click-log", keywords: "events clicks log" },
  { label: "Reports", hint: "Analytics reports", group: "Go to", to: "/dashboard/reports", keywords: "analytics charts export" },
  { label: "Conversions", hint: "Goals & revenue", group: "Go to", to: "/dashboard/conversions", keywords: "revenue sales goal" },
  { label: "Traffic Sources", hint: "Where traffic comes from", group: "Go to", to: "/dashboard/traffic-sources", keywords: "source utm referrer" },
  { label: "Integrations", hint: "Connect your stack", group: "Go to", to: "/dashboard/integrations", keywords: "connect api webhook" },
  { label: "API Keys", hint: "Manage API keys", group: "Go to", to: "/dashboard/api", keywords: "token developer key" },
  { label: "Webhooks", hint: "Event delivery", group: "Go to", to: "/dashboard/webhooks", keywords: "callback event http" },
  { label: "Team", hint: "Invite & roles", group: "Go to", to: "/dashboard/team", keywords: "invite member role colleague" },
  { label: "Billing", hint: "Plan & payment", group: "Go to", to: "/dashboard/billing", keywords: "plan subscription upgrade pay" },
  { label: "Usage", hint: "Quota this period", group: "Go to", to: "/dashboard/usage", keywords: "quota limit events" },
  { label: "Settings", hint: "Profile, security, notifications", group: "Go to", to: "/dashboard/settings", keywords: "profile password account language tour" },
];
const ACTIONS: Cmd[] = [
  { label: "Add a website", hint: "Register a new site", group: "Actions", to: "/dashboard/websites", keywords: "new create install" },
  { label: "Create a campaign", hint: "Track an ad campaign", group: "Actions", to: "/dashboard/campaigns", keywords: "new ad" },
  { label: "New traffic rule", hint: "Block / redirect traffic", group: "Actions", to: "/dashboard/traffic-rules", keywords: "block filter" },
  { label: "Generate an API key", hint: "For the REST API", group: "Actions", to: "/dashboard/api", keywords: "token" },
  { label: "Scan a site for bots", hint: "Bot exposure check", group: "Actions", to: "/dashboard/scanner", keywords: "scan" },
  { label: "View billing", hint: "Manage your plan", group: "Actions", to: "/dashboard/billing", keywords: "upgrade pay" },
];

export default function CommandPalette() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const all = useMemo(() => {
    const base = [...NAV, ...ACTIONS];
    if (user?.is_staff) base.push({ label: "Admin panel", hint: "Staff-only overview", group: "Go to", to: "/admin", keywords: "staff users organizations" });
    return base;
  }, [user?.is_staff]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((c) => (c.label + " " + c.hint + " " + (c.keywords || "")).toLowerCase().includes(term));
  }, [q, all]);

  // global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) { setQ(""); setActive(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);
  useEffect(() => { setActive(0); }, [q]);

  if (!open) return null;
  const go = (c?: Cmd) => { if (c) { nav(c.to); setOpen(false); } };

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-dim"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
            }}
            placeholder="Search pages and actions…" className="w-full bg-transparent py-3.5 text-sm outline-none" />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-fg-dim">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 && <div className="px-4 py-6 text-center text-sm text-fg-muted">No matches for "{q}"</div>}
          {results.map((c, i) => (
            <button key={c.group + c.label} onMouseEnter={() => setActive(i)} onClick={() => go(c)}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left ${i === active ? "bg-brand/10" : ""}`}>
              <span className="flex items-center gap-3">
                <span className={`text-sm font-medium ${i === active ? "text-brand" : ""}`}>{c.label}</span>
                <span className="text-xs text-fg-dim">{c.hint}</span>
              </span>
              <span className="rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-dim">{c.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

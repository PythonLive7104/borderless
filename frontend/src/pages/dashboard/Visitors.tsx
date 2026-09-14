import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { analyticsApi, ipFilterApi, type IPKind, type VisitorRow } from "../../lib/api";
import NoData from "../../components/dashboard/NoData";
import WebsitePicker from "../../components/dashboard/WebsitePicker";
import { useDialog } from "../../context/DialogContext";
import IpRuleToggle from "../../components/dashboard/IpRuleToggle";
import Pager from "../../components/ui/Pager";

const PAGE_SIZE = 25;

// ISO-2 country code -> flag emoji, so the list is scannable at a glance.
function flag(cc?: string): string {
  if (!cc || cc.length !== 2 || !/^[a-zA-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// A risk score means little as a bare number to most users; the label does.
function riskMeta(r: number | null): { label: string; cls: string } {
  if (r == null) return { label: "—", cls: "bg-bg-mute text-fg-dim" };
  if (r >= 85) return { label: "Fraud", cls: "bg-danger/10 text-red-600" };
  if (r >= 70) return { label: "Bot", cls: "bg-orange-500/10 text-orange-600" };
  if (r >= 40) return { label: "Suspicious", cls: "bg-warning/10 text-amber-700" };
  return { label: "Clean", cls: "bg-success/10 text-emerald-700" };
}

const DEVICE_ICON: Record<string, string> = { mobile: "📱", desktop: "🖥️", tablet: "📟" };

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Visitors() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<VisitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState("");
  const [website, setWebsite] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busyIp, setBusyIp] = useState<string | null>(null);
  const { confirm, notify } = useDialog();
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const res = await analyticsApi.visitors(current.id, { search, device, website, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(res.results); setTotal(res.count);
    } finally { setLoading(false); }
  }

  // Allow / block straight from the list: this is where you actually see the IP
  // worth acting on, and the entry is enforced ahead of the scored rules.
  // One handler for all three positions: null clears back to the normal rules.
  async function changeIpRule(v: VisitorRow, next: IPKind | null) {
    if (!v.ip || !current) return;
    if (next === "deny" && !(await confirm({
      title: `Block ${v.ip}?`,
      message: "Every visit from this address is refused straight away, across every website in this workspace.",
      confirmLabel: "Block this IP",
    }))) return;
    setBusyIp(v.ip);
    try {
      if (v.ip_rule) await ipFilterApi.remove(v.ip_rule.id);
      if (next) {
        await ipFilterApi.create({ organization: current.id, value: v.ip, kind: next,
                                   note: `Added from Visitors · ${v.country || "unknown"}` });
      }
      notify(next === "deny" ? `${v.ip} is now blocked.`
           : next === "allow" ? `${v.ip} is now always allowed.`
           : `${v.ip} follows the normal rules again.`);
      load();
    } catch (e: any) {
      notify(e?.data?.detail || "Could not update that IP rule.", "danger");
    } finally { setBusyIp(null); }
  }

  useEffect(() => { setPage(0); /* eslint-disable-next-line */ }, [search, device, website]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [current?.id, search, device, website, page]);

  return (
    <div>
      <PageNote id="visitors">Everyone who visits your sites appears here with a <b>risk score</b>. Low means likely a real person; high means likely a bot. Click any visitor to see everything they did.</PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Visitors</h1>
      <p className="mt-1 text-sm text-fg-muted">Every visitor analyzed in {current?.name}.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search visitor ID or IP…"
          className="w-64 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand" />
        {current && <WebsitePicker orgId={current.id} value={website} onChange={setWebsite} />}
        <select value={device} onChange={(e) => setDevice(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand">
          <option value="">All devices</option><option value="mobile">Mobile</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option>
        </select>
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : rows.length === 0 ? <div className="card shadow-soft mt-5"><NoData msg="No visitors match." /></div>
       : (
        <>
        <div className="card shadow-soft mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                <tr>
                  <th className="px-4 py-3">Visitor</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3 text-right">Events</th>
                  <th className="px-4 py-3">Risk</th>
                  <th className="px-4 py-3">Last seen</th>
                  {canManage && <th className="px-4 py-3">IP rule</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-bg-soft">
                    <td className="px-4 py-3">
                      <Link to={`/dashboard/visitors/${v.id}`} className="block max-w-[200px] truncate font-mono text-[13px] font-semibold text-brand hover:underline" title={v.ip || v.visitor_id}>
                        {v.ip || "unknown IP"}
                      </Link>
                      <span className="font-mono text-[11px] text-fg-dim">{v.visitor_id.slice(0, 12)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {v.country ? <span>{flag(v.country)} {v.country}</span> : <span className="text-fg-dim">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-fg-muted">
                      <span className="mr-1">{DEVICE_ICON[v.device] || "•"}</span>
                      {v.browser || "Other"} · {v.os || "Other"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{v.events}</td>
                    <td className="px-4 py-3">
                      {(() => { const m = riskMeta(v.max_risk); return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`}>
                          {v.max_risk ?? "—"}<span className="opacity-70">·</span>{m.label}
                        </span>
                      ); })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-fg-muted" title={new Date(v.last_seen).toLocaleString()}>{timeAgo(v.last_seen)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {!v.ip ? <span className="text-fg-dim">—</span> : (
                          <span className="flex items-center gap-2">
                            <IpRuleToggle value={v.ip_rule?.kind ?? null} busy={busyIp === v.ip}
                              onChange={(next) => changeIpRule(v, next)} />
                            {/* A CIDR entry covers this IP without naming it. */}
                            {v.ip_rule && v.ip_rule.value !== v.ip && (
                              <span className="font-mono text-[11px] text-fg-dim">via {v.ip_rule.value}</span>
                            )}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}

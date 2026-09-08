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

const riskTone = (r: number | null) =>
  r == null ? "text-fg-dim" : r >= 85 ? "text-red-600" : r >= 70 ? "text-orange-600" : r >= 40 ? "text-amber-600" : "text-emerald-600";

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
                <tr><th className="px-4 py-3">Visitor</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Browser / OS</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Max risk</th><th className="px-4 py-3">Last seen</th>{canManage && <th className="px-4 py-3">IP rule</th>}</tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-bg-soft">
                    <td className="px-4 py-3"><Link to={`/dashboard/visitors/${v.id}`} className="font-mono font-semibold hover:text-brand">{v.visitor_id.slice(0, 14)}</Link></td>
                    <td className="px-4 py-3 font-mono text-xs">{v.ip || "—"}</td>
                    <td className="px-4 py-3">{v.country || "—"}</td>
                    <td className="px-4 py-3 capitalize">{v.device || "—"}</td>
                    <td className="px-4 py-3 text-fg-muted">{v.browser} · {v.os}</td>
                    <td className="px-4 py-3">{v.events}</td>
                    <td className={`px-4 py-3 font-bold ${riskTone(v.max_risk)}`}>{v.max_risk ?? "—"}</td>
                    <td className="px-4 py-3 text-fg-muted">{new Date(v.last_seen).toLocaleString()}</td>
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

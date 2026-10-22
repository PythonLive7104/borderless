import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { analyticsApi, type EventRow } from "../../lib/api";
import ClassBadge from "../../components/ui/ClassBadge";
import NoData from "../../components/dashboard/NoData";
import Pager from "../../components/ui/Pager";
import WebsitePicker from "../../components/dashboard/WebsitePicker";

const PAGE_SIZE = 25;

const actionTone: Record<string, string> = {
  allow: "bg-success/10 text-emerald-700", review: "bg-warning/10 text-amber-700",
  block: "bg-danger/10 text-red-600", tag: "bg-brand/10 text-brand",
};

/** Why a decision ignored the customer's rules.
 *
 *  Four signals override rule evaluation outright. Without saying so, the row
 *  reads as the engine malfunctioning: a verified Googlebot is scored 50 and
 *  classified Suspicious, exactly what a "block suspicious" rule targets, and
 *  then allowed anyway. It is allowed on purpose — serving a crawler something
 *  different from what people get is cloaking, and Google penalises sites for
 *  it — but nothing on screen said that, so it looked like the rule was broken.
 */
const OVERRIDES: { signal: string; label: string; why: string; tone: string }[] = [
  { signal: "verified_crawler", label: "Search crawler", tone: "bg-brand/10 text-brand",
    why: "A real search-engine crawler, confirmed by reverse DNS rather than its user-agent. "
       + "Rules are skipped for these on purpose: showing a crawler something different from "
       + "what visitors see is cloaking, and it can get the site removed from search results." },
  { signal: "ad_reviewer", label: "Ad reviewer", tone: "bg-brand/10 text-brand",
    why: "An ad platform reviewing your landing page. It gets exactly the page real visitors "
       + "get — it is only labelled here so your click numbers can exclude it." },
  { signal: "ip_allowlisted", label: "On your allow list", tone: "bg-success/10 text-emerald-700",
    why: "This address is on your IP allow list, which takes precedence over every rule. "
       + "Remove it under Traffic Rules if you want your rules to apply here." },
  { signal: "ip_blocklisted", label: "On your block list", tone: "bg-danger/10 text-red-600",
    why: "This address is on your IP block list, which takes precedence over every rule." },
];

function overrideFor(signals: string[] | undefined) {
  if (!signals?.length) return null;
  return OVERRIDES.find((o) => signals.includes(o.signal)) || null;
}

export default function ClickLog() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ search: "", website: "", classification: "", action: "", type: "", min_risk: "" });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  // Only worth a column when several sites are mixed together in the list.
  const [multiSite, setMultiSite] = useState(false);
  const showSite = multiSite && !f.website;

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const res = await analyticsApi.events(current.id, { ...f, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(res.results); setTotal(res.count);
    } finally { setLoading(false); }
  }
  // Jump back to the first page whenever a filter changes.
  useEffect(() => { setPage(0); /* eslint-disable-next-line */ }, [JSON.stringify(f)]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [current?.id, JSON.stringify(f), page]);

  return (
    <div>
      <PageNote id="click-log">A live list of <b>every visit</b>, newest first. Use the filters to find things like all blocked bots, or all visits from one country.</PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Click Log</h1>
      <p className="mt-1 text-sm text-fg-muted">Every classified event, newest first.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={f.search} onChange={set("search")} placeholder="Search IP, URL, visitor…" className="w-56 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand" />
        {current && <WebsitePicker orgId={current.id} value={f.website}
          onChange={(website) => setF({ ...f, website })} onMulti={setMultiSite} />}
        <select value={f.classification} onChange={set("classification")} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">All classes</option><option value="human">Human</option><option value="suspicious">Suspicious</option><option value="bot">Bot</option><option value="fraud">Fraud</option>
        </select>
        <select value={f.action} onChange={set("action")} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">All actions</option><option value="allow">Allow</option><option value="review">Review</option><option value="block">Block</option><option value="tag">Tag</option>
        </select>
        <select value={f.type} onChange={set("type")} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">All types</option><option value="pageview">Pageview</option><option value="event">Event</option><option value="conversion">Conversion</option>
        </select>
        <input value={f.min_risk} onChange={set("min_risk")} type="number" placeholder="min risk" className="w-24 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : rows.length === 0 ? <div className="card shadow-soft mt-5"><NoData msg="No events match." /></div>
       : (
        <>
        <div className="card shadow-soft mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Type</th>{showSite && <th className="px-4 py-3">Site</th>}<th className="px-4 py-3">Country</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-bg-soft">
                    <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{e.type}</td>
                    {showSite && <td className="px-4 py-3 text-fg-muted">{e.website_name || "—"}</td>}
                    <td className="px-4 py-3">{e.country || "—"}</td>
                    <td className="px-4 py-3 capitalize">{e.device || "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold">{e.risk_score ?? "—"}</td>
                    <td className="px-4 py-3"><ClassBadge value={e.classification} /></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${actionTone[e.action] || "bg-bg-mute"}`}>{e.action}{e.tag ? `:${e.tag}` : ""}</span>
                      {(() => {
                        const o = overrideFor(e.signals);
                        return o ? (
                          <span title={o.why}
                            className={`mt-1 block w-fit cursor-help rounded-full px-2 py-0.5 text-[10px] font-semibold ${o.tone}`}>
                            {o.label}
                          </span>
                        ) : null;
                      })()}
                    </td>
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

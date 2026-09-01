import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { analyticsApi, type EventRow } from "../../lib/api";
import ClassBadge from "../../components/ui/ClassBadge";
import NoData from "../../components/dashboard/NoData";

const actionTone: Record<string, string> = {
  allow: "bg-success/10 text-emerald-700", review: "bg-warning/10 text-amber-700",
  block: "bg-danger/10 text-red-600", tag: "bg-brand/10 text-brand",
};

export default function ClickLog() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ search: "", classification: "", action: "", type: "", min_risk: "" });
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function load() {
    if (!current) return;
    setLoading(true);
    try { setRows((await analyticsApi.events(current.id, f)).results); } finally { setLoading(false); }
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [current?.id, JSON.stringify(f)]);

  return (
    <div>
      <PageNote id="click-log">A live list of <b>every visit</b>, newest first. Use the filters to find things like all blocked bots, or all visits from one country.</PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Click Log</h1>
      <p className="mt-1 text-sm text-fg-muted">Every classified event, newest first.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <input value={f.search} onChange={set("search")} placeholder="Search IP, URL, visitor…" className="w-56 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand" />
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
        <div className="card shadow-soft mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Country</th><th className="px-4 py-3">Device</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} className="hover:bg-bg-soft">
                    <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{new Date(e.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 capitalize">{e.type}</td>
                    <td className="px-4 py-3">{e.country || "—"}</td>
                    <td className="px-4 py-3 capitalize">{e.device || "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold">{e.risk_score ?? "—"}</td>
                    <td className="px-4 py-3"><ClassBadge value={e.classification} /></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${actionTone[e.action] || "bg-bg-mute"}`}>{e.action}{e.tag ? `:${e.tag}` : ""}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

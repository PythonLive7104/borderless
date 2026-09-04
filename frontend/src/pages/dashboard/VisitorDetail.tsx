import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { Link, useParams } from "react-router-dom";
import { analyticsApi, type EventRow, type VisitorRow } from "../../lib/api";
import ClassBadge from "../../components/ui/ClassBadge";

export default function VisitorDetail() {
  const { id } = useParams();
  const [data, setData] = useState<{ visitor: VisitorRow; sessions: number; events: EventRow[] } | null>(null);
  useEffect(() => { analyticsApi.visitor(Number(id)).then(setData); }, [id]);
  if (!data) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;
  const v = data.visitor;

  return (
    <div>
      <PageNote id="visitor-detail">Everything we know about one visitor and every action they took on your site.</PageNote>
      <Link to="/dashboard/visitors" className="text-sm text-fg-muted hover:text-brand">← Visitors</Link>
      <h1 className="mt-3 font-mono text-2xl font-extrabold tracking-tight">{v.visitor_id.slice(0, 20)}</h1>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card shadow-soft p-6 lg:col-span-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Profile</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[["IP", v.ip || "—"], ["Country", v.country || "—"], ["Device", v.device || "—"], ["Browser", v.browser || "—"], ["OS", v.os || "—"], ["Fingerprint", v.fingerprint || "—"],
              ["Sessions", String(data.sessions)], ["Events", String(v.events)], ["Max risk", v.max_risk ?? "—"],
              ["First seen", new Date(v.first_seen).toLocaleString()], ["Last seen", new Date(v.last_seen).toLocaleString()]].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-3"><dt className="text-fg-muted">{k}</dt><dd className="text-right capitalize">{val as string}</dd></div>
            ))}
          </dl>
        </div>

        <div className="card shadow-soft p-6 lg:col-span-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Event timeline</h2>
          <div className="mt-4 space-y-2">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-bg-mute px-2 py-0.5 text-xs font-semibold capitalize">{e.type}</span>
                  <span className="truncate text-fg-muted" style={{ maxWidth: 220 }}>{e.url || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  {e.ja3 && <span title={`TLS/JA3: ${e.ja3}`} className="hidden rounded bg-bg-mute px-1.5 py-0.5 font-mono text-[10px] text-fg-dim md:inline">JA3</span>}
                  {e.fp_signals?.slice(0, 2).map((s) => <span key={s} className="hidden rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 sm:inline">{s}</span>)}
                  <ClassBadge value={e.classification} />
                  <span className="font-mono text-xs text-fg-dim">risk {e.risk_score ?? "—"}</span>
                  <span className="text-xs text-fg-dim">{new Date(e.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

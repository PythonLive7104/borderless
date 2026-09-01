import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { conversionsApi, type Conversions as ConvT } from "../../lib/api";
import RangeTabs from "../../components/dashboard/RangeTabs";
import StatCard from "../../components/dashboard/StatCard";
import NoData from "../../components/dashboard/NoData";
import PageNote from "../../components/dashboard/PageNote";

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Breakdown({ title, rows }: { title: string; rows: ConvT["by_source"] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="card shadow-soft p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-fg-dim">{title}</h3>
      {rows.length === 0 ? <NoData msg="No data" /> : (
        <div className="mt-4 space-y-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex justify-between text-sm"><span className="capitalize">{r.key}</span><span className="font-semibold">{money(r.revenue)} · {r.count}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-bg-mute"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.revenue / max) * 100}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Conversions() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("7d");
  const [d, setD] = useState<ConvT | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    conversionsApi.get(current.id, range).then(setD).finally(() => setLoading(false));
  }, [current?.id, range]);

  return (
    <div>
      <PageNote id="conversions">
        A <b>conversion</b> is a valuable action like a purchase or sign-up. This page shows how many you got and how much money they made — so you can see which traffic actually pays off. Your website sends these automatically when you call <code className="rounded bg-white px-1">bl('conversion', …)</code>.
      </PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Conversions</h1>
          <p className="mt-1 text-sm text-fg-muted">Sales and sign-ups attributed to your traffic.</p></div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {loading ? <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : !d ? null : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Conversions" value={d.totals.conversions.toLocaleString()} tone="brand" />
            <StatCard label="Revenue" value={money(d.totals.revenue)} tone="green" />
            <StatCard label="Revenue / visitor" value={money(d.totals.revenue_per_visitor)} tone="amber" />
            <StatCard label="Avg order value" value={money(d.totals.avg_order_value)} />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Breakdown title="Revenue by campaign" rows={d.by_campaign} />
            <Breakdown title="Revenue by source" rows={d.by_source} />
          </div>

          <div className="card shadow-soft mt-6 overflow-hidden">
            <h3 className="border-b border-line px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg-dim">Recent conversions</h3>
            {d.recent.length === 0 ? <NoData /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                    <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Revenue</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Visitor</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {d.recent.map((c) => (
                      <tr key={c.id} className="hover:bg-bg-soft">
                        <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{new Date(c.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3 capitalize">{c.event_name}</td>
                        <td className="px-4 py-3 font-semibold">{money(c.revenue)} {c.currency}</td>
                        <td className="px-4 py-3 capitalize">{c.utm_source}</td>
                        <td className="px-4 py-3">{c.utm_campaign || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs">{c.visitor_ref.slice(0, 12)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

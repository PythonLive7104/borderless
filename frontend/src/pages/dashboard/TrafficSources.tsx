import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { analyticsApi, type SourceRow } from "../../lib/api";
import RangeTabs from "../../components/dashboard/RangeTabs";
import NoData from "../../components/dashboard/NoData";

export default function TrafficSources() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("7d");
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    analyticsApi.sources(current.id, range).then((d) => setRows(d.sources)).finally(() => setLoading(false));
  }, [current?.id, range]);

  const q = (v: number) => `${(v * 100).toFixed(0)}%`;

  return (
    <div>
      <PageNote id="traffic-sources">This shows <b>where your visitors come from</b> (Facebook, Google, and so on) and how trustworthy each source is. Spend more on the sources with high quality.</PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Traffic Sources</h1>
          <p className="mt-1 text-sm text-fg-muted">Volume and quality by source.</p></div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : rows.length === 0 ? <div className="card shadow-soft mt-6"><NoData /></div>
       : (
        <div className="card shadow-soft mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
              <tr><th className="px-4 py-3">Source</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Human</th><th className="px-4 py-3 w-1/3">Quality</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.key} className="hover:bg-bg-soft">
                  <td className="px-4 py-3 font-semibold capitalize">{s.key}</td>
                  <td className="px-4 py-3">{s.events}</td>
                  <td className="px-4 py-3">{s.human}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-mute"><div className="h-full rounded-full bg-success" style={{ width: q(s.quality) }} /></div>
                      <span className="w-10 text-right font-semibold">{q(s.quality)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

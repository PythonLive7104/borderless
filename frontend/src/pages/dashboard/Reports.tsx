import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { analyticsApi, downloadReportCsv, type ReportRow } from "../../lib/api";
import RangeTabs from "../../components/dashboard/RangeTabs";
import NoData from "../../components/dashboard/NoData";
import PageNote from "../../components/dashboard/PageNote";

const DIM_LABELS: Record<string, string> = {
  country: "Country", device: "Device", browser: "Browser", os: "OS",
  classification: "Classification", action: "Action",
  utm_source: "UTM source", utm_medium: "UTM medium", utm_campaign: "UTM campaign",
};

export default function Reports() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("30d");
  const [dimension, setDimension] = useState("country");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [dims, setDims] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    analyticsApi.report(current.id, dimension, range).then((d) => { setRows(d.rows); setDims(d.dimensions); }).finally(() => setLoading(false));
  }, [current?.id, dimension, range]);

  return (
    <div>
      <PageNote id="reports">
        Build a quick report by choosing what to group your traffic by — country, device, source, and so on. You'll see visitors, quality and conversions for each. Click <b>Export CSV</b> to download it for a spreadsheet.
      </PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-fg-muted">Break traffic down by any dimension and export it.</p></div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-fg-muted">Group by</span>
        <select value={dimension} onChange={(e) => setDimension(e.target.value)}
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand">
          {(dims.length ? dims : Object.keys(DIM_LABELS)).map((d) => <option key={d} value={d}>{DIM_LABELS[d] || d}</option>)}
        </select>
        <button onClick={() => current && downloadReportCsv(current.id, dimension, range)}
          className="ml-auto rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand/40">↓ Export CSV</button>
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : rows.length === 0 ? <div className="card shadow-soft mt-5"><NoData /></div>
       : (
        <div className="card shadow-soft mt-5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                <tr><th className="px-4 py-3">{DIM_LABELS[dimension] || dimension}</th><th className="px-4 py-3">Events</th><th className="px-4 py-3">Visitors</th><th className="px-4 py-3">Human</th><th className="px-4 py-3">Conversions</th><th className="px-4 py-3 w-1/4">Quality</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-bg-soft">
                    <td className="px-4 py-3 font-semibold capitalize">{r.key}</td>
                    <td className="px-4 py-3">{r.events}</td>
                    <td className="px-4 py-3">{r.visitors}</td>
                    <td className="px-4 py-3">{r.human}</td>
                    <td className="px-4 py-3">{r.conversions}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-mute"><div className="h-full rounded-full bg-success" style={{ width: `${r.quality * 100}%` }} /></div>
                        <span className="w-10 text-right text-xs font-semibold">{(r.quality * 100).toFixed(0)}%</span>
                      </div>
                    </td>
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

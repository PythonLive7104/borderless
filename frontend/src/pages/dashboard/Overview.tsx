import { useState } from "react";
import { useLivePoll } from "../../lib/useLivePoll";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { analyticsApi, type Overview as OverviewT } from "../../lib/api";
import RangeTabs from "../../components/dashboard/RangeTabs";
import StatCard from "../../components/dashboard/StatCard";
import NoData from "../../components/dashboard/NoData";

const CLASS_COLORS: Record<string, string> = {
  human: "#16a34a", suspicious: "#d97706", bot: "#ea580c", fraud: "#dc2626",
};
const fmtDate = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card shadow-soft p-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-fg-dim">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function Overview() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState<OverviewT | null>(null);
  const [loading, setLoading] = useState(true);

  useLivePoll((silent) => {
    if (!current) return;
    if (!silent) setLoading(true);
    analyticsApi.overview(current.id, range).then(setData).finally(() => setLoading(false));
  }, [current?.id, range]);

  const t = data?.totals;
  const hasData = (t?.events ?? 0) > 0;

  return (
    <div>
      <PageNote id="overview">This is your <b>control center</b>. It shows how many people visit your sites and how many are real vs. bots. A higher <b>Traffic quality</b> is better — it means most visitors are genuine. Use the date buttons on the right to change the time period.</PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-fg-muted">{current?.name} · traffic overview</p>
        </div>
        <RangeTabs value={range} onChange={setRange} />
      </div>

      {loading ? (
        <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Visitors" value={t!.visitors.toLocaleString()} sub={`${t!.events} events`} tone="brand" />
            <StatCard label="Traffic quality" value={`${(t!.quality * 100).toFixed(1)}%`} sub={`${t!.human} human`} tone="green" />
            <StatCard label="Suspicious + Fraud" value={(t!.suspicious + t!.bot + t!.fraud).toLocaleString()} sub={`${t!.flagged} flagged`} tone="red" />
            <StatCard label="Conversions" value={t!.conversions.toLocaleString()} sub={`${(t!.conversion_rate * 100).toFixed(1)}% rate`} tone="amber" />
          </div>

          {!hasData ? (
            <div className="card shadow-soft mt-6"><NoData msg="No traffic in this range yet. Install your tracking snippet to start receiving data." /></div>
          ) : (
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <Panel title="Visitors over time">
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data!.timeseries.visitors}>
                    <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12, fill: "#8b93a3" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#8b93a3" }} width={30} />
                    <Tooltip labelFormatter={fmtDate} />
                    <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} fill="url(#gv)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Traffic quality over time">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data!.timeseries.quality.map((q) => ({ ...q, pct: Math.round(q.pct * 100) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" />
                    <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 12, fill: "#8b93a3" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#8b93a3" }} width={30} unit="%" />
                    <Tooltip labelFormatter={fmtDate} formatter={(v) => [`${v}%`, "Quality"]} />
                    <Line type="monotone" dataKey="pct" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Risk distribution">
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={180}>
                    <PieChart>
                      <Pie data={data!.breakdowns.classifications} dataKey="count" nameKey="key" innerRadius={45} outerRadius={70} paddingAngle={2}>
                        {data!.breakdowns.classifications.map((c) => <Cell key={c.key} fill={CLASS_COLORS[c.key] || "#94a3b8"} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex-1 space-y-2 text-sm">
                    {data!.breakdowns.classifications.map((c) => (
                      <li key={c.key} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 capitalize">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: CLASS_COLORS[c.key] || "#94a3b8" }} />{c.key}
                        </span>
                        <span className="font-semibold">{c.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>

              <Panel title="Devices">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data!.breakdowns.devices}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f6" vertical={false} />
                    <XAxis dataKey="key" tick={{ fontSize: 12, fill: "#8b93a3" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#8b93a3" }} width={30} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6d5efc" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Top countries">
                <BarList rows={data!.breakdowns.countries} />
              </Panel>
              <Panel title="Traffic sources">
                <BarList rows={data!.breakdowns.sources} />
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BarList({ rows }: { rows: { key: string; count: number }[] }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  if (!rows.length) return <NoData msg="No data" />;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="mb-1 flex justify-between text-sm"><span className="capitalize">{r.key}</span><span className="font-semibold text-fg-muted">{r.count}</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-mute"><div className="h-full rounded-full bg-brand" style={{ width: `${(r.count / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

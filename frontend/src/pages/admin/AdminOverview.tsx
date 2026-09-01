import { useEffect, useState } from "react";
import { adminApi, type AdminOverview as T } from "../../lib/api";

export default function AdminOverview() {
  const [d, setD] = useState<T | null>(null);
  useEffect(() => { adminApi.overview().then(setD); }, []);
  if (!d) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

  const tiles: [string, string | number][] = [
    ["MRR", `$${d.mrr.toLocaleString()}`], ["Active subscriptions", d.active_subscriptions],
    ["Users", d.users], ["Organizations", d.organizations],
    ["Events processed", d.events_processed.toLocaleString()], ["Conversions", d.conversions],
    ["Websites", d.websites], ["Campaigns", d.campaigns],
  ];
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Platform overview</h1>
      <p className="mt-1 text-sm text-fg-muted">Company-wide metrics across all workspaces.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="card shadow-soft p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{k}</div>
            <div className="mt-2 text-2xl font-extrabold">{v}</div>
          </div>
        ))}
      </div>
      <div className="card shadow-soft mt-6 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Subscriptions by plan</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {Object.entries(d.subscriptions_by_plan).map(([plan, n]) => (
            <div key={plan} className="rounded-xl border border-line px-4 py-3">
              <div className="text-sm font-semibold">{plan}</div>
              <div className="text-2xl font-extrabold">{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

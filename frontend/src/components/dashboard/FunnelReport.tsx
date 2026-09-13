import { useEffect, useState } from "react";
import { analyticsApi, type Funnel } from "../../lib/api";

/**
 * The filtering funnel — the view that makes the protection visible. Instead of
 * a wall of tables, it answers the one question people actually have: "is this
 * doing anything?" — checked → reached the page → turned away, and why.
 */
export default function FunnelReport({ orgId, range, website }: {
  orgId: number; range: string; website: string;
}) {
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsApi.funnel(orgId, range, website)
      .then(setData).finally(() => setLoading(false));
  }, [orgId, range, website]);

  if (loading) {
    return <div className="card shadow-soft h-48 animate-pulse rounded-2xl bg-bg-mute/40" />;
  }
  if (!data || data.total === 0) {
    return (
      <div className="card shadow-soft p-6 text-sm text-fg-muted">
        No traffic checked in this period yet. Once visitors start arriving, this shows how
        many reached your page and how many were filtered out.
      </div>
    );
  }

  const pct = (n: number) => (data.total ? (n / data.total) * 100 : 0);
  const segs = [
    { key: "allowed", label: "Reached your page", count: data.passed, cls: "bg-success" },
    { key: "flagged", label: "Passed but flagged", count: data.flagged, cls: "bg-warning" },
    { key: "redirected", label: "Redirected away",
      count: data.stages.find((s) => s.key === "redirected")?.count ?? 0, cls: "bg-indigo-500" },
    { key: "blocked", label: "Blocked",
      count: data.stages.find((s) => s.key === "blocked")?.count ?? 0, cls: "bg-danger" },
  ].filter((s) => s.count > 0);

  const maxReason = Math.max(1, ...data.reasons.map((r) => r.count));

  return (
    <div className="card shadow-soft p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">Filtering funnel</h2>
        <span className="text-xs text-fg-dim">last {data.range.days} day{data.range.days === 1 ? "" : "s"}</span>
      </div>
      <p className="mt-1 text-sm text-fg-muted">
        What the engine did with your traffic — real visitors through, automated
        traffic turned away.
      </p>

      {/* headline tiles */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Tile label="Traffic checked" value={data.total.toLocaleString()} tone="neutral" />
        <Tile label="Reached your page" value={data.passed.toLocaleString()}
          sub={`${(data.pass_rate * 100).toFixed(1)}% of traffic`} tone="good" />
        <Tile label="Turned away" value={data.turned_away.toLocaleString()}
          sub={`${(data.filter_rate * 100).toFixed(1)}% filtered`} tone="bad" />
      </div>

      {/* proportion bar */}
      <div className="mt-6">
        <div className="flex h-4 w-full overflow-hidden rounded-full bg-bg-mute">
          {segs.map((s) => (
            <div key={s.key} className={s.cls} style={{ width: `${pct(s.count)}%` }}
              title={`${s.label}: ${s.count.toLocaleString()}`} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
          {segs.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${s.cls}`} />
              {s.label} <b className="text-fg">{s.count.toLocaleString()}</b>
            </span>
          ))}
        </div>
      </div>

      {/* why + classification */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Why traffic was turned away</h3>
          {data.reasons.length === 0 ? (
            <p className="mt-2 text-sm text-fg-muted">Nothing was filtered in this period.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.reasons.map((r) => (
                <li key={r.key} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span>{r.label}</span>
                    <span className="tabular-nums text-fg-muted">{r.count.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-bg-mute">
                    <div className="h-1.5 rounded-full bg-danger/70"
                      style={{ width: `${(r.count / maxReason) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold">By classification</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {data.by_classification.map((c) => (
              <li key={c.key} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${CLASS_DOT[c.key] || "bg-fg-dim"}`} />
                  <span className="capitalize">{c.key}</span>
                </span>
                <span className="tabular-nums text-fg-muted">{c.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const CLASS_DOT: Record<string, string> = {
  human: "bg-success", suspicious: "bg-warning", bot: "bg-indigo-500", fraud: "bg-danger",
};

function Tile({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone: "neutral" | "good" | "bad";
}) {
  const ring = tone === "good" ? "border-success/30 bg-success/5"
    : tone === "bad" ? "border-danger/30 bg-danger/5"
    : "border-line";
  const num = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-fg";
  return (
    <div className={`rounded-xl border p-4 ${ring}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-fg-dim">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold tabular-nums ${num}`}>{value}</div>
      {sub && <div className="text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}

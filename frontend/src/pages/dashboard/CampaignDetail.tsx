import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { campaignApi, type Campaign, type CampaignStats } from "../../lib/api";
import PageNote from "../../components/dashboard/PageNote";
import CampaignVariants from "../../components/dashboard/CampaignVariants";
import { useWorkspace } from "../../context/WorkspaceContext";
import Button from "../../components/ui/Button";
import ClassBadge from "../../components/ui/ClassBadge";

export default function CampaignDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { current } = useWorkspace();
  const [c, setC] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    const [camp, st] = await Promise.all([campaignApi.get(Number(id)), campaignApi.stats(Number(id))]);
    setC(camp); setStats(st);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  async function toggle() {
    if (!c) return;
    const updated = await campaignApi.update(c.id, { status: c.status === "active" ? "paused" : "active" });
    setC(updated);
  }
  async function remove() {
    if (!confirm("Delete this campaign?")) return;
    await campaignApi.remove(Number(id)); nav("/dashboard/campaigns");
  }

  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  async function scan() {
    setScanning(true); setScanMsg("");
    try {
      const r = await campaignApi.scanUrl(Number(id));
      if (!r.checked) { setScanMsg(r.detail || "URL scanning is not configured yet."); }
      else { setScanMsg(r.safe ? "Destination looks clean." : `Flagged: ${r.threats.join(", ")}`); await load(); }
    } finally { setScanning(false); }
  }

  if (!c || !stats) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

  const tiles = [
    ["Events", stats.events], ["Visitors", stats.visitors],
    ["Conversions", stats.conversions], ["Quality", `${(stats.quality * 100).toFixed(1)}%`],
    ["Flagged", stats.flagged],
  ];

  return (
    <div>
      <PageNote id="campaign-detail">This shows how this campaign is doing. <b>Quality</b> is the share of real visitors — if it's low, your ad may be attracting bots and wasting budget.</PageNote>
      <Link to="/dashboard/campaigns" className="text-sm text-fg-muted hover:text-brand">← Campaigns</Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{c.name}</h1>
          <p className="text-sm text-fg-muted capitalize">{c.traffic_source} · {c.website_name}
            <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-success/10 text-emerald-700" : "bg-bg-mute text-fg-muted"}`}>{c.status}</span>
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggle}>{c.status === "active" ? "Pause" : "Activate"}</Button>
            <button onClick={remove} className="rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-danger/5">Delete</button>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([k, v]) => (
          <div key={k as string} className="card shadow-soft p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{k}</div>
            <div className="mt-2 text-2xl font-extrabold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card shadow-soft p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Traffic classification</h2>
          {stats.events === 0 ? (
            <p className="mt-4 text-sm text-fg-muted">No attributed traffic yet. Traffic is matched by UTM campaign <code className="rounded bg-bg-mute px-1.5 py-0.5">{c.utm_campaign || "—"}</code>.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {Object.entries(stats.by_classification).map(([cls, n]) => {
                const pct = Math.round((n / stats.events) * 100);
                return (
                  <div key={cls}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <ClassBadge value={cls} /><span className="text-fg-muted">{n} · {pct}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-bg-mute">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card shadow-soft p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Configuration</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Destination", c.destination_url || "—"],
              ["Traffic source", c.traffic_source],
              ["UTM campaign", c.utm_campaign || "—"],
              ["Risk threshold", String(c.risk_threshold)],
              ["Country", c.country || "Any"],
              ["Created", new Date(c.created_at).toLocaleDateString()],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-fg-muted">{k}</dt><dd className="truncate text-right capitalize">{v}</dd></div>
            ))}
          </dl>

          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg-muted">Destination safety</span>
              {c.url_safe === null ? (
                <span className="rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-muted">Not scanned</span>
              ) : c.url_safe ? (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">Clean</span>
              ) : (
                <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600">Flagged</span>
              )}
            </div>
            {c.url_threats && c.url_threats.length > 0 && (
              <p className="mt-1 text-xs text-red-600">{c.url_threats.join(", ")}</p>
            )}
            {c.url_scanned_at && (
              <p className="mt-1 text-xs text-fg-dim">Last checked {new Date(c.url_scanned_at).toLocaleString()}</p>
            )}
            {canManage && (
              <div className="mt-3">
                <Button variant="outline" onClick={scan} disabled={scanning}>
                  {scanning ? "Checking…" : "Check destination safety"}
                </Button>
                {scanMsg && <p className="mt-2 text-xs text-fg-muted">{scanMsg}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      <CampaignVariants campaignId={c.id} canManage={canManage} />
    </div>
  );
}

import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { billingApi, type Usage } from "../../lib/api";
import PageNote from "../../components/dashboard/PageNote";

const levelTone: Record<string, { bar: string; text: string; msg: string }> = {
  ok: { bar: "bg-success", text: "text-emerald-700", msg: "You're well within your limit." },
  notice: { bar: "bg-warning", text: "text-amber-700", msg: "You've used over 70% of your plan." },
  warning: { bar: "bg-warning", text: "text-amber-700", msg: "You've used over 85% — consider upgrading soon." },
  critical: { bar: "bg-danger", text: "text-red-600", msg: "You've hit your plan limit. Upgrade to keep full coverage." },
};

export default function UsagePage() {
  const { current } = useWorkspace();
  const [u, setU] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    billingApi.usage(current.id).then(setU).finally(() => setLoading(false));
  }, [current?.id]);

  if (loading || !u) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

  const pct = Math.min(u.events.pct * 100, 100);
  const tone = levelTone[u.events.level];

  return (
    <div>
      <PageNote id="usage">
        This shows how much of your monthly allowance you've used. Each visit we analyze counts as one <b>event</b>. If you're getting close to the limit, upgrade your plan so we keep checking every visitor.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Usage</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Billing period {new Date(u.period.start).toLocaleDateString()} – {new Date(u.period.end).toLocaleDateString()} · {u.plan.name} plan
      </p>

      <div className="card shadow-soft mt-6 p-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Events processed</div>
            <div className="mt-1 text-3xl font-extrabold">{u.events.used.toLocaleString()} <span className="text-lg font-normal text-fg-dim">/ {u.events.limit.toLocaleString()}</span></div>
          </div>
          <div className={`text-sm font-semibold ${tone.text}`}>{(u.events.pct * 100).toFixed(1)}%</div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-bg-mute">
          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className={tone.text}>{tone.msg}</span>
          <span className="text-fg-muted">{u.events.remaining.toLocaleString()} events remaining</span>
        </div>
        {/* threshold markers */}
        <div className="mt-2 flex gap-4 text-xs text-fg-dim">
          <span>Alerts at 70%, 85%, 100%</span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Websites</div>
          <div className="mt-2 text-2xl font-extrabold">{u.websites.used}{u.websites.limit ? ` / ${u.websites.limit}` : ""}</div>
          <div className={`mt-1 text-xs ${u.websites.limit && u.websites.used >= u.websites.limit ? "font-semibold text-amber-700" : "text-fg-dim"}`}>
            {u.websites.limit
              ? (u.websites.used >= u.websites.limit ? "Trial limit reached — upgrade to add more" : "of your trial limit")
              : "Unlimited on your plan"}
          </div>
        </div>
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Campaigns</div>
          <div className="mt-2 text-2xl font-extrabold">{u.campaigns.used}{u.campaigns.limit ? ` / ${u.campaigns.limit}` : ""}</div>
          <div className={`mt-1 text-xs ${u.campaigns.limit && u.campaigns.used >= u.campaigns.limit ? "font-semibold text-amber-700" : "text-fg-dim"}`}>
            {u.campaigns.limit
              ? (u.campaigns.used >= u.campaigns.limit ? "Trial limit reached — upgrade to add more" : "of your trial limit")
              : "Unlimited on your plan"}
          </div>
        </div>
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Team members</div>
          <div className="mt-2 text-2xl font-extrabold">{u.team.used}{u.team.limit ? ` / ${u.team.limit}` : ""}</div>
          <div className="mt-1 text-xs text-fg-dim">{u.team.limit ? "of your plan" : "Unlimited"}</div>
        </div>
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Data retention</div>
          <div className="mt-2 text-2xl font-extrabold">{u.retention_days} days</div>
          <div className="mt-1 text-xs text-fg-dim">How long we keep your data</div>
        </div>
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Plan</div>
          <div className="mt-2 text-2xl font-extrabold">{u.plan.name}</div>
          <div className="mt-1 text-xs text-fg-dim">${u.plan.price}/month</div>
        </div>
      </div>
    </div>
  );
}

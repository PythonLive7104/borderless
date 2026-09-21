import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { billingApi, type Usage, type UsageLevel } from "../../lib/api";
import PageNote from "../../components/dashboard/PageNote";

const levelTone: Record<string, { bar: string; text: string; msg: string }> = {
  ok: { bar: "bg-success", text: "text-emerald-700", msg: "You're well within your limit." },
  notice: { bar: "bg-warning", text: "text-amber-700", msg: "You've used over 70% of your plan." },
  warning: { bar: "bg-warning", text: "text-amber-700", msg: "You've used over 85% — consider upgrading soon." },
  critical: { bar: "bg-danger", text: "text-red-600", msg: "You've hit your plan limit. Upgrade to keep full coverage." },
};

function Meter({ label, unit, m, secondary = false }: {
  label: string; unit: string; secondary?: boolean;
  m: { used: number; limit: number; pct: number; remaining: number; level: UsageLevel };
}) {
  const tone = levelTone[m.level];
  const pct = Math.min(m.pct * 100, 100);
  const unlimited = !m.limit;
  return (
    <div className={`card shadow-soft p-6 ${secondary ? "mt-4" : "mt-6"}`}>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{label}</div>
          <div className={`mt-1 font-extrabold ${secondary ? "text-2xl" : "text-3xl"}`}>
            {m.used.toLocaleString()}
            <span className="text-lg font-normal text-fg-dim">
              {unlimited ? " · unlimited" : ` / ${m.limit.toLocaleString()}`}
            </span>
          </div>
        </div>
        {!unlimited && <div className={`text-sm font-semibold ${tone.text}`}>{(m.pct * 100).toFixed(1)}%</div>}
      </div>
      {!unlimited && (
        <>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-bg-mute">
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className={tone.text}>{tone.msg}</span>
            <span className="text-fg-muted">{m.remaining.toLocaleString()} {unit} remaining</span>
          </div>
          <div className="mt-2 text-xs text-fg-dim">Alerts at 70%, 85%, 100%</div>
        </>
      )}
    </div>
  );
}

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

  return (
    <div>
      <PageNote id="usage">
        <b>Ad clicks</b> is what your plan is sold on: one for every visit that arrived from a paid ad, counted once per visitor session however many pages they then read. <b>Events</b> counts every visit we analyse, paid or not. If either gets close to its limit, upgrade so we keep checking every visitor.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Usage</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Billing period {new Date(u.period.start).toLocaleDateString()} – {new Date(u.period.end).toLocaleDateString()} · {u.plan.name} plan
      </p>

      {/* Ad clicks leads: it's the number on the pricing page and the one that
          compares to what the rest of the category sells. Events follows as the
          technical backstop — a site running no ads has zero ad clicks forever,
          so it can't be the only thing bounding usage. */}
      <Meter label="Ad clicks protected" unit="ad clicks" m={u.ad_clicks} />
      <Meter label="Events processed" unit="events" m={u.events} secondary />

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Websites</div>
          <div className="mt-2 text-2xl font-extrabold">{u.websites.used}{u.websites.limit ? ` / ${u.websites.limit}` : ""}</div>
          <div className={`mt-1 text-xs ${u.websites.limit && u.websites.used >= u.websites.limit ? "font-semibold text-amber-700" : "text-fg-dim"}`}>
            {u.websites.limit
              ? (u.websites.used >= u.websites.limit ? (u.on_trial ? "Trial limit reached — upgrade to add more" : "Plan limit reached — upgrade to add more") : (u.on_trial ? "of your trial limit" : "of your plan"))
              : "Unlimited on your plan"}
          </div>
        </div>
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Campaigns</div>
          <div className="mt-2 text-2xl font-extrabold">{u.campaigns.used}{u.campaigns.limit ? ` / ${u.campaigns.limit}` : ""}</div>
          <div className={`mt-1 text-xs ${u.campaigns.limit && u.campaigns.used >= u.campaigns.limit ? "font-semibold text-amber-700" : "text-fg-dim"}`}>
            {u.campaigns.limit
              ? (u.campaigns.used >= u.campaigns.limit ? (u.on_trial ? "Trial limit reached — upgrade to add more" : "Plan limit reached — upgrade to add more") : (u.on_trial ? "of your trial limit" : "of your plan"))
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

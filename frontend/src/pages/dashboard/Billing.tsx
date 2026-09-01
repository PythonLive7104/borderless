import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { billingApi, type Plan, type Subscription } from "../../lib/api";
import Button from "../../components/ui/Button";
import PageNote from "../../components/dashboard/PageNote";

const statusTone: Record<string, string> = {
  trialing: "bg-brand/10 text-brand", active: "bg-success/10 text-emerald-700", canceled: "bg-danger/10 text-red-600",
};

// Cumulative feature lists, mirroring the public pricing page.
const BASE = [
  "Real-time bot & fraud scoring",
  "JS + TLS/JA3 fingerprinting",
  "Traffic rules (country, device, OS, browser)",
  "IP allow / deny lists",
];
const GROWTH_ADD = [
  "A/B split testing with per-variant CVR",
  "Destination URL threat scanning",
  "Webhooks & full REST API",
  "Priority email support",
];
const BUSINESS_ADD = [
  "Guest access to statistics",
  "Higher rate limits",
  "Dedicated onboarding",
];
type Group = { label?: string; items: string[] };
const PLAN_FEATURES: Record<string, Group[]> = {
  starter: [{ items: BASE }],
  growth: [{ items: BASE }, { label: "Everything in Starter, plus:", items: GROWTH_ADD }],
  business: [
    { items: BASE },
    { label: "Everything in Growth, plus:", items: GROWTH_ADD },
    { label: "Plus advanced:", items: BUSINESS_ADD },
  ],
};
const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-brand"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function Billing() {
  const { current } = useWorkspace();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([billingApi.subscription(current.id), billingApi.plans()]);
      setSub(s); setPlans(p);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  async function change(slug: string) {
    if (!confirm(`Switch to the ${slug} plan?`)) return;
    const res = await billingApi.checkout(current!.id, slug);
    if (res.checkout_url) {
      window.location.href = res.checkout_url;  // redirect to Bachs hosted checkout
      return;
    }
    // activated instantly (free plan or dev without a payment key)
    setSub(await billingApi.subscription(current!.id));
  }
  async function cancel() {
    if (!confirm("Cancel your subscription?")) return;
    setSub(await billingApi.cancel(current!.id));
  }

  if (loading || !sub) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

  return (
    <div>
      <PageNote id="billing">
        Your plan decides how much traffic you can process each month. Pick the plan that fits — you can switch anytime. Payments run through <b>Bachs</b> (card, mobile money or crypto); until a live payment key is set, plan changes activate instantly.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-fg-muted">Manage your workspace subscription.</p>

      <div className="card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Current plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-extrabold">{sub.plan.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[sub.status]}`}>{sub.status}</span>
          </div>
          <div className="mt-1 text-sm text-fg-muted">${sub.plan.price}/month · renews {new Date(sub.period_end).toLocaleDateString()}</div>
        </div>
        {canManage && sub.status !== "canceled" && <Button variant="outline" onClick={cancel}>Cancel subscription</Button>}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.slug === sub.plan.slug;
          return (
            <div key={p.id} className={`card flex flex-col p-6 ${isCurrent ? "ring-2 ring-brand" : "shadow-soft"}`}>
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="mt-2 text-3xl font-extrabold">${p.price}<span className="text-sm font-normal text-fg-dim">/mo</span></div>

              {/* quantitative specs */}
              <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-bg-soft p-3 text-center">
                <div><dt className="text-[11px] uppercase tracking-wide text-fg-dim">Events/mo</dt><dd className="mt-0.5 text-sm font-bold">{(p.monthly_events / 1000).toLocaleString()}k</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wide text-fg-dim">Retention</dt><dd className="mt-0.5 text-sm font-bold">{p.retention_days}d</dd></div>
                <div><dt className="text-[11px] uppercase tracking-wide text-fg-dim">Team</dt><dd className="mt-0.5 text-sm font-bold">{p.team_members || "∞"}</dd></div>
              </dl>

              {/* cumulative feature groups */}
              <div className="mt-4 flex-1 space-y-3">
                {(PLAN_FEATURES[p.slug] || [{ items: BASE }]).map((g, gi) => (
                  <div key={gi}>
                    {g.label && <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-fg-dim">{g.label}</div>}
                    <ul className="space-y-1.5 text-sm">
                      {g.items.map((f) => (
                        <li key={f} className="flex gap-2 text-fg-muted"><Check /><span>{f}</span></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {isCurrent ? (
                <div className="mt-5 rounded-full bg-bg-mute py-2 text-center text-sm font-semibold text-fg-muted">Current plan</div>
              ) : canManage ? (
                <Button onClick={() => change(p.slug)} variant={p.price > sub.plan.price ? "primary" : "outline"} className="mt-5 w-full">
                  {p.price > sub.plan.price ? "Upgrade" : "Switch"}
                </Button>
              ) : <div className="mt-5 text-center text-xs text-fg-dim">Ask an admin to change plans</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

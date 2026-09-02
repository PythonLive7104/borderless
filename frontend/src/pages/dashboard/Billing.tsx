import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { billingApi, type Plan, type Subscription } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
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
  const [target, setTarget] = useState<Plan | null>(null); // plan being confirmed
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [params, setParams] = useSearchParams();
  const [payMsg, setPayMsg] = useState<{ kind: "confirming" | "done" | "cancelled"; text: string } | null>(null);
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

  // After returning from Bachs checkout, poll until the webhook activates the
  // plan, so the purchase reflects here without a manual refresh.
  useEffect(() => {
    const c = params.get("checkout");
    const clear = () => { params.delete("checkout"); setParams(params, { replace: true }); };
    if (!c || !current) return;
    if (c === "cancelled") { setPayMsg({ kind: "cancelled", text: "Checkout was cancelled — you have not been charged." }); clear(); return; }
    if (c !== "success") return;
    setPayMsg({ kind: "confirming", text: "Confirming your payment — this can take a few seconds…" });
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      try {
        const s = await billingApi.subscription(current.id);
        if (s.status === "active") {
          setSub(s);
          setPayMsg({ kind: "done", text: `Payment confirmed — you're now on the ${s.plan.name} plan. A receipt has been emailed to you.` });
          clearInterval(iv); clear(); return;
        }
      } catch { /* keep polling */ }
      if (tries >= 12) {
        setPayMsg({ kind: "confirming", text: "Payment received — your plan will update within a minute. Refresh the page, or contact support if it doesn't." });
        clearInterval(iv); clear();
      }
    }, 2000);
    return () => clearInterval(iv);
  /* eslint-disable-next-line */ }, [current?.id]);

  async function doChange() {
    if (!target) return;
    setBusy(true); setErr("");
    try {
      const res = await billingApi.checkout(current!.id, target.slug);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;  // redirect to Bachs hosted checkout
        return;
      }
      // activated instantly (free plan or no live payment key configured yet)
      setSub(await billingApi.subscription(current!.id));
      setTarget(null);
    } catch (e: any) { setErr(e.data?.detail || e.message || "Could not change plan. Please try again."); }
    finally { setBusy(false); }
  }
  async function doCancel() {
    setBusy(true); setErr("");
    try {
      setSub(await billingApi.cancel(current!.id));
      setCancelOpen(false);
    } catch (e: any) { setErr(e.data?.detail || e.message); } finally { setBusy(false); }
  }

  if (loading || !sub) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

  return (
    <div>
      <PageNote id="billing">
        Your plan decides how much traffic you can process each month. Pick the plan that fits — you can switch anytime. Payments run through <b>Bachs</b> (card, mobile money or crypto); until a live payment key is set, plan changes activate instantly.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-fg-muted">Manage your workspace subscription.</p>

      {payMsg && (
        <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          payMsg.kind === "done" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
          : payMsg.kind === "cancelled" ? "border-line bg-bg-soft text-fg-muted"
          : "border-brand/30 bg-brand/5 text-brand"}`}>
          {payMsg.kind === "confirming" && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          <span>{payMsg.kind === "done" ? "✅ " : ""}{payMsg.text}</span>
        </div>
      )}

      <div className="card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Current plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-extrabold">{sub.plan.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[sub.status]}`}>{sub.status}</span>
          </div>
          <div className="mt-1 text-sm text-fg-muted">${sub.plan.price}/month · renews {new Date(sub.period_end).toLocaleDateString()}</div>
        </div>
        {canManage && sub.status !== "canceled" && <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>}
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
                <Button onClick={() => { setErr(""); setTarget(p); }} variant={p.price > sub.plan.price ? "primary" : "outline"} className="mt-5 w-full">
                  {p.price > sub.plan.price ? "Upgrade" : "Switch"}
                </Button>
              ) : <div className="mt-5 text-center text-xs text-fg-dim">Ask an admin to change plans</div>}
            </div>
          );
        })}
      </div>

      {/* Plan-switch confirmation (replaces the browser confirm popup) */}
      <Modal open={!!target} onClose={() => !busy && setTarget(null)} title={target && sub && target.price > sub.plan.price ? "Upgrade your plan" : "Switch plan"}>
        {target && sub && (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              Move to the <b>{target.name}</b> plan at <b>${target.price}/month</b>
              {" "}({target.monthly_events.toLocaleString()} events/mo, {target.retention_days}-day retention).
            </p>
            <p className="rounded-lg bg-bg-soft px-3 py-2 text-xs text-fg-muted">
              You'll be taken to our secure checkout (Bachs) to pay — card, mobile money or crypto. Your plan
              activates as soon as payment succeeds. You can change or cancel anytime.
            </p>
            {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
              <Button className="flex-1" onClick={doChange} disabled={busy}>
                {busy ? "Starting…" : (target.price > sub.plan.price ? "Continue to payment" : "Switch plan")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel-subscription confirmation */}
      <Modal open={cancelOpen} onClose={() => !busy && setCancelOpen(false)} title="Cancel subscription">
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Your workspace will lose paid access at the end of the current billing period. You can resubscribe anytime.
          </p>
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)} disabled={busy}>Keep my plan</Button>
            <Button className="flex-1" onClick={doCancel} disabled={busy}>{busy ? "Cancelling…" : "Cancel subscription"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

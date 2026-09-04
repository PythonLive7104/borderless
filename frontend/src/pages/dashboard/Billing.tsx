import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { type BillingInterval, billingApi, type Plan, type Subscription } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import IntervalToggle from "../../components/ui/IntervalToggle";
import PageNote from "../../components/dashboard/PageNote";
import { ILink, IGlobe } from "../../components/ui/icons";

const statusTone: Record<string, string> = {
  trialing: "bg-brand/10 text-brand", active: "bg-success/10 text-emerald-700", canceled: "bg-danger/10 text-red-600",
};

// Per-tier feature lists (cumulative). `muted` rows render a hollow check, like
// the "Everything in <lower tier>" roll-up lines.
type Feat = { text: string; muted?: boolean };
const PLAN_FEATURES: Record<string, Feat[]> = {
  basic: [
    { text: "Smart redirects with bot detection on every click" },
    { text: "Full anti-bot engine included" },
    { text: "Smart shortlinks + custom domain redirects" },
    { text: "IP allow / deny rules" },
    { text: "Domain health + ownership checks" },
  ],
  plus: [
    { text: "Smart redirects with bot detection on every click" },
    { text: "Full anti-bot engine included" },
    { text: "Everything in Basic", muted: true },
    { text: "Priority support" },
  ],
  pro: [
    { text: "Smart redirects with bot detection on every click" },
    { text: "Full anti-bot engine included" },
    { text: "Everything in Plus", muted: true },
    { text: "Dedicated support" },
  ],
};

const CheckFull = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-brand"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const CheckHollow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-fg-dim"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M8.5 12l2.4 2.4 4.6-4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function Spec({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-bg-soft/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-dim">
        <span className="text-fg-muted">{icon}</span>{label}
      </div>
      <div className="mt-1 text-lg font-extrabold tabular-nums">{value || "∞"}</div>
    </div>
  );
}

export default function Billing() {
  const { current } = useWorkspace();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  // Which interval the buy buttons purchase. Defaults to what they're already
  // on, so "Renew" renews like-for-like instead of silently switching them.
  const [interval, setBillingInterval] = useState<BillingInterval>("weekly");
  const monthly = interval === "monthly";
  const priceOf = (p: Plan) => (monthly ? p.price_monthly : p.price);
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
      if (s.interval) setBillingInterval(s.interval);
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
      const res = await billingApi.checkout(current!.id, target.slug, interval);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;  // redirect to Bachs hosted checkout
        return;
      }
      // activated instantly (no live payment key configured yet)
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

  const isCurrentSlug = sub.plan.slug;
  const daysLeft = sub.access?.days_left ?? null;

  return (
    <div>
      <PageNote id="billing">
        Every plan is <b>weekly</b> — 7 days of access, renew when it runs out. Payments run through <b>Bachs</b> (card, mobile money or crypto); until a live payment key is set, plan changes activate instantly.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Billing</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Days you have left are added to whatever you buy next — you never lose time by renewing early or changing tier.
      </p>

      {payMsg && (
        <div className={`mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
          payMsg.kind === "done" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700"
          : payMsg.kind === "cancelled" ? "border-line bg-bg-soft text-fg-muted"
          : "border-brand/30 bg-brand/5 text-brand"}`}>
          {payMsg.kind === "confirming" && <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          <span>{payMsg.kind === "done" ? "✅ " : ""}{payMsg.text}</span>
        </div>
      )}

      {/* current-plan summary */}
      <div className="card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Current plan</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-extrabold">{sub.plan.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[sub.status]}`}>{sub.status}</span>
            <span className="rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-muted">{sub.interval}</span>
          </div>
          <div className="mt-1 text-sm text-fg-muted">
            ${sub.interval === "monthly" ? sub.plan.price_monthly : sub.plan.price}/{sub.interval === "monthly" ? "month" : "week"} · {daysLeft != null ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} of access left` : "renew when it runs out"}
            {sub.period_end && ` · access through ${new Date(sub.period_end).toLocaleDateString()}`}
          </div>
        </div>
        {canManage && sub.status !== "canceled" && <Button variant="outline" onClick={() => setCancelOpen(true)}>Cancel subscription</Button>}
      </div>

      {/* pricing tiers */}
      <div className="mt-8 flex justify-center">
        <IntervalToggle value={interval} onChange={setBillingInterval} savings="Save up to 46%" />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.slug === isCurrentSlug;
          const feats = PLAN_FEATURES[p.slug] || [];
          return (
            <div key={p.id} className={`card relative flex flex-col p-6 ${isCurrent ? "ring-2 ring-brand" : "shadow-soft"}`}>
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-fg px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-bg">Current plan</span>
              )}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="mt-1 flex items-end gap-1">
                <span className="text-3xl font-extrabold">${priceOf(p)}</span>
                <span className="pb-1 text-sm text-fg-dim">/{monthly ? "month" : "week"}</span>
              </div>
              <div className="mt-0.5 text-xs text-fg-dim">{monthly ? "30" : "7"} days of access</div>

              {/* redirects / domains caps */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Spec icon={<ILink width={13} />} label="Redirects" value={p.max_redirects} />
                <Spec icon={<IGlobe width={13} />} label="Domains" value={p.max_websites} />
              </div>

              {/* features */}
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {feats.map((f) => (
                  <li key={f.text} className={`flex gap-2 ${f.muted ? "text-fg-dim" : "text-fg-muted"}`}>
                    {f.muted ? <CheckHollow /> : <CheckFull />}<span>{f.text}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="mt-5">
                  {canManage ? (
                    <Button className="w-full" onClick={() => { setErr(""); setTarget(p); }}>Renew {p.name}</Button>
                  ) : (
                    <div className="rounded-full bg-bg-mute py-2 text-center text-sm font-semibold text-fg-muted">Current plan</div>
                  )}
                  <Link to="/dashboard/shield" className="mt-2 block text-center text-xs font-semibold text-fg-muted hover:text-brand">Configure anti-bot</Link>
                </div>
              ) : canManage ? (
                <Button onClick={() => { setErr(""); setTarget(p); }} variant={p.price > sub.plan.price ? "primary" : "outline"}  /* tier order, not interval */ className="mt-5 w-full">
                  Switch to {p.name} (week)
                </Button>
              ) : <div className="mt-5 text-center text-xs text-fg-dim">Ask an admin to change plans</div>}
            </div>
          );
        })}
      </div>

      {/* Plan-switch / renew confirmation */}
      <Modal open={!!target} onClose={() => !busy && setTarget(null)} title={target && target.slug === sub.plan.slug ? `Renew ${target.name}` : "Switch plan"}>
        {target && sub && (
          <div className="space-y-4">
            <p className="text-sm text-fg-muted">
              {target.slug === sub.plan.slug ? "Renew" : "Move to"} the <b>{target.name}</b> plan at <b>${priceOf(target)}/{monthly ? "month" : "week"}</b>
              {" "}({target.max_redirects || "∞"} redirects, {target.max_websites || "∞"} domains).
            </p>
            <p className="rounded-lg bg-bg-soft px-3 py-2 text-xs text-fg-muted">
              You'll be taken to our secure checkout (Bachs) — card, mobile money or crypto. Access starts as
              soon as payment succeeds, for {monthly ? 30 : 7} days. Any days you have left are added on top, so you never lose time.
            </p>
            {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setTarget(null)} disabled={busy}>Cancel</Button>
              <Button className="flex-1" onClick={doChange} disabled={busy}>
                {busy ? "Starting…" : "Continue to payment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel-subscription confirmation */}
      <Modal open={cancelOpen} onClose={() => !busy && setCancelOpen(false)} title="Cancel subscription">
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">
            Your workspace keeps access until the end of the current 7-day period, then won't renew. You can resubscribe anytime.
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

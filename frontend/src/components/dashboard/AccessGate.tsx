import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { billingApi, type AccessState } from "../../lib/api";

const BILLING_PATH = "/dashboard/billing";

export default function AccessGate({ children }: { children: ReactNode }) {
  const { current } = useWorkspace();
  const loc = useLocation();
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    if (!current) return;
    billingApi.subscription(current.id)
      .then((s) => { if (alive) { setAccess(s.access); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [current?.id, loc.pathname]);

  // Until we know, render normally to avoid a flash.
  if (!loaded || !access) return <>{children}</>;

  const onBilling = loc.pathname.startsWith(BILLING_PATH);

  // Locked: block every page except Billing (so they can still pay).
  if (access.locked && !onBilling) {
    const canceled = access.reason === "canceled";
    return (
      <div className="grid min-h-[60vh] place-items-center px-4">
        <div className="card shadow-soft max-w-md p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl">🔒</div>
          <h2 className="mt-4 text-xl font-extrabold tracking-tight">
            {canceled ? "Subscription canceled" : "Your free trial has ended"}
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            {canceled
              ? "Reactivate a plan to regain access to your workspace, traffic data and rules."
              : "Thanks for trying TrackAudit! Choose a plan to keep filtering traffic and unlock your dashboard again."}
          </p>
          <Link to={BILLING_PATH}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">
            {canceled ? "Reactivate a plan" : "Choose a plan"}
          </Link>
          <p className="mt-3 text-xs text-fg-dim">Your data is safe and returns the moment you subscribe.</p>
        </div>
      </div>
    );
  }

  // Trial in progress: gentle banner with days left.
  const banner = access.reason === "trialing" && (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm">
      <span className="text-amber-800">
        <b>{access.days_left}</b> day{access.days_left === 1 ? "" : "s"} left in your free trial.
      </span>
      {!onBilling && (
        <Link to={BILLING_PATH} className="font-semibold text-amber-900 underline hover:no-underline">Upgrade now →</Link>
      )}
    </div>
  );

  return <>{banner}{children}</>;
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useDialog } from "../../context/DialogContext";
import { billingApi, type AccessState } from "../../lib/api";

const BILLING_PATH = "/dashboard/billing";

export default function AccessGate({ children }: { children: ReactNode }) {
  const { current } = useWorkspace();
  const loc = useLocation();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const promptOpen = useRef(false);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    if (!current) return;
    billingApi.subscription(current.id)
      .then((s) => { if (alive) { setAccess(s.access); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [current?.id, loc.pathname]);

  // A locked workspace can still browse — the server allows reads and refuses
  // writes. When a write is refused, api.ts fires this event; we turn that into
  // one clear "renew to continue" prompt instead of a raw error on the button.
  useEffect(() => {
    const onBlocked = async () => {
      if (promptOpen.current) return;         // don't stack on rapid clicks
      promptOpen.current = true;
      const go = await confirm({
        title: "Renew to make changes",
        message: "Your access period has ended. You can still look around, but "
          + "creating or changing things needs an active plan. Your data is safe "
          + "and everything resumes the moment you renew.",
        confirmLabel: "Go to Billing",
        cancelLabel: "Not now",
        tone: "brand",
      });
      promptOpen.current = false;
      if (go) navigate(BILLING_PATH);
    };
    window.addEventListener("tnb:access-blocked", onBlocked);
    return () => window.removeEventListener("tnb:access-blocked", onBlocked);
  }, [confirm, navigate]);

  // Until we know, render normally to avoid a flash.
  if (!loaded || !access) return <>{children}</>;

  const onBilling = loc.pathname.startsWith(BILLING_PATH);

  // Locked: DON'T wall off the dashboard. Let them see the product (all reads
  // work) with a clear banner, and let the per-action prompt above handle the
  // moment they try to change something. Walling every page off just made
  // people leave before they saw what they'd be paying for.
  if (access.locked && !onBilling) {
    const canceled = access.reason === "canceled";
    const lapsed = access.reason === "period_ended";
    return (
      <>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-lg">🔒</span>
            <div className="text-sm">
              <div className="font-bold text-amber-900">
                {canceled ? "Subscription canceled"
                 : lapsed ? "Your access period has ended"
                 : "Your free trial has ended"}
              </div>
              <div className="text-amber-800">
                You can still look around. Renewing turns your protection back on and
                lets you make changes again — your data is all still here.
              </div>
            </div>
          </div>
          <Link to={BILLING_PATH}
            className="shrink-0 inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600">
            {canceled ? "Reactivate a plan" : lapsed ? "Renew now" : "Choose a plan"}
          </Link>
        </div>
        {children}
      </>
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

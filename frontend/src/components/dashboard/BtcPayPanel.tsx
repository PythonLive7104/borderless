import { useEffect, useState } from "react";
import { billingApi, type BillingInterval, type BtcPayment } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";

/* Pay for a plan by sending Bitcoin to our address; an admin confirms receipt
 * and the plan activates then — not before.
 *
 * Deliberately honest about the wait: the panel never claims the plan is active.
 * It shows "awaiting confirmation" until an admin confirms, because that is
 * exactly what happens on the server — creating a payment grants no access.
 *
 * Shown only when the server offers the "bitcoin" method (a wallet is
 * configured); the parent passes `enabled` from the payment-methods call.
 */
export default function BtcPayPanel({ orgId, plan, interval, enabled, canManage }: {
  orgId: number; plan: string; interval: BillingInterval; enabled: boolean; canManage: boolean;
}) {
  const { notify } = useDialog();
  const [payment, setPayment] = useState<BtcPayment | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function load() {
    try { setPayment((await billingApi.btcStatus(orgId)).payment); } catch { /* ignore */ }
  }
  useEffect(() => { if (enabled) load(); /* eslint-disable-next-line */ }, [orgId, enabled]);

  if (!enabled) return null;

  async function start() {
    setBusy(true);
    try {
      const p = await billingApi.btcStart(orgId, plan, interval);
      setPayment(p);
    } catch (e: any) {
      notify(e?.data?.detail || "Couldn't start the payment.", "danger");
    } finally { setBusy(false); }
  }

  const pending = payment && payment.status === "pending";

  async function copy() {
    if (!payment) return;
    try { await navigator.clipboard.writeText(payment.address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* selectable anyway */ }
  }

  return (
    <div className="card shadow-soft mt-5 border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">₿</span>
        <h3 className="text-sm font-bold">Pay with Bitcoin</h3>
      </div>

      {pending ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-fg-muted">
            Send <b className="text-fg">${payment!.amount_usd}</b> worth of Bitcoin to the address
            below. Your <b>{payment!.plan_name}</b> plan activates once we confirm the payment —
            usually within a few hours.
          </p>
          <div className="rounded-lg bg-bg-soft p-3">
            <div className="text-xs font-semibold text-fg-dim">Send to this address</div>
            <button onClick={copy}
              className="mt-1 w-full break-all rounded bg-white px-2 py-1.5 text-left font-mono text-xs hover:ring-1 hover:ring-amber-500/40">
              {payment!.address} {copied && <span className="text-emerald-600">✓ copied</span>}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            Awaiting confirmation — nothing else for you to do. You can leave this page.
          </div>
          <button onClick={load} className="text-xs font-semibold text-brand hover:underline">
            Refresh status
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-fg-muted">
            Prefer crypto to your own wallet? Send Bitcoin directly and we'll activate your plan
            once it arrives. {payment?.status === "confirmed" && <b className="text-emerald-700">Your last Bitcoin payment was confirmed.</b>}
          </p>
          {canManage ? (
            <button onClick={start} disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10">
              {busy ? "Starting…" : "Pay with Bitcoin"}
            </button>
          ) : (
            <p className="mt-2 text-xs text-fg-dim">Only Owners and Admins can start a payment.</p>
          )}
        </div>
      )}
    </div>
  );
}

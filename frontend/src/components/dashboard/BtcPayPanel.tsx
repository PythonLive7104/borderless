import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { billingApi, type BillingInterval, type BtcPayment, type PaymentMethods, type Plan } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";
import Modal from "../ui/Modal";
import { INTERVAL_DAYS, INTERVAL_NOUN, priceFor } from "../../lib/billing";
import { feeOn } from "../../lib/usePaymentMethods";

/* Pay for a plan with Bitcoin. An admin confirms receipt and the plan activates
 * then — never before.
 *
 * The flow is deliberately a two-step popup rather than a one-click button,
 * because the button was the bug: clicking it committed you to whatever plan and
 * interval happened to be selected, with no chance to choose and no sight of the
 * duration. Now you pick plan + duration, see the exact amount, and only then
 * generate the address. Nothing is created on the server until that second step.
 */

const INTERVALS: BillingInterval[] = ["weekly", "monthly", "yearly"];

export default function BtcPayPanel({ orgId, plans, enabled, canManage, methods, defaultPlan, defaultInterval }: {
  orgId: number;
  plans: Plan[];
  enabled: boolean;
  canManage: boolean;
  methods: PaymentMethods | null;   // for the processing-fee figure
  defaultPlan?: string;
  defaultInterval?: BillingInterval;
}) {
  const { notify } = useDialog();
  const [open, setOpen] = useState(false);
  const [planSlug, setPlanSlug] = useState(defaultPlan || "");
  const [interval, setInterval] = useState<BillingInterval>(defaultInterval || "weekly");
  const [created, setCreated] = useState<BtcPayment | null>(null);   // address view after generating
  const [pending, setPending] = useState<BtcPayment | null>(null);   // existing unpaid request
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Default the plan selection to the first real (priced) plan.
  useEffect(() => {
    if (!planSlug && plans.length) {
      const first = plans.find((p) => priceFor(p, interval) > 0) || plans[0];
      setPlanSlug(first.slug);
    }
    /* eslint-disable-next-line */
  }, [plans]);

  async function loadStatus() {
    try {
      const { payment } = await billingApi.btcStatus(orgId);
      setPending(payment && payment.status === "pending" ? payment : null);
    } catch { /* ignore */ }
  }
  useEffect(() => { if (enabled) loadStatus(); /* eslint-disable-next-line */ }, [orgId, enabled]);

  if (!enabled) return null;

  const plan = plans.find((p) => p.slug === planSlug) || null;
  const base = plan ? priceFor(plan, interval) : 0;
  const fee = feeOn(methods, base);
  const total = Math.round((base + fee) * 100) / 100;
  const offered = (p: Plan, iv: BillingInterval) => priceFor(p, iv) > 0;

  async function generate() {
    if (!plan) return;
    setBusy(true);
    try {
      const p = await billingApi.btcStart(orgId, plan.slug, interval);
      setCreated(p);
      setPending(p);
    } catch (e: any) {
      notify(e?.data?.detail || "Couldn't start the payment.", "danger");
    } finally { setBusy(false); }
  }

  async function copy(addr: string) {
    try { await navigator.clipboard.writeText(addr); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* selectable anyway */ }
  }

  function openPicker() {
    setCreated(null);
    setOpen(true);
  }

  return (
    <div className="card shadow-soft mt-5 border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Bitcoin mark: big, brand-orange, with an animated glow behind a
              crisp badge (the blur layer pulses; the badge stays sharp). */}
          <span className="relative grid h-12 w-12 shrink-0 place-items-center">
            <span aria-hidden
              className="absolute inset-0 rounded-full bg-[#F7931A] opacity-60 blur-lg animate-pulse" />
            <span aria-hidden
              className="relative grid h-12 w-12 place-items-center rounded-full text-3xl font-black leading-none text-white"
              style={{
                background: "linear-gradient(135deg,#F7931A,#FBB03B)",
                boxShadow: "0 0 16px 3px rgba(247,147,26,0.65), inset 0 0 0 1px rgba(255,255,255,0.25)",
              }}>
              ₿
            </span>
          </span>
          <div>
            <h3 className="text-sm font-bold">Pay with Bitcoin</h3>
            <p className="text-xs text-fg-muted">Choose a plan and duration, send Bitcoin, we confirm it.</p>
          </div>
        </div>
        {canManage ? (
          <button onClick={openPicker}
            className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-500/10">
            Pay with Bitcoin
          </button>
        ) : (
          <span className="text-xs text-fg-dim">Owners and Admins only</span>
        )}
      </div>

      {/* A standing reminder when a payment is still awaiting confirmation. */}
      {pending && (
        <button onClick={() => { setCreated(pending); setOpen(true); }}
          className="mt-3 flex w-full items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-500/15">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
          A ${pending.amount_usd} {pending.plan_name} ({INTERVAL_NOUN[pending.interval]}) Bitcoin payment is awaiting confirmation — tap to see the address.
        </button>
      )}

      <Modal open={open} onClose={() => !busy && setOpen(false)}
        title={created ? "Send your Bitcoin" : "Pay with Bitcoin"}>
        {created ? (
          <AddressView payment={created} copied={copied} onCopy={copy} onRefresh={loadStatus} />
        ) : (
          <div className="space-y-5">
            {/* Plan */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Plan</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {plans.map((p) => {
                  const selected = p.slug === planSlug;
                  return (
                    <button key={p.slug} onClick={() => setPlanSlug(p.slug)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selected ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`}>
                      <div className="text-sm font-bold">{p.name}</div>
                      <div className="text-xs text-fg-muted">${priceFor(p, interval)}/{INTERVAL_NOUN[interval]}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Duration */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Duration</div>
              <div className="mt-2 inline-flex rounded-xl border border-line p-1">
                {INTERVALS.filter((iv) => !plan || offered(plan, iv)).map((iv) => (
                  <button key={iv} onClick={() => setInterval(iv)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
                      interval === iv ? "bg-brand text-white" : "text-fg-muted hover:text-fg"}`}>
                    {iv}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-xs text-fg-dim">{INTERVAL_DAYS[interval]} days of access</div>
            </div>

            {/* Amount */}
            <div className="rounded-xl bg-bg-soft p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-muted">{plan?.name} · {INTERVAL_NOUN[interval]}</span>
                <span className="font-semibold">${base.toFixed(2)}</span>
              </div>
              {fee > 0 && (
                <div className="mt-1 flex items-center justify-between text-xs text-fg-dim">
                  <span>Processing fee</span><span>${fee.toFixed(2)}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
                <span className="text-sm font-bold">You send</span>
                <span className="text-lg font-extrabold">${total.toFixed(2)} in BTC</span>
              </div>
            </div>

            <button onClick={generate} disabled={busy || !plan || total <= 0}
              className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
              {busy ? "Preparing…" : "Get the Bitcoin address →"}
            </button>
            <p className="text-center text-xs text-fg-dim">
              Nothing is charged yet. Your plan activates after we confirm the payment.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function AddressView({ payment, copied, onCopy, onRefresh }: {
  payment: BtcPayment; copied: boolean; onCopy: (a: string) => void; onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">
        Send <b className="text-fg">${payment.amount_usd}</b> worth of Bitcoin for your{" "}
        <b className="text-fg">{payment.plan_name}</b> plan ({INTERVAL_NOUN[payment.interval]},{" "}
        {INTERVAL_DAYS[payment.interval]} days). It activates once we confirm the payment — usually
        within a few hours.
      </p>
      {/* Scan to pay. `bitcoin:<address>` is the BIP-21 URI wallets expect, so a
          scan opens the wallet pre-filled with the address rather than dropping
          the user on a raw string they have to paste. White padding (quiet zone)
          around the code is required for scanners to read it. */}
      <div className="flex justify-center">
        <div className="rounded-xl bg-white p-3">
          <QRCodeSVG value={`bitcoin:${payment.address}`} size={176} level="M"
            aria-label="Bitcoin address QR code" />
        </div>
      </div>
      <div className="rounded-lg bg-bg-soft p-3">
        <div className="text-xs font-semibold text-fg-dim">Or copy the address</div>
        <button onClick={() => onCopy(payment.address)}
          className="mt-1 w-full break-all rounded bg-white px-2 py-1.5 text-left font-mono text-xs hover:ring-1 hover:ring-amber-500/40">
          {payment.address} {copied && <span className="text-emerald-600">✓ copied</span>}
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-800">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        Awaiting confirmation — nothing else for you to do. You can leave this page.
      </div>
      <button onClick={onRefresh} className="text-xs font-semibold text-brand hover:underline">
        Refresh status
      </button>
    </div>
  );
}

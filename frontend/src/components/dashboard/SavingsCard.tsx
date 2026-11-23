import { useEffect, useState } from "react";
import { analyticsApi, orgApi, type Savings } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";

/* The headline that makes a customer renew: "here's roughly how much ad spend we
 * kept from being wasted."
 *
 * Deliberately honest, because the category inflates this number:
 *  - it counts only PAID clicks we scored INVALID (real buyers and organic bots
 *    are excluded on the server),
 *  - the dollar figure is an ESTIMATE = invalid paid clicks x the customer's own
 *    average CPC, and the assumption is printed under it,
 *  - with no CPC set it shows the click count and asks for the CPC instead of
 *    inventing a price,
 *  - the wording is "kept from being wasted / identified", never "recovered" — a
 *    block prevents future waste, it doesn't refund a click already billed.
 */
export default function SavingsCard({ orgId }: { orgId: number }) {
  const { notify } = useDialog();
  const [data, setData] = useState<Savings | null>(null);
  const [editing, setEditing] = useState(false);
  const [cpc, setCpc] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setData(await analyticsApi.savings(orgId, "30d")); } catch { /* ignore */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  if (!data) return null;

  async function saveCpc() {
    const v = parseFloat(cpc);
    if (!(v >= 0)) { notify("Enter a valid cost per click, e.g. 2.50"); return; }
    setBusy(true);
    try {
      await orgApi.update(orgId, { avg_cpc: v } as any);
      setEditing(false);
      await load();
    } catch (e: any) {
      notify(e?.data?.detail || "Couldn't save that.", "danger");
    } finally { setBusy(false); }
  }

  const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="card shadow-soft mb-6 overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-brand/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Ad spend protected · last 30 days
          </div>
          {data.has_cpc && data.estimated_savings !== null ? (
            <div className="mt-1 text-4xl font-extrabold tracking-tight">
              ~{money(data.estimated_savings)}
            </div>
          ) : (
            <div className="mt-1 text-4xl font-extrabold tracking-tight">
              {data.invalid_paid_clicks.toLocaleString()}
              <span className="ml-2 text-base font-semibold text-fg-muted">invalid paid clicks caught</span>
            </div>
          )}
          <p className="mt-1 text-xs text-fg-muted">{data.basis}</p>
        </div>

        <div className="text-right text-sm">
          <div><b>{data.paid_clicks.toLocaleString()}</b> <span className="text-fg-dim">paid clicks</span></div>
          <div><b>{data.invalid_paid_clicks.toLocaleString()}</b> <span className="text-fg-dim">scored invalid ({Math.round(data.invalid_rate * 100)}%)</span></div>
          <div><b>{data.blocked_paid_clicks.toLocaleString()}</b> <span className="text-fg-dim">actively blocked</span></div>
        </div>
      </div>

      {/* CPC control: the one number we can't measure, so the customer supplies it. */}
      <div className="mt-4 border-t border-emerald-500/20 pt-3 text-sm">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-fg-muted">Your average cost per click:</span>
            <span className="text-fg-dim">$</span>
            <input value={cpc} onChange={(e) => setCpc(e.target.value)} inputMode="decimal"
              placeholder="2.50" className="w-24 rounded-lg border border-line bg-white px-2 py-1 text-sm" />
            <button onClick={saveCpc} disabled={busy}
              className="rounded-lg bg-brand px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
              {busy ? "…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-fg-dim hover:underline">Cancel</button>
          </div>
        ) : data.has_cpc ? (
          <span className="text-fg-muted">
            Based on your average CPC of {money(data.avg_cpc!)}.{" "}
            <button onClick={() => { setCpc(String(data.avg_cpc)); setEditing(true); }}
              className="font-semibold text-brand hover:underline">Change</button>
          </span>
        ) : (
          <span className="text-fg-muted">
            <button onClick={() => setEditing(true)} className="font-semibold text-brand hover:underline">
              Set your average cost-per-click
            </button>{" "}
            to see the estimated dollar value of the clicks we caught.
          </span>
        )}
      </div>
    </section>
  );
}

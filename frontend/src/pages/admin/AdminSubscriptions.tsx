import { useEffect, useState } from "react";
import { adminApi, billingApi, type AdminSub, type Plan } from "../../lib/api";

const statusTone: Record<string, string> = {
  trialing: "bg-brand/10 text-brand", active: "bg-success/10 text-emerald-700", canceled: "bg-danger/10 text-red-600",
};

export default function AdminSubscriptions() {
  const [rows, setRows] = useState<AdminSub[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null);

  async function load() { setRows(await adminApi.subscriptions()); }
  useEffect(() => { load(); billingApi.plans().then(setPlans); }, []);

  const mrr = rows.filter((r) => r.status === "active").reduce((a, r) => a + r.price, 0);

  async function grant(orgId: number, slug: string) {
    setBusy(orgId); setNote(null);
    try {
      const res = await adminApi.grantPlan(orgId, slug);
      await load();
      setNote({ id: orgId, text: res.detail });
    } catch {
      setNote({ id: orgId, text: "Failed to grant plan." });
    } finally { setBusy(null); }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Subscriptions</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {rows.length} subscriptions · <b>${mrr.toLocaleString()}/mo</b> from active plans.
        Use <b>Grant plan</b> to put any workspace on any plan instantly (no payment).
      </p>
      <div className="card shadow-soft mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
              <tr>
                <th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Plan</th><th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Access</th>
                <th className="px-4 py-3">Trial ends</th><th className="px-4 py-3">Grant plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-bg-soft">
                  <td className="px-4 py-3 font-semibold">{s.organization}</td>
                  <td className="px-4 py-3 text-fg-muted">{s.owner}</td>
                  <td className="px-4 py-3">{s.plan}</td>
                  <td className="px-4 py-3 tabular-nums">${s.price}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[s.status] || "bg-bg-mute"}`}>{s.status}</span></td>
                  <td className="px-4 py-3">{s.locked
                    ? <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600">locked</span>
                    : <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">active</span>}</td>
                  <td className="px-4 py-3 text-fg-muted">{s.trial_end ? new Date(s.trial_end).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-lg border border-line bg-bg px-2 py-1 text-xs"
                        disabled={busy === s.organization_id}
                        defaultValue=""
                        onChange={(e) => { const v = e.target.value; if (v) grant(s.organization_id, v); e.target.value = ""; }}
                      >
                        <option value="" disabled>Set plan…</option>
                        {plans.map((p) => (
                          <option key={p.slug} value={p.slug}>{p.name} — ${p.price}/mo</option>
                        ))}
                      </select>
                      {busy === s.organization_id && <span className="text-xs text-fg-dim">saving…</span>}
                    </div>
                    {note?.id === s.organization_id && <p className="mt-1 text-xs text-emerald-700">{note.text}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { adminApi, type AdminFraudAlert } from "../../lib/api";

const classTone: Record<string, string> = {
  bot: "bg-danger/10 text-red-600", fraud: "bg-danger/20 text-red-700",
};

export default function AdminFraudAlerts() {
  const [rows, setRows] = useState<AdminFraudAlert[]>([]);
  useEffect(() => { adminApi.fraudAlerts().then(setRows); }, []);
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Fraud alerts</h1>
      <p className="mt-1 text-sm text-fg-muted">The {rows.length} most recent bot/fraud visits across all workspaces.</p>
      <div className="card shadow-soft mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
              <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Site</th><th className="px-4 py-3">IP</th><th className="px-4 py-3">Ctry</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Signals</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-10 text-center text-fg-muted">No bot or fraud traffic recorded yet.</td></tr>}
              {rows.map((e) => (
                <tr key={e.id} className="hover:bg-bg-soft">
                  <td className="px-4 py-3 whitespace-nowrap text-fg-muted">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-semibold">{e.organization}</td>
                  <td className="px-4 py-3 text-fg-muted">{e.website}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.ip || "—"}</td>
                  <td className="px-4 py-3">{e.country || "—"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${classTone[e.classification] || "bg-bg-mute"}`}>{e.classification}</span></td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{e.risk_score ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{e.action}</td>
                  <td className="px-4 py-3 text-xs text-fg-muted">{(e.signals || []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { adminApi, type AdminOrg } from "../../lib/api";

const statusTone: Record<string, string> = {
  trialing: "bg-brand/10 text-brand", active: "bg-success/10 text-emerald-700", canceled: "bg-danger/10 text-red-600",
};

export default function AdminOrgs() {
  const [rows, setRows] = useState<AdminOrg[]>([]);
  useEffect(() => { adminApi.organizations().then(setRows); }, []);
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Organizations</h1>
      <p className="mt-1 text-sm text-fg-muted">{rows.length} workspaces.</p>
      <div className="card shadow-soft mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
              <tr><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Members</th><th className="px-4 py-3">Sites</th><th className="px-4 py-3">Created</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-bg-soft">
                  <td className="px-4 py-3 font-semibold">{o.name}</td>
                  <td className="px-4 py-3 text-fg-muted">{o.owner}</td>
                  <td className="px-4 py-3">{o.plan}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[o.status] || "bg-bg-mute"}`}>{o.status}</span></td>
                  <td className="px-4 py-3">{o.members}</td>
                  <td className="px-4 py-3">{o.websites}</td>
                  <td className="px-4 py-3 text-fg-muted">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

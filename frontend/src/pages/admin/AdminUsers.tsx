import { useEffect, useState } from "react";
import { adminApi, type AdminUser } from "../../lib/api";

export default function AdminUsers() {
  const [rows, setRows] = useState<AdminUser[]>([]);
  useEffect(() => { adminApi.users().then(setRows); }, []);
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Users</h1>
      <p className="mt-1 text-sm text-fg-muted">{rows.length} most recent accounts.</p>
      <div className="card shadow-soft mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
              <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Verified</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Workspaces</th><th className="px-4 py-3">Joined</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-bg-soft">
                  <td className="px-4 py-3 font-semibold">{u.email}</td>
                  <td className="px-4 py-3">{u.name || "—"}</td>
                  <td className="px-4 py-3">{u.is_verified ? "✓" : "—"}</td>
                  <td className="px-4 py-3">{u.is_staff ? <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Staff</span> : "—"}</td>
                  <td className="px-4 py-3">{u.orgs}</td>
                  <td className="px-4 py-3 text-fg-muted">{new Date(u.date_joined).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

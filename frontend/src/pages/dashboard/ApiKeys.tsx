import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { keysApi, type ApiKey } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import PageNote from "../../components/dashboard/PageNote";

export default function ApiKeys() {
  const { current } = useWorkspace();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    if (!current) return;
    setLoading(true);
    try { setKeys((await keysApi.list(current.id)).results); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await keysApi.create(current!.id, name || "API key");
    setCreated(res.key); setName(""); load();
  }
  async function revoke(id: number) {
    if (!confirm("Revoke this key? Apps using it will stop working.")) return;
    await keysApi.revoke(id); load();
  }
  function copy() { navigator.clipboard?.writeText(created!); setCopied(true); setTimeout(() => setCopied(false), 1500); }

  return (
    <div>
      <PageNote id="api-keys">
        API keys let your own systems talk to Borderless securely — for example, to record a sale from your server. Create a key, copy it <b>once</b> (we never show it again), and keep it secret like a password.
      </PageNote>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold tracking-tight">API Keys</h1>
          <p className="mt-1 text-sm text-fg-muted">Authenticate server-side requests to the Borderless API.</p></div>
        {canManage && <Button onClick={() => { setCreated(null); setOpen(true); }}>+ Create key</Button>}
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : keys.length === 0 ? <div className="card shadow-soft mt-6 p-10 text-center"><h2 className="text-lg font-bold">No API keys</h2><p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Create a key to start using the REST API.</p></div>
       : (
        <div className="card shadow-soft mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Key</th><th className="px-4 py-3">Last used</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-bg-soft">
                  <td className="px-4 py-3 font-semibold">{k.name}</td>
                  <td className="px-4 py-3"><code className="rounded bg-bg-mute px-2 py-0.5">{k.prefix}••••••</code></td>
                  <td className="px-4 py-3 text-fg-muted">{k.last_used ? new Date(k.last_used).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3">{k.revoked ? <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600">Revoked</span> : <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span>}</td>
                  <td className="px-4 py-3 text-right">{canManage && !k.revoked && <button onClick={() => revoke(k.id)} className="text-sm text-red-500 hover:underline">Revoke</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={created ? "Copy your API key" : "Create API key"}>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-amber-700">
              Copy this now — for your security, it won't be shown again.
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-bg-soft p-3">
              <code className="flex-1 break-all text-xs">{created}</code>
              <button onClick={copy} className="rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white">{copied ? "Copied ✓" : "Copy"}</button>
            </div>
            <Button onClick={() => setOpen(false)} className="w-full">Done</Button>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-4">
            <Field label="Key name" value={name} onChange={setName} placeholder="Production server" />
            <Button type="submit" className="w-full">Create key</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

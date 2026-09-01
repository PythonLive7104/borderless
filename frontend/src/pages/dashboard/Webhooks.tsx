import { useEffect, useState } from "react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { webhookApi, type Webhook, type Delivery } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import PageNote from "../../components/dashboard/PageNote";

export default function Webhooks() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [deliv, setDeliv] = useState<{ id: number; rows: Delivery[] } | null>(null);
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [w, e] = await Promise.all([webhookApi.list(current.id), webhookApi.events()]);
      setRows(w.results); setEvents(e.events);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  const toggle = (ev: string) => setSel((s) => s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    try { await webhookApi.create({ organization: current!.id, url, events: sel }); setOpen(false); setUrl(""); setSel([]); load(); }
    catch (e: any) { setErr(e.data?.url?.[0] || e.data?.events?.[0] || e.data?.detail || e.message); }
  }
  async function test(id: number) { await webhookApi.test(id); alert("Test delivery sent — check the deliveries log."); }
  async function showDeliveries(id: number) { setDeliv({ id, rows: await webhookApi.deliveries(id) }); }
  async function remove(id: number) { if (!confirm("Delete this webhook?")) return; await webhookApi.remove(id); load(); }

  return (
    <div>
      <PageNote id="webhooks">
        A webhook lets Borderless <b>notify your systems automatically</b> when something happens — like a bot being caught or a sale being made. Enter a web address to send notifications to, and pick which events you care about.
      </PageNote>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-extrabold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-fg-muted">Get notified when events happen. Deliveries are signed and retried.</p></div>
        {canManage && <Button onClick={() => setOpen(true)}>+ Add webhook</Button>}
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : rows.length === 0 ? <div className="card shadow-soft mt-6 p-10 text-center"><h2 className="text-lg font-bold">No webhooks</h2><p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Add a webhook to receive event notifications.</p></div>
       : (
        <div className="mt-6 space-y-3">
          {rows.map((w) => (
            <div key={w.id} className="card shadow-soft p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-semibold">{w.url}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {w.events.map((e) => <span key={e} className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{e}</span>)}
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => showDeliveries(w.id)} className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-brand/40">Deliveries</button>
                    <button onClick={() => test(w.id)} className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-brand/40">Test</button>
                    <button onClick={() => remove(w.id)} className="rounded-lg border border-danger/30 px-3 py-1.5 font-semibold text-red-600 hover:bg-danger/5">Delete</button>
                  </div>
                )}
              </div>
              {deliv?.id === w.id && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Recent deliveries</div>
                  {deliv.rows.length === 0 ? <p className="mt-2 text-sm text-fg-muted">None yet.</p> : (
                    <div className="mt-2 space-y-1">
                      {deliv.rows.map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs">
                          <span>{d.event}</span>
                          <span className={d.success ? "text-emerald-700" : "text-red-600"}>{d.success ? "✓" : "✗"} {d.status_code ?? "—"} · {d.attempts} attempt{d.attempts > 1 ? "s" : ""} · {new Date(d.created_at).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add webhook">
        <form onSubmit={create} className="space-y-4">
          <Field label="Endpoint URL" value={url} onChange={setUrl} placeholder="https://yourapp.com/webhooks/borderless" />
          <div>
            <span className="mb-2 block text-sm font-semibold">Events</span>
            <div className="space-y-2">
              {events.map((ev) => (
                <label key={ev} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" checked={sel.includes(ev)} onChange={() => toggle(ev)} className="h-4 w-4 accent-brand" />
                  <code className="text-xs">{ev}</code>
                </label>
              ))}
            </div>
          </div>
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full">Create webhook</Button>
        </form>
      </Modal>
    </div>
  );
}

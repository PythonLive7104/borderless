import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { websiteApi, billingApi, type Website, type Usage } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import StatusBadge from "../../components/ui/StatusBadge";

export default function Websites() {
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", url: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = current?.role === "owner" || current?.role === "admin";

  const [usage, setUsage] = useState<Usage | null>(null);
  async function load() {
    if (!current) return;
    setLoading(true);
    try { setSites((await websiteApi.list(current.id)).results); } finally { setLoading(false); }
    billingApi.usage(current.id).then(setUsage).catch(() => {});
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const site = await websiteApi.create({ organization: current!.id, ...form });
      setOpen(false); setForm({ name: "", domain: "", url: "" });
      // Take them straight to the new site's install page (snippet + verify),
      // which now also nudges them to set up Traffic Rules protection.
      navigate(`/dashboard/websites/${site.id}`);
    } catch (e: any) { setErr(e.data?.detail || e.message); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this website? Tracking will stop.")) return;
    await websiteApi.remove(id); load();
  }

  return (
    <div>
      <PageNote id="websites">Add every website you want to protect here. Each one gives you a small code snippet to paste into your site — once it's in, we start checking your visitors. <b>Add a website, then open it to get the snippet.</b></PageNote>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Websites</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Sites you're tracking in {current?.name}.
            {usage && (
              <span className="ml-1 font-semibold text-fg">
                {usage.websites.used}{usage.websites.limit ? ` of ${usage.websites.limit}` : ""} used
                {usage.websites.limit ? (usage.on_trial ? " on your trial" : " on your plan") : ""}.
              </span>
            )}
          </p>
        </div>
        {canManage && <Button onClick={() => setOpen(true)}>+ Add website</Button>}
      </div>

      {loading ? (
        <div className="mt-8 grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
      ) : sites.length === 0 ? (
        <div className="card shadow-soft mt-6 p-10 text-center">
          <h2 className="text-lg font-bold">No websites yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Add your first website to get a tracking ID and installation snippet.</p>
          {canManage && <Button className="mt-4" onClick={() => setOpen(true)}>+ Add website</Button>}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {sites.map((s) => (
            <div key={s.id} className="card card-hover shadow-soft p-5">
              <div className="flex items-start justify-between">
                <div>
                  <Link to={`/dashboard/websites/${s.id}`} className="text-base font-bold hover:text-brand">{s.name}</Link>
                  <div className="text-sm text-fg-muted">{s.domain}</div>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <code className="rounded bg-bg-mute px-2 py-1 text-xs text-fg-muted">{s.tracking_id}</code>
                <div className="flex gap-2">
                  <Link to={`/dashboard/websites/${s.id}`} className="text-sm font-semibold text-brand hover:underline">Install</Link>
                  {canManage && <button onClick={() => remove(s.id)} className="text-sm text-red-500 hover:underline">Delete</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add website">
        <form onSubmit={create} className="space-y-4">
          <Field label="Website name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Acme Store" />
          <Field label="Domain" value={form.domain} onChange={(v) => setForm({ ...form, domain: v })} placeholder="acme.com" />
          <Field label="Full URL (optional)" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://acme.com" required={false} />
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full">{busy ? "Adding…" : "Add website"}</Button>
        </form>
      </Modal>
    </div>
  );
}

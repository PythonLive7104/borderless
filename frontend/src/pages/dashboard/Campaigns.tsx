import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { campaignApi, websiteApi, billingApi, type Campaign, type Website, type Usage } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";

const SOURCES = ["facebook", "google", "tiktok", "bing", "native", "organic", "direct", "other"];

export default function Campaigns() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ website: "", name: "", destination_url: "", traffic_source: "facebook", utm_campaign: "", risk_threshold: "70" });
  const canManage = current?.role === "owner" || current?.role === "admin";
  const [usage, setUsage] = useState<Usage | null>(null);

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [c, w] = await Promise.all([campaignApi.list(current.id), websiteApi.list(current.id)]);
      setRows(c.results); setSites(w.results);
    } finally { setLoading(false); }
    billingApi.usage(current.id).then(setUsage).catch(() => {});
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await campaignApi.create({
        website: Number(f.website), name: f.name, destination_url: f.destination_url,
        traffic_source: f.traffic_source as any, utm_campaign: f.utm_campaign,
        risk_threshold: Number(f.risk_threshold),
      });
      setOpen(false);
      setF({ website: "", name: "", destination_url: "", traffic_source: "facebook", utm_campaign: "", risk_threshold: "70" });
      load();
    } catch (e: any) { setErr(e.data?.website?.[0] || e.data?.detail || e.message); } finally { setBusy(false); }
  }

  function openModal() {
    setF((p) => ({ ...p, website: sites[0]?.id ? String(sites[0].id) : "" }));
    setOpen(true);
  }

  return (
    <div>
      <PageNote id="campaigns">A <b>campaign</b> is one ad effort, like “Summer Sale on Facebook”. Create one per ad so you can see which ads bring real customers and which bring bots. Tip: put the same <b>UTM campaign</b> name you use in your ad links.</PageNote>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Organize and monitor your traffic in {current?.name}.
            {usage && (
              <span className="ml-1 font-semibold text-fg">
                {usage.campaigns.used}{usage.campaigns.limit ? ` of ${usage.campaigns.limit}` : ""} used
                {usage.campaigns.limit ? (usage.on_trial ? " on your trial" : " on your plan") : ""}.
              </span>
            )}
          </p>
        </div>
        {canManage && <Button onClick={openModal} >+ New campaign</Button>}
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
      ) : rows.length === 0 ? (
        <div className="card shadow-soft mt-6 p-10 text-center">
          <h2 className="text-lg font-bold">No campaigns yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Create your first campaign to start organizing and scoring traffic.</p>
          {canManage && sites.length > 0 && <Button className="mt-4" onClick={openModal}>+ New campaign</Button>}
          {canManage && sites.length === 0 && <p className="mt-4 text-sm text-amber-700">Add a website first.</p>}
        </div>
      ) : (
        <div className="card shadow-soft mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
                <tr>
                  <th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Website</th>
                  <th className="px-4 py-3">Source</th><th className="px-4 py-3">Threshold</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-bg-soft">
                    <td className="px-4 py-3"><Link to={`/dashboard/campaigns/${c.id}`} className="font-semibold hover:text-brand">{c.name}</Link></td>
                    <td className="px-4 py-3 text-fg-muted">{c.website_name}</td>
                    <td className="px-4 py-3 capitalize">{c.traffic_source}</td>
                    <td className="px-4 py-3">{c.risk_threshold}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-success/10 text-emerald-700" : "bg-bg-mute text-fg-muted"}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New campaign">
        <form onSubmit={create} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Website</span>
            <select value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} required
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.domain})</option>)}
            </select>
          </label>
          <Field label="Campaign name" value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="Summer Sale" />
          <Field label="Destination URL" value={f.destination_url} onChange={(v) => setF({ ...f, destination_url: v })} placeholder="https://shop.com/summer" required={false} />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Traffic source</span>
              <select value={f.traffic_source} onChange={(e) => setF({ ...f, traffic_source: e.target.value })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm capitalize outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <Field label="Risk threshold" type="number" value={f.risk_threshold} onChange={(v) => setF({ ...f, risk_threshold: v })} />
          </div>
          <Field label="UTM campaign (for attribution)" value={f.utm_campaign} onChange={(v) => setF({ ...f, utm_campaign: v })} placeholder="summer" required={false} />
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full">{busy ? "Creating…" : "Create campaign"}</Button>
        </form>
      </Modal>
    </div>
  );
}

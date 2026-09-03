import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { linkApi, websiteApi, type ShortLink, type Website } from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import NoData from "../../components/dashboard/NoData";

export default function Links() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState<ShortLink[]>([]);
  const [sites, setSites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [form, setForm] = useState({ destination_url: "", title: "", slug: "", website: "" });
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [l, w] = await Promise.all([linkApi.list(current.id), websiteApi.list(current.id)]);
      setRows(l.results); setSites(w.results);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await linkApi.create({
        organization: current!.id,
        destination_url: form.destination_url,
        title: form.title || undefined,
        slug: form.slug || undefined,
        website: form.website ? Number(form.website) : null,
      });
      setOpen(false); setForm({ destination_url: "", title: "", slug: "", website: "" }); load();
    } catch (e: any) { setErr(e.data?.slug?.[0] || e.data?.destination_url?.[0] || e.data?.detail || e.message); }
    finally { setBusy(false); }
  }

  async function toggle(l: ShortLink) { await linkApi.update(l.id, { active: !l.active }); load(); }
  async function remove(id: number) { if (confirm("Delete this link?")) { await linkApi.remove(id); load(); } }
  function copy(l: ShortLink) {
    navigator.clipboard?.writeText(l.short_url);
    setCopied(l.id); setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <PageNote id="links">
        Create short, branded links for your ads and campaigns. Every click is <b>scored by the bot engine</b> —
        real people go to your destination, and bots follow your <b>Traffic Rules</b>. Attach a website to a link
        so its rules apply. Destinations are <b>scanned for malware/phishing</b> and unsafe links are auto-disabled.
      </PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Links</h1>
          <p className="mt-1 text-sm text-fg-muted">Short links with built-in bot filtering &amp; click analytics.</p>
        </div>
        {canManage && <Button onClick={() => { setErr(""); setOpen(true); }}>+ New link</Button>}
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : rows.length === 0 ? <div className="card shadow-soft mt-6"><NoData msg="No links yet. Create one to start filtering clicks." /></div>
       : (
        <div className="mt-6 space-y-3">
          {rows.map((l) => (
            <div key={l.id} className="card shadow-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{l.title || l.slug}</span>
                    {l.url_safe === false && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600">Unsafe — disabled</span>}
                    {!l.active && l.url_safe !== false && <span className="rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-dim">Paused</span>}
                  </div>
                  <button onClick={() => copy(l)} className="mt-1 flex items-center gap-2 text-sm text-brand hover:underline">
                    <span className="font-mono">{l.short_url}</span>
                    <span className="text-xs text-fg-dim">{copied === l.id ? "Copied ✓" : "Copy"}</span>
                  </button>
                  <div className="mt-1 truncate text-xs text-fg-dim">→ {l.destination_url}</div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-center"><div className="font-bold tabular-nums">{l.clicks}</div><div className="text-[11px] text-fg-dim">clicks</div></div>
                  <div className="text-center"><div className="font-bold tabular-nums text-emerald-600">{l.human_clicks}</div><div className="text-[11px] text-fg-dim">human</div></div>
                  <div className="text-center"><div className="font-bold tabular-nums text-red-500">{l.bot_clicks}</div><div className="text-[11px] text-fg-dim">bot</div></div>
                  {canManage && (
                    <>
                      <button onClick={() => toggle(l)} title={l.active ? "Active — click to pause" : "Paused — click to activate"}
                        className={`h-6 w-11 rounded-full p-0.5 transition ${l.active ? "bg-brand" : "bg-bg-mute"}`}>
                        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${l.active ? "translate-x-5" : ""}`} />
                      </button>
                      <button onClick={() => remove(l.id)} className="text-red-500 hover:underline">Delete</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New short link">
        <form onSubmit={create} className="space-y-4">
          <Field label="Destination URL" type="url" value={form.destination_url} onChange={(v) => setForm({ ...form, destination_url: v })} placeholder="https://your-offer.com/landing" />
          <Field label="Title (optional)" required={false} value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Summer promo" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Custom slug (optional)" required={false} value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="auto" />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Apply rules from (optional)</span>
              <select value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                <option value="">No rules — send all clicks through</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <p className="rounded-lg bg-bg-soft px-3 py-2 text-xs text-fg-muted">Attach a website to filter bots with its Traffic Rules (e.g. send bots to a block page). Leave it as "No rules" to just shorten &amp; track clicks.</p>
          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create link"}</Button>
        </form>
      </Modal>
    </div>
  );
}

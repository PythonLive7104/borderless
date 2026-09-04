import { useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { linkApi, websiteApi, billingApi, type ShortLink, type BotAction, type Website, type Subscription } from "../../lib/api";
import { useLivePoll } from "../../lib/useLivePoll";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import NoData from "../../components/dashboard/NoData";
import { useDialog } from "../../context/DialogContext";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randSlug = (len = 10) => {
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  return s;
};
const clampLen = (n: number) => Math.min(48, Math.max(6, n || 6));

const BOT_OPTIONS: { value: BotAction; label: string; desc: string }[] = [
  { value: "decoy", label: "A decoy page", desc: "Looks like a real page and wastes their time." },
  { value: "notfound", label: "Nothing — a 404", desc: "Looks like the link doesn't exist." },
  { value: "blank", label: "A blank page", desc: "Quietly gives them nothing." },
  { value: "off", label: "Send them through too", desc: "No filtering — bots also reach your destination." },
];
const BOT_LABEL: Record<BotAction, string> = { decoy: "Decoy page", notfound: "404", blank: "Blank page", off: "No filtering" };

export default function Links() {
  const { confirm, notify } = useDialog();
  const { current } = useWorkspace();
  const [rows, setRows] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [sites, setSites] = useState<Website[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [form, setForm] = useState<{ destination_url: string; title: string; slug: string; bot_action: BotAction; website: string }>(
    { destination_url: "", title: "", slug: "", bot_action: "decoy", website: "" });
  const canManage = current?.role === "owner" || current?.role === "admin";
  // Mirrors link_shortener_enabled() on the server: every paid tier includes
  // the shortener, but only while the access period is still running.
  const linkEnabled = !!sub && sub.status === "active" && !sub.access?.locked;
  // Usage against the plan's cap. Mirrors redirect_limit() on the server, which
  // is what actually refuses the create — 0 means the tier has no allowance.
  const used = rows.length;
  const cap = sub?.plan.max_redirects ?? 0;
  const atCap = linkEnabled && cap > 0 && used >= cap;
  const siteName = (id: number | null) => sites.find((s) => s.id === id)?.name;

  async function load(silent = false) {
    if (!current) return;
    if (!silent) setLoading(true);
    try {
      const [l, w, s] = await Promise.all([linkApi.list(current.id), websiteApi.list(current.id), billingApi.subscription(current.id)]);
      setRows(l.results); setSites(w.results); setSub(s);
    } finally { setLoading(false); }
  }
  useLivePoll(load, [current?.id]);

  function openCreate() {
    setErr(""); setForm({ destination_url: "", title: "", slug: randSlug(), bot_action: "decoy", website: "" }); setOpen(true);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await linkApi.create({
        organization: current!.id,
        destination_url: form.destination_url,
        title: form.title || undefined,
        slug: form.slug || undefined,
        bot_action: form.bot_action,
        website: form.website ? Number(form.website) : null,
      });
      setOpen(false); load();
    } catch (e: any) { setErr(e.data?.slug?.[0] || e.data?.destination_url?.[0] || e.data?.detail || e.message); }
    finally { setBusy(false); }
  }

  async function toggle(l: ShortLink) { await linkApi.update(l.id, { active: !l.active }); load(); }
  async function remove(id: number) {
    if (!(await confirm({
      title: "Delete this redirect?",
      message: "The short link stops working immediately. Anyone who already has it will get a 404. This can't be undone.",
      confirmLabel: "Delete redirect",
    }))) return;
    await linkApi.remove(id);
    notify("Redirect deleted.");
    load();
  }
  function copy(l: ShortLink) {
    navigator.clipboard?.writeText(l.short_url);
    setCopied(l.id); setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div>
      <PageNote id="links">
        Create short, branded links for your ads and campaigns. Every click is <b>screened by the bot engine</b> —
        <b> real people always go to your destination</b>, and you choose what <b>bots</b> get (a decoy page, a 404,
        or nothing). Destinations are <b>scanned for malware/phishing</b> and unsafe links are auto-disabled.
      </PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight">Redirection</h1>
            {linkEnabled && (
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                atCap ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-line bg-bg-mute text-fg-muted"}`}>
                {used} of {cap || "∞"} used
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-fg-muted">Redirect links with built-in bot filtering &amp; click analytics.</p>
        </div>
        {canManage && linkEnabled && (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={openCreate} disabled={atCap}>+ New redirect</Button>
            {atCap && (
              <span className="text-xs text-fg-muted">
                {sub?.plan.name} includes {cap}. <a href="/dashboard/billing" className="font-semibold text-brand hover:underline">Upgrade</a> for more.
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : !linkEnabled ? (
        <div className="card shadow-soft mt-6 border-brand/30 bg-brand/5 p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-2xl">🔗</div>
          <h2 className="mt-3 text-lg font-bold">Redirection is a paid feature</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            Create bot-filtered campaign redirects with click analytics. It's included on every
            paid plan{sub ? <> — you're on <b>{sub.plan.name}</b>.</> : "."}
          </p>
          {canManage
            ? <Button to="/dashboard/billing" className="mt-4">Upgrade to unlock →</Button>
            : <p className="mt-3 text-xs text-fg-dim">Ask an owner or admin to upgrade the workspace.</p>}
        </div>
       ) : rows.length === 0 ? <div className="card shadow-soft mt-6"><NoData msg="No links yet. Create one to start filtering clicks." /></div>
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
                  <div className="mt-1 text-xs text-fg-dim">
                    Bots get: <b className="text-fg-muted">{BOT_LABEL[l.bot_action]}</b>
                    {l.website && <> · Rules: <b className="text-fg-muted">{siteName(l.website) || "a website"}</b></>}
                  </div>
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

      <Modal open={open} onClose={() => setOpen(false)} title="Create a redirect" size="lg">
        <form onSubmit={create} className="space-y-4">
          {/* live preview */}
          <div className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Your link</div>
            <div className="mt-0.5 break-all font-mono text-sm font-semibold text-brand">{ORIGIN}/l/{form.slug || "…"}</div>
          </div>

          <Field label="Where should it send people?" type="url" value={form.destination_url} onChange={(v) => setForm({ ...form, destination_url: v })} placeholder="https://your-offer.com/landing" />
          <Field label="Title (optional)" required={false} value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Summer promo" />

          <div>
            <span className="mb-1.5 block text-sm font-semibold">Link ending</span>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="offer"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={6} max={48} value={clampLen(form.slug.length)}
                onChange={(e) => setForm({ ...form, slug: randSlug(Number(e.target.value)) })}
                className="min-w-0 flex-1 accent-brand" />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-fg-dim">{form.slug.length}/48</span>
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, slug: randSlug(clampLen(form.slug.length || 10)) })}>Regenerate</Button>
            </div>
            <p className="mt-1 text-xs text-fg-dim">Drag for a random ending, or type your own. Longer is harder to guess.</p>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-semibold">What should bots get instead?</span>
            <p className="mb-2 text-xs text-fg-dim">Real visitors always go to your destination. This only affects traffic we flag as automated.</p>
            <div className="space-y-2">
              {BOT_OPTIONS.map((o) => (
                <label key={o.value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${form.bot_action === o.value ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`}>
                  <input type="radio" name="bot_action" checked={form.bot_action === o.value} onChange={() => setForm({ ...form, bot_action: o.value })} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className="block text-xs text-fg-muted">{o.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Apply a website's Traffic Rules? <span className="font-normal text-fg-dim">(optional, advanced)</span></span>
            <select value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">No — just use the bot handling above</option>
              {sites.map((s) => <option key={s.id} value={s.id}>Use {s.name}'s Traffic Rules</option>)}
            </select>
            <p className="mt-1 text-xs text-fg-dim">For tighter control, run a website's Traffic Rules on each click (block by country, device, risk, IP allow/deny, etc.). Those rules win; the bot handling above is the fallback.</p>
          </label>

          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create link"}</Button>
        </form>
      </Modal>
    </div>
  );
}

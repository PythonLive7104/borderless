import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { linkApi, websiteApi, billingApi, type ChallengeStyle, type PrivateDomains, type ShortDomain, type ShortLink, type BotAction, type Website, type Subscription } from "../../lib/api";
import { useLivePoll } from "../../lib/useLivePoll";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";
import NoData from "../../components/dashboard/NoData";
import RedirectRulesModal from "../../components/dashboard/RedirectRulesModal";
import { useDialog } from "../../context/DialogContext";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randSlug = (len = 10) => {
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  return s;
};
const MAX_SLUG = 200;
const PRIVATE_DOMAIN_PRICE = 5;
const clampLen = (n: number) => Math.min(MAX_SLUG, Math.max(6, n || 6));

const BOT_OPTIONS: { value: BotAction; label: string; desc: string }[] = [
  { value: "decoy", label: "A decoy page", desc: "Looks like a real page and wastes their time." },
  { value: "notfound", label: "Nothing — a 404", desc: "Looks like the link doesn't exist." },
  { value: "blank", label: "A blank page", desc: "Quietly gives them nothing." },
  { value: "off", label: "Send them through too", desc: "No filtering — bots also reach your destination." },
];
const CHALLENGE_STYLES: { value: ChallengeStyle; label: string; desc: string }[] = [
  { value: "hold", label: "Press and hold",
    desc: "Hold a button for five seconds while a bar fills. The strongest of the three — software won't wait." },
  { value: "checkbox", label: "Tick a box",
    desc: "A single click on an \u201cI am human\u201d box. Fastest for real visitors, and the most familiar." },
  { value: "slide", label: "Slide to continue",
    desc: "Drag a handle across to the end. Nothing to read, so it travels well across languages." },
];

function PrivateDomainPanel({ priv, canManage, orgId, onChanged }: {
  priv: PrivateDomains; canManage: boolean; orgId: number; onChanged: () => void;
}) {
  const owned = priv.owned.length;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { confirm, notify } = useDialog();

  async function buy() {
    if (!(await confirm({
      title: `Private domain — $${PRIVATE_DOMAIN_PRICE}/month`,
      message: "A short domain used by you and nobody else, so another customer's traffic "
             + "can never affect its reputation. Billed for 30 days at a time, alongside your plan.",
      confirmLabel: "Continue to payment",
      cancelLabel: "Not now",
      tone: "brand",
    }))) return;
    setBusy(true); setMsg("");
    try {
      const r = await linkApi.buyPrivateDomain(orgId);
      if (r.checkout_url) { window.location.href = r.checkout_url; return; }
      notify("Private domain added."); onChanged();
    } catch (e: any) {
      setMsg(e?.data?.detail || "Could not start the purchase.");
    } finally { setBusy(false); }
  }
  return (
    <div className="card shadow-soft mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="min-w-0">
        <div className="text-sm font-bold">
          {owned > 0 ? `Your private ${owned === 1 ? "domain" : "domains"}` : "Private domain"}
        </div>
        {owned > 0 ? (
          <p className="mt-1 text-sm text-fg-muted">
            {priv.owned.map((d) => d.host).join(", ")} — yours alone. Nobody else can create links
            on {owned === 1 ? "it" : "them"}, so another customer's traffic can never affect
            {owned === 1 ? " its" : " their"} reputation.
            {priv.owned[0]?.private_until && (
              <> Renews <b>{new Date(priv.owned[0].private_until).toLocaleDateString()}</b>.</>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-fg-muted">
            Shared domains work well, but you're on them alongside other customers. A private domain
            is used by you and nobody else.{" "}
            {priv.available > 0
              ? <><b>{priv.available}</b> available right now.</>
              : <>None in stock at the moment — ask and we'll source one.</>}
          </p>
        )}
      </div>
      {owned > 0 && priv.owned[0]?.private_until &&
        new Date(priv.owned[0].private_until) < new Date() && (
        <div className="w-full rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
          ⚠️ This rental has lapsed. Your links still work for a short grace period, then the
          domain is released. {canManage && <button onClick={buy} className="font-semibold text-brand hover:underline">Renew now</button>}
        </div>
      )}
      {canManage && owned > 0 && (
        <Button onClick={buy} variant="outline" disabled={busy}>
          {busy ? "Starting…" : `Renew · $${PRIVATE_DOMAIN_PRICE}/mo`}
        </Button>
      )}
      {canManage && owned === 0 && (
        <div className="flex flex-col items-end gap-1">
          <Button onClick={buy} disabled={busy} className={busy ? "" : "cta-glow"}>
            {busy ? "Starting…" : `Get a private domain · $${PRIVATE_DOMAIN_PRICE}/mo`}
          </Button>
          {msg && <span className="max-w-xs text-right text-xs text-red-600">{msg}</span>}
        </div>
      )}
    </div>
  );
}

function LockedBanner({ planName, canManage }: { planName?: string; canManage: boolean }) {
  return (
    <div className="card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand/5 p-5">
      <div className="min-w-0">
        <div className="text-sm font-bold">🔒 Redirects are on every paid plan</div>
        <p className="mt-1 text-sm text-fg-muted">
          This is what you'd get: bot-filtered campaign links with click analytics
          {planName ? <> — you're on <b>{planName}</b>.</> : "."}
        </p>
      </div>
      {canManage
        ? <Button to="/dashboard/billing">Choose a plan →</Button>
        : <span className="text-xs text-fg-dim">Ask an owner or admin to upgrade.</span>}
    </div>
  );
}

const BOT_LABEL: Record<BotAction, string> = { decoy: "Decoy page", notfound: "404", blank: "Blank page", off: "No filtering" };

export default function Links() {
  const { confirm, notify } = useDialog();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShortLink | null>(null);
  const [rulesFor, setRulesFor] = useState<ShortLink | null>(null);
  // "" means no short domain is configured — the service is off, and we must
  // never show a trynobot.com link as a stand-in.
  const [linkBase, setLinkBase] = useState("");
  const [domains, setDomains] = useState<ShortDomain[]>([]);
  const [priv, setPriv] = useState<PrivateDomains>({ owned: [], available: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [sites, setSites] = useState<Website[]>([]);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [form, setForm] = useState<{ destination_url: string; title: string; slug: string; bot_action: BotAction; website: string; challenge: boolean; challenge_style: ChallengeStyle; forward_params: boolean; forward_param_keys: string; block_vpn: boolean; domain: string; country_mode: "off" | "allow" | "block"; countries: string }>(
    { destination_url: "", title: "", slug: "", bot_action: "decoy", website: "", challenge: false, challenge_style: "hold", forward_params: false, forward_param_keys: "", block_vpn: false, domain: "", country_mode: "off", countries: "" });
  const canManage = current?.role === "owner" || current?.role === "admin";
  // Mirrors link_shortener_enabled() on the server: every paid tier includes
  // the shortener, but only while the access period is still running.
  const serviceUp = linkBase !== "";
  const linkEnabled = serviceUp && !!sub && sub.status === "active" && !sub.access?.locked;
  // Usage against the plan's cap. Mirrors redirect_limit() on the server, which
  // is what actually refuses the create — 0 means the tier has no allowance.
  const used = rows.length;
  // Cap for the interval this workspace is actually billed on, not the weekly one.
  const cap = (sub?.interval === "monthly" && sub?.plan.max_redirects_monthly)
    ? sub.plan.max_redirects_monthly
    : (sub?.plan.max_redirects ?? 0);
  const atCap = linkEnabled && cap > 0 && used >= cap;
  const siteName = (id: number | null) => sites.find((s) => s.id === id)?.name;
  // Served by the API (SHORTLINK_BASE) so a brand-new workspace with no links
  // still previews the real short domain instead of the old /l/ form.

  async function load(silent = false) {
    if (!current) return;
    if (!silent) setLoading(true);
    try {
      const [l, w, s] = await Promise.all([linkApi.list(current.id), websiteApi.list(current.id), billingApi.subscription(current.id)]);
      setRows(l.results); setSites(w.results); setSub(s);
      setLinkBase(l.base || ""); setDomains(l.domains || []);
      if (l.private) setPriv(l.private);
    } finally { setLoading(false); }
  }
  useLivePoll(load, [current?.id]);

  // Returning from a private-domain checkout: ask Bachs directly rather than
  // waiting on a webhook, same as plan purchases.
  useEffect(() => {
    if (!current || !window.location.search.includes("purchase=success")) return;
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      try {
        const r = await linkApi.verifyPrivateDomain(current.id);
        if (r.paid) {
          clearInterval(iv);
          window.history.replaceState({}, "", "/dashboard/links");
          notify(r.awaiting_stock
            ? "Payment received. We're preparing your domain and will email you shortly."
            : `${r.host} is yours — pick it when you create a redirect.`);
          load();
        }
      } catch { /* keep trying */ }
      if (tries >= 10) clearInterval(iv);
    }, 2000);
    return () => clearInterval(iv);
    /* eslint-disable-next-line */
  }, [current?.id]);

  // Clicking while unpaid explains why, rather than doing nothing. A disabled
  // button looks broken and tells them nothing.
  async function explainLocked() {
    if (await confirm({
      title: "Redirects need a paid plan",
      message: "Every paid plan includes them — bot-filtered links with click analytics, "
             + "VPN blocking and a human check. Your trial covers the antibot side only.",
      confirmLabel: "See plans",
      cancelLabel: "Not now",
      tone: "brand",
    })) navigate("/dashboard/billing");
  }

  function openCreate() {
    setErr(""); setEditing(null);
    const def = domains.find((d) => d.is_default) || domains[0];
    setForm({ destination_url: "", title: "", slug: randSlug(), bot_action: "decoy", website: "", challenge: false, challenge_style: "hold", forward_params: false, forward_param_keys: "", block_vpn: false, domain: def ? String(def.id) : "", country_mode: "off", countries: "" });
    setOpen(true);
  }
  function openEdit(l: ShortLink) {
    setErr(""); setEditing(l);
    setForm({
      destination_url: l.destination_url, title: l.title || "", slug: l.slug,
      bot_action: l.bot_action, website: l.website ? String(l.website) : "",
      challenge: !!l.challenge, challenge_style: l.challenge_style || "hold",
      forward_params: !!l.forward_params,
      forward_param_keys: l.forward_param_keys || "", block_vpn: !!l.block_vpn,
      domain: l.domain ? String(l.domain) : "",
      country_mode: l.country_mode || "off", countries: l.countries || "",
    });
    setOpen(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const payload = {
      destination_url: form.destination_url,
      title: form.title || "",
      slug: form.slug || undefined,
      bot_action: form.bot_action,
      challenge: form.challenge,
      challenge_style: form.challenge_style,
      block_vpn: form.block_vpn,
      country_mode: form.country_mode,
      countries: form.country_mode === "off" ? "" : form.countries.trim(),
      domain: form.domain ? Number(form.domain) : null,
      forward_params: form.forward_params,
      forward_param_keys: form.forward_params ? form.forward_param_keys.trim() : "",
      website: form.website ? Number(form.website) : null,
    };
    try {
      // Both paths re-scan the destination server-side; a link whose new target
      // comes back unsafe is auto-disabled, so say so rather than let it look
      // like the save silently failed.
      const saved = editing
        ? await linkApi.update(editing.id, payload)
        : await linkApi.create({ organization: current!.id, ...payload });
      setOpen(false);
      if (saved.url_safe === false) {
        notify("Saved, but the destination was flagged as unsafe — the redirect is disabled.", "danger");
      } else {
        notify(editing ? "Redirect updated." : "Redirect created.");
        // Offer rules straight after creating: this is the moment someone is
        // thinking about who should reach the link, and the Rules button on the
        // row was easy to miss otherwise. Skipped for a link we just disabled —
        // filtering rules are beside the point there.
        if (!editing) setRulesFor(saved);
      }
      load();
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
        {canManage && serviceUp && (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={linkEnabled ? openCreate : explainLocked} disabled={atCap}
              variant={linkEnabled ? "primary" : "outline"}>
              {linkEnabled ? "+ New redirect" : "🔒 New redirect"}
            </Button>
            {atCap && (
              <span className="max-w-full text-right text-xs text-fg-muted">
                {sub?.plan.name} includes {cap}. <a href="/dashboard/billing" className="font-semibold text-brand hover:underline">Upgrade</a> for more.
              </span>
            )}
          </div>
        )}
      </div>

      {linkEnabled && current && <PrivateDomainPanel priv={priv} canManage={canManage}
        orgId={current.id} onChanged={load} />}

      {loading ? <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
       : !serviceUp ? (
        <div className="card shadow-soft mt-6 border-warning/40 bg-warning/5 p-8 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/10 text-2xl">⏸️</div>
          <h2 className="mt-3 text-lg font-bold">Redirects are paused</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            The redirect service is temporarily unavailable, so no links are being served and
            none can be created. Your existing links and their stats are safe and will work
            again as soon as it's back.
          </p>
        </div>
       ) : rows.length === 0 ? (
        <>
          {!linkEnabled && <LockedBanner planName={sub?.plan.name} canManage={canManage} />}
          {/* A worked example, clearly labelled. Hiding the page behind an
              upsell told an unpaid visitor nothing about what they'd get. */}
          <div className="card shadow-soft mt-4 p-5 opacity-70">
            <div className="mb-3 inline-block rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-dim">
              Example — not a real link
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-64">
                <span className="break-all font-bold">Summer promo</span>
                <div className="mt-1 break-all font-mono text-sm text-fg-dim">
                  {linkBase || "https://trynb.cc"}/<span className="italic">your-link</span>
                </div>
                <div className="mt-1 truncate text-xs text-fg-dim">→ https://your-offer.com/landing</div>
                <div className="mt-1 text-xs text-fg-dim">
                  Bots get: <b className="text-fg-muted">Decoy page</b> · <b className="text-fg-muted">VPN/RDP blocked</b> · <b className="text-fg-muted">Human check: Press and hold</b>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <div className="text-center"><div className="font-bold tabular-nums">1,284</div><div className="text-[11px] text-fg-dim">clicks</div></div>
                <div className="text-center"><div className="font-bold tabular-nums text-emerald-600">1,097</div><div className="text-[11px] text-fg-dim">human</div></div>
                <div className="text-center"><div className="font-bold tabular-nums text-red-500">187</div><div className="text-[11px] text-fg-dim">bot</div></div>
              </div>
            </div>
          </div>
          {linkEnabled && <div className="card shadow-soft mt-3"><NoData msg="No links yet. Create one to start filtering clicks." /></div>}
        </>
       )
       : (
        <div className="mt-6 space-y-3">
          {rows.map((l) => (
            <div key={l.id} className="card shadow-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 basis-64">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all font-bold">{l.title || l.slug}</span>
                    {l.url_safe === false && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600">Unsafe — disabled</span>}
                    {!l.active && l.url_safe !== false && <span className="rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-dim">Paused</span>}
                  </div>
                  <button onClick={() => copy(l)}
                    className="mt-1 flex w-full max-w-full flex-wrap items-center gap-x-2 text-left text-sm text-brand hover:underline">
                    <span className="min-w-0 break-all font-mono">{l.short_url}</span>
                    <span className="shrink-0 text-xs text-fg-dim">{copied === l.id ? "Copied ✓" : "Copy"}</span>
                  </button>
                  <div className="mt-1 min-w-0 truncate text-xs text-fg-dim">→ {l.destination_url}</div>
                  <div className="mt-1 text-xs text-fg-dim">
                    Bots get: <b className="text-fg-muted">{BOT_LABEL[l.bot_action]}</b>
                    {l.website && <> · Rules: <b className="text-fg-muted">{siteName(l.website) || "a website"}</b></>}
                    {domains.length > 1 && l.domain_host && <> · <b className="text-fg-muted">{l.domain_host}</b></>}
                    {l.block_vpn && <> · <b className="text-fg-muted">VPN/RDP blocked</b></>}
                    {l.country_mode !== "off" && l.countries && <> · <b className="text-fg-muted">
                      {l.country_mode === "allow" ? "Only" : "Not"} {l.countries}</b></>}
                    {l.challenge && <> · <b className="text-fg-muted">Human check: {CHALLENGE_STYLES.find((c) => c.value === (l.challenge_style || "hold"))?.label}</b></>}
                    {l.forward_params && <> · <b className="text-fg-muted">
                      Forwards {l.forward_param_keys || "all params"}</b></>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="text-center"><div className="font-bold tabular-nums">{l.clicks}</div><div className="text-[11px] text-fg-dim">clicks</div></div>
                  <div className="text-center"><div className="font-bold tabular-nums text-emerald-600">{l.human_clicks}</div><div className="text-[11px] text-fg-dim">human</div></div>
                  <div className="text-center"><div className="font-bold tabular-nums text-red-500">{l.bot_clicks}</div><div className="text-[11px] text-fg-dim">bot</div></div>
                  {canManage && (
                    <>
                      <button onClick={() => toggle(l)} title={l.active ? "Active — click to pause" : "Paused — click to activate"}
                        className={`h-6 w-11 rounded-full p-0.5 transition ${l.active ? "bg-brand" : "bg-bg-mute"}`}>
                        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${l.active ? "translate-x-5" : ""}`} />
                      </button>
                      <button onClick={() => setRulesFor(l)} className="text-brand hover:underline">Rules</button>
                      <button onClick={() => openEdit(l)} className="text-brand hover:underline">Edit</button>
                      <button onClick={() => remove(l.id)} className="text-red-500 hover:underline">Delete</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && <RedirectRulesModal link={rulesFor} orgId={current.id}
        onClose={() => setRulesFor(null)} onSaved={load} />}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit redirect" : "Create a redirect"} size="xl">
        <form onSubmit={save} className="space-y-4">
          {/* live preview */}
          <div className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Your link</div>
            <div className="mt-0.5 break-all font-mono text-sm font-semibold text-brand">{domains.find((d) => String(d.id) === form.domain)?.base || linkBase}/{form.slug || "…"}</div>
          </div>

          {domains.length > 1 && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">Domain</span>
              <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.host}{d.is_default ? " · default" : ""}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-fg-dim">
                Spreading links across domains means one blocklisting can't take them all down.
                The domain can't be changed after the link is created.
              </p>
            </label>
          )}

          <Field label="Where should it send people?" type="url" value={form.destination_url} onChange={(v) => setForm({ ...form, destination_url: v })} placeholder="https://your-offer.com/landing" />
          <Field label="Title (optional)" required={false} value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Summer promo" />

          <div>
            <span className="mb-1.5 block text-sm font-semibold">Link ending</span>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="offer"
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <div className="mt-2 flex items-center gap-3">
              <input type="range" min={6} max={MAX_SLUG} value={clampLen(form.slug.length)}
                onChange={(e) => setForm({ ...form, slug: randSlug(Number(e.target.value)) })}
                className="min-w-0 flex-1 accent-brand" />
              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-fg-dim">{form.slug.length}/{MAX_SLUG}</span>
              <Button type="button" variant="outline" onClick={() => setForm({ ...form, slug: randSlug(clampLen(form.slug.length || 10)) })}>Regenerate</Button>
            </div>
            <p className="mt-1 text-xs text-fg-dim">Drag for a random ending, or type your own. Longer is harder to guess.</p>
            {editing && form.slug !== editing.slug && (
              <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-amber-800">
                Changing the ending breaks the old link
                {editing.clicks > 0 && <> — it already has <b>{editing.clicks}</b> click{editing.clicks === 1 ? "" : "s"}</>}.
                Anyone who already has <span className="break-all font-mono">{editing.slug}</span> will get a 404.
              </p>
            )}
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

          <div className="rounded-xl border border-line p-3.5">
            <span className="mb-1.5 block text-sm font-semibold">Which countries can use this link?</span>
            <select value={form.country_mode}
              onChange={(e) => setForm({ ...form, country_mode: e.target.value as typeof form.country_mode })}
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="off">Everywhere — no country restriction</option>
              <option value="allow">Only these countries</option>
              <option value="block">Everywhere except these</option>
            </select>
            {form.country_mode !== "off" && (
              <>
                <input value={form.countries} placeholder="US, CA, GB"
                  onChange={(e) => setForm({ ...form, countries: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm uppercase outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                <p className="mt-1.5 text-xs text-fg-dim">
                  Two-letter country codes, comma separated. Anyone refused gets the bot handling
                  above — they're never told why.
                  {form.country_mode === "allow" && " Visitors whose country we can't determine are refused too."}
                </p>
              </>
            )}
          </div>

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.block_vpn ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`}>
            <input type="checkbox" checked={form.block_vpn} className="mt-0.5"
              onChange={(e) => setForm({ ...form, block_vpn: e.target.checked })} />
            <span>
              <span className="block text-sm font-semibold">Block VPN, proxy and RDP traffic</span>
              <span className="block text-xs text-fg-muted">
                Visitors on a VPN, proxy, Tor, or a datacenter/RDP connection get the bot handling
                above instead of your destination — they're never told why. Useful when you're
                paying for ad clicks and don't want to pay for masked traffic.
              </span>
            </span>
          </label>

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.challenge ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`}>
            <input type="checkbox" checked={form.challenge} className="mt-0.5"
              onChange={(e) => setForm({ ...form, challenge: e.target.checked })} />
            <span>
              <span className="block text-sm font-semibold">Ask visitors to confirm they're human</span>
              <span className="block text-xs text-fg-muted">
                Shows a "I'm not a robot" button before the redirect. Only people we'd already let
                through see it — bots still get the handling above — so it catches automation the
                score missed. Confirmed visitors aren't asked again for 30 minutes.
              </span>
            </span>
          </label>

          {form.challenge && (
            <div className="-mt-1 rounded-xl border border-line bg-bg-soft p-3.5">
              <span className="mb-2 block text-sm font-semibold">Which check should they get?</span>
              <div className="space-y-2">
                {CHALLENGE_STYLES.map((o) => (
                  <label key={o.value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${form.challenge_style === o.value ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand/40"}`}>
                    <input type="radio" name="challenge_style" className="mt-0.5"
                      checked={form.challenge_style === o.value}
                      onChange={() => setForm({ ...form, challenge_style: o.value })} />
                    <span>
                      <span className="block text-sm font-semibold">{o.label}</span>
                      <span className="block text-xs text-fg-muted">{o.desc}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.forward_params ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`}>
            <input type="checkbox" checked={form.forward_params} className="mt-0.5"
              onChange={(e) => setForm({ ...form, forward_params: e.target.checked })} />
            <span>
              <span className="block text-sm font-semibold">Pass the link's query string to the destination</span>
              <span className="block text-xs text-fg-muted">
                For personalised links: <span className="font-mono">?rid=8842</span> on the short link
                arrives on your page. Needed for per-recipient survey and campaign tracking.
                Query values are never written to your click log, so anything personal in them
                isn't stored here.
              </span>
            </span>
          </label>

          {form.forward_params && (
            <div className="-mt-1 rounded-xl border border-line bg-bg-soft p-3.5">
              <span className="mb-1.5 block text-sm font-semibold">Which parameters?</span>
              <input value={form.forward_param_keys} placeholder="email, rid"
                onChange={(e) => setForm({ ...form, forward_param_keys: e.target.value })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              <p className="mt-1.5 text-xs text-fg-dim">
                Comma-separated names. Only these are passed on — anything else on the link is
                dropped, so stray trackers picked up in transit don't follow people to your page.
                Leave blank to forward everything.
              </p>
              {form.forward_param_keys.trim() && (
                <p className="mt-2 break-all font-mono text-xs text-fg-muted">
                  {domains.find((d) => String(d.id) === form.domain)?.base || linkBase}/{form.slug || "…"}?
                  {form.forward_param_keys.split(",").map((k) => k.trim()).filter(Boolean)
                    .map((k, i) => <span key={k}>{i > 0 && "&"}<b className="text-brand">{k}</b>=…</span>)}
                </p>
              )}
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Apply a website's Traffic Rules? <span className="font-normal text-fg-dim">(optional, advanced)</span></span>
            <p className="mb-2 rounded-lg bg-brand/5 px-3 py-2 text-xs leading-relaxed text-fg-muted">
              Want to block by <b>country, device, OS, browser or risk score</b> on this link alone?
              You don't need a website — save the redirect, then tap <b>Rules</b> on it in the list.
            </p>
            <select value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">No — just use the bot handling above</option>
              {sites.map((s) => <option key={s.id} value={s.id}>Use {s.name}'s Traffic Rules</option>)}
            </select>
            <p className="mt-1 text-xs text-fg-dim">For tighter control, run a website's Traffic Rules on each click (block by country, device, risk, IP allow/deny, etc.). Those rules win; the bot handling above is the fallback.</p>
          </label>

          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Create redirect"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

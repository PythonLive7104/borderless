import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import IPFilters from "../../components/dashboard/IPFilters";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  ruleApi, RULE_FIELDS, RULE_OPS, FIELD_VALUE_OPTIONS, COUNTRIES, websiteApi,
  type TrafficRule, type RuleAction, type RuleCondition, type Website,
} from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";

const ACTIONS: RuleAction[] = ["allow", "redirect", "block", "review", "tag"];

// Ready-made pages we host, so users don't have to build their own "blocked" page.
const REDIRECT_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const REDIRECT_PRESETS: { label: string; path: string }[] = [
  { label: "Access denied", path: "/blocked.html" },
  { label: "Unauthorised access", path: "/unauthorized.html" },
  { label: "404 Not found", path: "/not-found.html" },
];
const actionTone: Record<RuleAction, string> = {
  allow: "bg-success/10 text-emerald-700",
  redirect: "bg-indigo-500/10 text-indigo-600",
  block: "bg-danger/10 text-red-600",
  review: "bg-warning/10 text-amber-700",
  tag: "bg-brand/10 text-brand",
};
// Plain-English meaning of each action, shown to guide non-technical users.
const ACTION_META: Record<RuleAction, { label: string; desc: string }> = {
  allow: { label: "Allow", desc: "Let the visitor through normally. Use this to always trust certain traffic." },
  redirect: { label: "Redirect (turn them away)", desc: "The only action that stops a visitor in real time: their browser is sent to a URL you choose (e.g. a blank or safe page), so bots and fraud never reach your real page. Use this to actually keep bad traffic out." },
  block: { label: "Block (label only)", desc: "Marks the visitor as blocked in your Click Log and reports — but with the tracking snippet they still load the page. To truly turn a visitor away in real time, use “Redirect” instead." },
  review: { label: "Flag for review", desc: "Don't stop anyone — just mark these visits so you can inspect them later in Visitors / Click Log." },
  tag: { label: "Add a label (tag)", desc: "Attach a label of your choice for filtering and reports. The visitor is not affected." },
};
const fieldLabel = (f: string) => RULE_FIELDS.find(([v]) => v === f)?.[1] || f;
const opLabel = (o: string) => RULE_OPS.find(([v]) => v === o)?.[1] || o;
// Show the friendly label for a stored value (e.g. "mobile" -> "Mobile", "RU" -> "Russia").
function valueLabel(field: string, value: string): string {
  const opts = FIELD_VALUE_OPTIONS[field];
  if (opts) return opts.find(([v]) => v === value)?.[1] || value;
  if (field === "country") return COUNTRIES.find(([v]) => v === value)?.[1] || value;
  return value;
}

// Operators that make sense per field type.
const NUM_OPS = ["gte", "gt", "lte", "lt", "eq", "ne"];
const ENUM_OPS = ["eq", "ne", "in"];
const TEXT_OPS = ["eq", "ne", "contains", "in"];
const NUMERIC_FIELDS = ["risk_score", "requests_per_min"];
function opsFor(field: string): readonly (readonly [string, string])[] {
  let allow: string[];
  if (NUMERIC_FIELDS.includes(field)) allow = NUM_OPS;
  else if (FIELD_VALUE_OPTIONS[field] || field === "country") allow = ENUM_OPS;
  else allow = TEXT_OPS;
  return RULE_OPS.filter(([v]) => allow.includes(v));
}
const emptyCond = (): RuleCondition => ({ field: "risk_score", operator: "gte", value: "" });

// A value editor that adapts to the chosen field.
function CondValue({ c, onChange }: { c: RuleCondition; onChange: (v: string) => void }) {
  const cls = "min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand";
  const opts = FIELD_VALUE_OPTIONS[c.field];
  if (c.field === "risk_score")
    return <input type="number" min={0} max={100} value={c.value} onChange={(e) => onChange(e.target.value)} placeholder="0–100" required className={cls} />;
  if (c.field === "requests_per_min")
    return <input type="number" min={1} value={c.value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. 30" required className={cls} />;
  if (c.field === "country")
    return (
      <select value={c.value} onChange={(e) => onChange(e.target.value)} required className={cls}>
        <option value="">Country…</option>
        {COUNTRIES.map(([v, l]) => <option key={v} value={v}>{l} ({v})</option>)}
      </select>
    );
  if (opts)
    return (
      <select value={c.value} onChange={(e) => onChange(e.target.value)} required className={cls}>
        <option value="">Choose…</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  return <input value={c.value} onChange={(e) => onChange(e.target.value)} placeholder="value" required className={cls} />;
}

export default function TrafficRules() {
  const { current } = useWorkspace();
  const [tab, setTab] = useState<"rules" | "ip">("rules");
  const [rules, setRules] = useState<TrafficRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [presetUrl, setPresetUrl] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const [sites, setSites] = useState<Website[]>([]);
  const blank = { name: "", priority: "100", action: "review" as RuleAction, tag: "", redirect_url: "", website: "", conditions: [emptyCond()] };
  const [form, setForm] = useState<{ name: string; priority: string; action: RuleAction; tag: string; redirect_url: string; website: string; conditions: RuleCondition[] }>(blank);
  const canManage = current?.role === "owner" || current?.role === "admin";
  const siteName = (id: number | null) => sites.find((s) => s.id === id)?.name;

  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [r, w] = await Promise.all([ruleApi.list(current.id), websiteApi.list(current.id)]);
      setRules(r.results); setSites(w.results);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [current?.id]);

  function setCond(i: number, patch: Partial<RuleCondition>) {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c, j) => {
        if (j !== i) return c;
        const next = { ...c, ...patch };
        // when the field changes, reset value and snap the operator to a valid one
        if (patch.field && patch.field !== c.field) {
          next.value = "";
          const ops = opsFor(patch.field).map(([v]) => v);
          if (!ops.includes(next.operator)) next.operator = ops[0];
        }
        return next;
      }),
    }));
  }
  const addCond = () => setForm((f) => ({ ...f, conditions: [...f.conditions, emptyCond()] }));
  const rmCond = (i: number) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }));

  function openCreate() { setEditingId(null); setForm(blank); setErr(""); setOpen(true); }
  function openEdit(r: TrafficRule) {
    setEditingId(r.id);
    setForm({
      name: r.name, priority: String(r.priority), action: r.action, tag: r.tag || "",
      redirect_url: r.redirect_url || "", website: r.website ? String(r.website) : "",
      conditions: r.conditions.length
        ? r.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value }))
        : [emptyCond()],
    });
    setErr(""); setOpen(true);
  }
  function closeModal() { setOpen(false); setEditingId(null); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    const payload = {
      name: form.name, priority: Number(form.priority), action: form.action,
      tag: form.tag, redirect_url: form.redirect_url, conditions: form.conditions,
      website: form.website ? Number(form.website) : null,
    };
    try {
      if (editingId) await ruleApi.update(editingId, payload);
      else await ruleApi.create({ organization: current!.id, ...payload });
      closeModal(); setForm(blank); load();
    } catch (e: any) { setErr(e.data?.detail || e.data?.conditions?.[0] || e.message); } finally { setBusy(false); }
  }

  // One-click starter protection for people who don't know where to begin.
  // With a redirect URL, fraud & bots are actually turned away in real time;
  // without one they're labeled as blocked. Suspicious traffic is flagged.
  async function applyRecommended() {
    if (!current) return;
    setPresetBusy(true); setErr("");
    const badAction: RuleAction = presetUrl ? "redirect" : "block";
    const mk = (name: string, cls: string, priority: number, action: RuleAction) =>
      ruleApi.create({
        organization: current.id, name, priority, action, tag: "",
        redirect_url: action === "redirect" ? presetUrl : "",
        conditions: [{ field: "classification", operator: "eq", value: cls }],
      });
    try {
      await mk("Turn away fraud", "fraud", 10, badAction);
      await mk("Turn away bots", "bot", 20, badAction);
      await mk("Flag suspicious for review", "suspicious", 30, "review");
      setPresetUrl(""); load();
    } catch (e: any) { setErr(e.data?.detail || e.message); } finally { setPresetBusy(false); }
  }

  async function toggle(r: TrafficRule) {
    await ruleApi.update(r.id, { active: !r.active }); load();
  }
  async function remove(id: number) {
    if (!confirm("Delete this rule?")) return;
    await ruleApi.remove(id); load();
  }

  const TabButton = ({ id, label }: { id: "rules" | "ip"; label: string }) => (
    <button onClick={() => setTab(id)}
      className={`border-b-2 px-1 pb-2 text-sm font-semibold transition ${tab === id ? "border-brand text-brand" : "border-transparent text-fg-muted hover:text-fg"}`}>
      {label}
    </button>
  );

  return (
    <div>
      <PageNote id="traffic-rules">Rules act for you automatically. Example: “if a visitor is on mobile from Nigeria → block”. Pick what to check and what should happen. Rules run top to bottom and the <b>first match wins</b>. Use <b>IP allow/deny</b> to hard-block or always-allow specific addresses.</PageNote>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Traffic Rules</h1>
          <p className="mt-1 text-sm text-fg-muted">Filter by risk, country, device, OS, browser, JA3 and more — or manage IP allow/deny lists.</p>
        </div>
        {canManage && tab === "rules" && <Button onClick={openCreate}>+ New rule</Button>}
      </div>

      <div className="mt-5 flex gap-6 border-b border-line">
        <TabButton id="rules" label="Rules" />
        <TabButton id="ip" label="IP allow / deny" />
      </div>

      {tab === "ip" ? (
        current ? <IPFilters orgId={current.id} canManage={canManage} /> : null
      ) : loading ? (
        <div className="grid place-items-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
      ) : rules.length === 0 ? (
        <div className="mt-6 space-y-4">
          {canManage && (
            <div className="card shadow-soft border-brand/30 bg-brand/5 p-6">
              <h2 className="text-lg font-bold">Protect this workspace in one click</h2>
              <p className="mt-1.5 max-w-xl text-sm text-fg-muted">
                Not sure where to start? We'll add three recommended rules: <b>fraud</b> and <b>bots</b> are
                turned away, and <b>suspicious</b> visitors are flagged so you can review them.
              </p>
              <label className="mt-4 block max-w-md">
                <span className="mb-1.5 block text-sm font-semibold">Where should we send fraud &amp; bots? <span className="font-normal text-fg-dim">(optional)</span></span>
                <input type="url" value={presetUrl} onChange={(e) => setPresetUrl(e.target.value)}
                  placeholder="https://your-site.com/blocked"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </label>
              <p className="mt-1.5 max-w-md text-xs text-fg-dim">
                With a page here, bad visitors are <b>redirected away in real time</b>. Leave it blank and they're
                just <b>labeled</b> in your reports (they still see your page).
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button onClick={applyRecommended} disabled={presetBusy}>{presetBusy ? "Setting up…" : "Add recommended protection"}</Button>
                <Button variant="ghost" onClick={openCreate}>Build my own rule</Button>
              </div>
              {err && <div className="mt-3 rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
            </div>
          )}
          {!canManage && (
            <div className="card shadow-soft p-10 text-center">
              <h2 className="text-lg font-bold">No rules yet</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">An owner or admin can set up traffic protection here.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="card shadow-soft p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-9 place-items-center rounded-lg bg-bg-mute text-xs font-bold text-fg-muted" title="Priority">{r.priority}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.website ? "bg-brand/10 text-brand" : "bg-bg-mute text-fg-dim"}`}>
                        {r.website ? siteName(r.website) || "One website" : "All websites"}
                      </span>
                    </div>
                    <div className="text-xs text-fg-dim">{r.conditions.length} condition{r.conditions.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${actionTone[r.action]}`}
                    title={r.action === "redirect" && r.redirect_url ? r.redirect_url : undefined}>
                    {ACTION_META[r.action].label}{r.action === "tag" && r.tag ? `: ${r.tag}` : ""}{r.action === "redirect" && r.redirect_url ? " →" : ""}
                  </span>
                  {canManage && (
                    <>
                      <button onClick={() => openEdit(r)} className="text-sm font-medium text-brand hover:underline">Edit</button>
                      <button onClick={() => toggle(r)} title={r.active ? "Active — click to pause" : "Paused — click to activate"}
                        className={`h-6 w-11 rounded-full p-0.5 transition ${r.active ? "bg-brand" : "bg-bg-mute"}`}>
                        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${r.active ? "translate-x-5" : ""}`} />
                      </button>
                      <button onClick={() => remove(r.id)} className="text-sm text-red-500 hover:underline">Delete</button>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
                <span className="text-xs font-bold uppercase tracking-wide text-fg-dim">IF</span>
                {r.conditions.map((c, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <span className="text-xs font-semibold text-fg-dim">AND</span>}
                    <span className="rounded-lg border border-line bg-bg-soft px-2 py-1 text-xs">
                      <b>{fieldLabel(c.field)}</b> {opLabel(c.operator)} <b>{valueLabel(c.field, c.value)}</b>
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={closeModal} size="xl" title={editingId ? "Edit traffic rule" : "New traffic rule"}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rule name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Block mobile bots" />
            <Field label="Priority" type="number" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Applies to</span>
            <select value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
              className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
              <option value="">All websites in this workspace</option>
              {sites.map((s) => <option key={s.id} value={s.id}>Only: {s.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-fg-dim">Pick a website to make this rule apply to it only, or keep "All websites" to share it across every site you add.</p>
          </label>

          <div className="rounded-xl border border-line bg-bg-soft p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-fg-dim">IF all conditions match</span>
              <button type="button" onClick={addCond} className="text-xs font-semibold text-brand hover:underline">+ condition</button>
            </div>
            <p className="mb-2.5 rounded-lg bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-fg-muted">
              A visitor must match <b>every</b> condition below for this rule to act. Each condition you add makes the
              rule <b>stricter</b> — it catches <b>fewer</b> visitors, not more. To cover a lot of traffic, use just
              one condition (e.g. only <b>Country is United States</b>). Add a second only to narrow it down further
              (e.g. United States <b>and</b> Bot detected is Yes).
            </p>
            <div className="space-y-2">
              {form.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <select value={c.field} onChange={(e) => setCond(i, { field: e.target.value })}
                    className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand">
                    {RULE_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={c.operator} onChange={(e) => setCond(i, { operator: e.target.value })}
                    className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand">
                    {opsFor(c.field).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <CondValue c={c} onChange={(v) => setCond(i, { value: v })} />
                  {form.conditions.length > 1 && (
                    <button type="button" onClick={() => rmCond(i)} className="text-fg-dim hover:text-red-500">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-fg-dim">Tip: pick “is any of” to match several values at once, e.g. Country is any of <code className="rounded bg-white px-1">US, CA, GB</code>.</p>
          </div>

          <div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">THEN do this</span>
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as RuleAction })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
                {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_META[a].label}</option>)}
              </select>
            </label>
            {/* explain the chosen action in plain language */}
            <p className="mt-1.5 rounded-lg bg-bg-soft px-3 py-2 text-xs text-fg-muted">{ACTION_META[form.action].desc}</p>

            {form.action === "redirect" && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-sm font-semibold">Send them to this page</span>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-fg-dim">Use a ready-made page:</span>
                  {REDIRECT_PRESETS.map((p) => {
                    const url = REDIRECT_ORIGIN + p.path;
                    const active = form.redirect_url === url;
                    return (
                      <button type="button" key={p.path} onClick={() => setForm({ ...form, redirect_url: url })}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${active ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-brand hover:text-brand"}`}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <input type="url" value={form.redirect_url} onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                  placeholder="…or paste your own page URL, e.g. https://yoursite.com/unauthorized" required
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                <p className="mt-1.5 text-xs text-fg-dim">Pick one of our hosted pages above (nothing to build), or paste a link to your own page.</p>
              </label>
            )}
            {form.action === "tag" && (
              <div className="mt-3"><Field label="Label to attach" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} placeholder="fb-traffic" /></div>
            )}
          </div>

          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (editingId ? "Saving…" : "Creating…") : (editingId ? "Save changes" : "Create rule")}
          </Button>
        </form>
      </Modal>
    </div>
  );
}

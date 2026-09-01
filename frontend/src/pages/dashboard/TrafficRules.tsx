import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import IPFilters from "../../components/dashboard/IPFilters";
import { useWorkspace } from "../../context/WorkspaceContext";
import {
  ruleApi, RULE_FIELDS, RULE_OPS, FIELD_VALUE_OPTIONS, COUNTRIES,
  type TrafficRule, type RuleAction, type RuleCondition,
} from "../../lib/api";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/auth/Field";

const ACTIONS: RuleAction[] = ["allow", "redirect", "block", "review", "tag"];
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
  redirect: { label: "Redirect to another page", desc: "Send the visitor to a URL you choose — e.g. send bots to a blank or safe page and keep them off your real offer." },
  block: { label: "Block", desc: "Stop the visitor — they get nothing back. Use for clearly bad traffic." },
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
function opsFor(field: string): readonly (readonly [string, string])[] {
  let allow: string[];
  if (field === "risk_score") allow = NUM_OPS;
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
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<{ name: string; priority: string; action: RuleAction; tag: string; redirect_url: string; conditions: RuleCondition[] }>(
    { name: "", priority: "100", action: "review", tag: "", redirect_url: "", conditions: [emptyCond()] });
  const canManage = current?.role === "owner" || current?.role === "admin";

  async function load() {
    if (!current) return;
    setLoading(true);
    try { setRules((await ruleApi.list(current.id)).results); } finally { setLoading(false); }
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

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      await ruleApi.create({
        organization: current!.id, name: form.name, priority: Number(form.priority),
        action: form.action, tag: form.tag, redirect_url: form.redirect_url, conditions: form.conditions,
      });
      setOpen(false);
      setForm({ name: "", priority: "100", action: "review", tag: "", redirect_url: "", conditions: [emptyCond()] });
      load();
    } catch (e: any) { setErr(e.data?.detail || e.data?.conditions?.[0] || e.message); } finally { setBusy(false); }
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
        {canManage && tab === "rules" && <Button onClick={() => setOpen(true)}>+ New rule</Button>}
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
        <div className="card shadow-soft mt-6 p-10 text-center">
          <h2 className="text-lg font-bold">No rules yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">Create a rule to automatically allow, review, block or tag traffic.</p>
          {canManage && <Button className="mt-4" onClick={() => setOpen(true)}>+ New rule</Button>}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="card shadow-soft p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-9 place-items-center rounded-lg bg-bg-mute text-xs font-bold text-fg-muted" title="Priority">{r.priority}</span>
                  <div>
                    <div className="font-bold">{r.name}</div>
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
                      <button onClick={() => toggle(r)} title={r.active ? "Active" : "Inactive"}
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

      <Modal open={open} onClose={() => setOpen(false)} title="New traffic rule">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rule name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Block mobile bots" />
            <Field label="Priority" type="number" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} />
          </div>

          <div className="rounded-xl border border-line bg-bg-soft p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-fg-dim">IF all conditions match</span>
              <button type="button" onClick={addCond} className="text-xs font-semibold text-brand hover:underline">+ condition</button>
            </div>
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
                <span className="mb-1.5 block text-sm font-semibold">Send them to this URL</span>
                <input type="url" value={form.redirect_url} onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                  placeholder="https://example.com/safe-page" required
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </label>
            )}
            {form.action === "tag" && (
              <div className="mt-3"><Field label="Label to attach" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} placeholder="fb-traffic" /></div>
            )}
          </div>

          {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create rule"}</Button>
        </form>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Field from "../auth/Field";
import { ruleApi, RULE_FIELDS, type RuleAction, type RuleCondition, type ShortLink, type TrafficRule } from "../../lib/api";
import {
  ACTIONS, ACTION_META, REDIRECT_ORIGIN, REDIRECT_PRESETS, actionTone,
  fieldLabel, valueLabel, opLabel, opsFor, emptyCond, CondValue,
} from "./ruleFields";
import { useDialog } from "../../context/DialogContext";

/* Rules attached to ONE redirect.

   Redirect-only customers have no website, so inheriting a site's rules — the
   only option before — was no option at all for them. These use the same
   engine, fields and actions as website rules; they're just scoped to a link. */

type Props = { link: ShortLink | null; orgId: number; onClose: () => void; onSaved: () => void };

const blank = () => ({
  name: "", priority: "100", action: "block" as RuleAction, tag: "", redirect_url: "",
  conditions: [emptyCond()] as RuleCondition[],
});

export default function RedirectRulesModal({ link, orgId, onClose, onSaved }: Props) {
  const [rules, setRules] = useState<TrafficRule[]>([]);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { confirm } = useDialog();

  async function load() {
    if (!link) return;
    try { setRules((await ruleApi.list(orgId, link.id)).results); } catch { setRules([]); }
  }
  useEffect(() => { load(); setAdding(false); setEditingId(null); /* eslint-disable-next-line */ }, [link?.id]);
  if (!link) return null;
  const linkId = link.id;

  const setCond = (i: number, patch: Partial<RuleCondition>) =>
    setForm({ ...form, conditions: form.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  function startAdd() { setForm(blank()); setEditingId(null); setAdding(true); setErr(""); }
  function startEdit(r: TrafficRule) {
    setForm({
      name: r.name, priority: String(r.priority), action: r.action, tag: r.tag || "",
      redirect_url: r.redirect_url || "",
      conditions: r.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })),
    });
    setEditingId(r.id); setAdding(true); setErr("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    const payload = {
      organization: orgId, short_link: linkId, website: null,
      name: form.name || "Rule", priority: Number(form.priority) || 100,
      action: form.action, tag: form.tag, redirect_url: form.redirect_url,
      conditions: form.conditions.filter((c) => c.value !== ""),
    };
    try {
      if (editingId) await ruleApi.update(editingId, payload);
      else await ruleApi.create(payload);
      setAdding(false); setEditingId(null);
      await load(); onSaved();
    } catch (e: any) {
      setErr(e?.data?.detail || e?.data?.conditions?.[0] || "Could not save that rule.");
    } finally { setBusy(false); }
  }

  async function remove(r: TrafficRule) {
    if (!(await confirm({
      title: "Delete this rule?",
      message: "Traffic matching it will no longer be filtered on this redirect.",
      confirmLabel: "Delete rule",
    }))) return;
    await ruleApi.remove(r.id);
    await load(); onSaved();
  }

  return (
    <Modal open={!!link} onClose={onClose} size="wide"
           title={`Rules for ${link.domain_host || ""}/${link.slug}`}>
      <div className="space-y-4">
        <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">Your link</div>
          <div className="mt-0.5 break-all font-mono text-sm font-semibold text-fg">
            {link.short_url}
          </div>
        </div>
        <p className="rounded-lg bg-brand/5 px-3 py-2 text-xs leading-relaxed text-fg-muted">
          Rules run top to bottom and the <b>first match wins</b>. They're checked on every click of
          this redirect, before anyone reaches your destination — so you can block by country,
          device, OS, browser, risk score, VPN and more. These apply to this link only.
        </p>

        {rules.length > 0 && (
          <div className="space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-bg-mute px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-fg-dim">{r.priority}</span>
                    <span className="font-semibold">{r.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${actionTone[r.action]}`}>
                      {ACTION_META[r.action].label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button onClick={() => startEdit(r)} className="font-semibold text-brand hover:underline">Edit</button>
                    <button onClick={() => remove(r)} className="font-semibold text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-fg-dim">IF</span>
                  {r.conditions.map((c, i) => (
                    <span key={i} className="rounded-md bg-bg-soft px-2 py-0.5">
                      <b>{fieldLabel(c.field)}</b> {opLabel(c.operator)} <b>{valueLabel(c.field, c.value)}</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!adding ? (
          <div className="flex items-center justify-between">
            {rules.length === 0 && (
              <span className="text-sm text-fg-muted">
                <b className="text-fg">Your link already works.</b> Rules are optional — add one
                to allow or block visitors by country, device, OS, browser or risk.
              </span>
            )}
            <Button onClick={startAdd} variant="outline" className="ml-auto shrink-0">+ Add a rule</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-bg-soft p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Rule name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Block mobile from Nigeria" />
              <Field label="Priority" type="number" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} />
            </div>

            <div className="rounded-xl border border-line bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-fg-dim">IF all conditions match</span>
                <button type="button" onClick={() => setForm({ ...form, conditions: [...form.conditions, emptyCond()] })}
                  className="text-xs font-semibold text-brand hover:underline">+ condition</button>
              </div>
              <p className="mb-2.5 rounded-lg bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-fg-muted">
                A visitor must match <b>every</b> condition for this rule to act, so each one you add
                catches <b>fewer</b> visitors, not more. Start with one.
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
                      <button type="button" onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, j) => j !== i) })}
                        className="text-fg-dim hover:text-red-500" aria-label="Remove condition">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">THEN do this</span>
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value as RuleAction })}
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand">
                {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_META[a].label}</option>)}
              </select>
              <p className="mt-1.5 rounded-lg bg-white px-3 py-2 text-xs text-fg-muted">{ACTION_META[form.action].desc}</p>
            </label>

            {form.action === "redirect" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold">Send them to this page</span>
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-fg-dim">Ready-made:</span>
                  {REDIRECT_PRESETS.map((pr) => {
                    const url = REDIRECT_ORIGIN + pr.path;
                    return (
                      <button type="button" key={pr.path} onClick={() => setForm({ ...form, redirect_url: url })}
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${form.redirect_url === url ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-brand hover:text-brand"}`}>
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
                <input type="url" value={form.redirect_url} required
                  onChange={(e) => setForm({ ...form, redirect_url: e.target.value })}
                  placeholder="…or your own page URL"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand" />
              </label>
            )}
            {form.action === "tag" && (
              <Field label="Label to attach" value={form.tag} onChange={(v) => setForm({ ...form, tag: v })} placeholder="fb-traffic" />
            )}

            {err && <div className="rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Saving…" : editingId ? "Save changes" : "Add rule"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

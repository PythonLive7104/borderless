/* Shared rule-building pieces.
   Used by the Traffic Rules page (website rules) and by the per-redirect rules
   modal, so the two can't drift into describing the same engine differently. */
import { RULE_FIELDS, RULE_OPS, FIELD_VALUE_OPTIONS, COUNTRIES, type RuleAction, type RuleCondition } from "../../lib/api";

export const ACTIONS: RuleAction[] = ["allow", "redirect", "block", "review", "tag"];

// Ready-made pages we host, so users don't have to build their own "blocked" page.
export const REDIRECT_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
export const REDIRECT_PRESETS: { label: string; path: string }[] = [
  { label: "Access denied", path: "/blocked.html" },
  { label: "Unauthorised access", path: "/unauthorized.html" },
  { label: "404 Not found", path: "/not-found.html" },
];
export const actionTone: Record<RuleAction, string> = {
  allow: "bg-success/10 text-emerald-700",
  redirect: "bg-indigo-500/10 text-indigo-600",
  block: "bg-danger/10 text-red-600",
  review: "bg-warning/10 text-amber-700",
  tag: "bg-brand/10 text-brand",
};
// Plain-English meaning of each action, shown to guide non-technical users.
export const ACTION_META: Record<RuleAction, { label: string; desc: string }> = {
  allow: { label: "Allow", desc: "Let the visitor through normally. Use this to always trust certain traffic." },
  redirect: { label: "Redirect (turn them away)", desc: "The only action that stops a visitor in real time: their browser is sent to a URL you choose (e.g. a blank or safe page), so bots and fraud never reach your real page. Use this to actually keep bad traffic out." },
  block: { label: "Block (label only)", desc: "Marks the visitor as blocked in your Click Log and reports — but with the tracking snippet they still load the page. To truly turn a visitor away in real time, use “Redirect” instead." },
  review: { label: "Flag for review", desc: "Don't stop anyone — just mark these visits so you can inspect them later in Visitors / Click Log." },
  tag: { label: "Add a label (tag)", desc: "Attach a label of your choice for filtering and reports. The visitor is not affected." },
};
export const fieldLabel = (f: string) => RULE_FIELDS.find(([v]) => v === f)?.[1] || f;
export const opLabel = (o: string) => RULE_OPS.find(([v]) => v === o)?.[1] || o;
// Show the friendly label for a stored value (e.g. "mobile" -> "Mobile", "RU" -> "Russia").
export function valueLabel(field: string, value: string): string {
  const opts = FIELD_VALUE_OPTIONS[field];
  if (opts) return opts.find(([v]) => v === value)?.[1] || value;
  if (field === "country") return COUNTRIES.find(([v]) => v === value)?.[1] || value;
  return value;
}

// Operators that make sense per field type.
export const NUM_OPS = ["gte", "gt", "lte", "lt", "eq", "ne"];
export const ENUM_OPS = ["eq", "ne", "in"];
export const TEXT_OPS = ["eq", "ne", "contains", "in"];
export const NUMERIC_FIELDS = ["risk_score", "requests_per_min"];
export function opsFor(field: string): readonly (readonly [string, string])[] {
  let allow: string[];
  if (NUMERIC_FIELDS.includes(field)) allow = NUM_OPS;
  else if (FIELD_VALUE_OPTIONS[field] || field === "country") allow = ENUM_OPS;
  else allow = TEXT_OPS;
  return RULE_OPS.filter(([v]) => allow.includes(v));
}
export const emptyCond = (): RuleCondition => ({ field: "risk_score", operator: "gte", value: "" });

// A value editor that adapts to the chosen field.

export function CondValue({ c, onChange }: { c: RuleCondition; onChange: (v: string) => void }) {
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

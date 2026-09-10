import { jsx, jsxs } from "react/jsx-runtime";
import { R as RULE_FIELDS, G as RULE_OPS, H as FIELD_VALUE_OPTIONS, J as COUNTRIES } from "../entry-server.js";
const ACTIONS = ["allow", "redirect", "block", "review", "tag"];
const REDIRECT_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const REDIRECT_PRESETS = [
  { label: "Access denied", path: "/blocked.html" },
  { label: "Unauthorised access", path: "/unauthorized.html" },
  { label: "404 Not found", path: "/not-found.html" }
];
const actionTone = {
  allow: "bg-success/10 text-emerald-700",
  redirect: "bg-indigo-500/10 text-indigo-600",
  block: "bg-danger/10 text-red-600",
  review: "bg-warning/10 text-amber-700",
  tag: "bg-brand/10 text-brand"
};
const ACTION_META = {
  allow: { label: "Allow", desc: "Let the visitor through normally. Use this to always trust certain traffic." },
  redirect: { label: "Redirect (turn them away)", desc: "The only action that stops a visitor in real time: their browser is sent to a URL you choose (e.g. a blank or safe page), so bots and fraud never reach your real page. Use this to actually keep bad traffic out." },
  block: { label: "Block (label only)", desc: "Marks the visitor as blocked in your Click Log and reports — but with the tracking snippet they still load the page. To truly turn a visitor away in real time, use “Redirect” instead." },
  review: { label: "Flag for review", desc: "Don't stop anyone — just mark these visits so you can inspect them later in Visitors / Click Log." },
  tag: { label: "Add a label (tag)", desc: "Attach a label of your choice for filtering and reports. The visitor is not affected." }
};
const fieldLabel = (f) => {
  var _a;
  return ((_a = RULE_FIELDS.find(([v]) => v === f)) == null ? void 0 : _a[1]) || f;
};
const opLabel = (o) => {
  var _a;
  return ((_a = RULE_OPS.find(([v]) => v === o)) == null ? void 0 : _a[1]) || o;
};
function valueLabel(field, value) {
  var _a, _b;
  const opts = FIELD_VALUE_OPTIONS[field];
  if (opts) return ((_a = opts.find(([v]) => v === value)) == null ? void 0 : _a[1]) || value;
  if (field === "country") return ((_b = COUNTRIES.find(([v]) => v === value)) == null ? void 0 : _b[1]) || value;
  return value;
}
const NUM_OPS = ["gte", "gt", "lte", "lt", "eq", "ne"];
const ENUM_OPS = ["eq", "ne", "in"];
const TEXT_OPS = ["eq", "ne", "contains", "in"];
const NUMERIC_FIELDS = ["risk_score", "requests_per_min"];
function opsFor(field) {
  let allow;
  if (NUMERIC_FIELDS.includes(field)) allow = NUM_OPS;
  else if (FIELD_VALUE_OPTIONS[field] || field === "country") allow = ENUM_OPS;
  else allow = TEXT_OPS;
  return RULE_OPS.filter(([v]) => allow.includes(v));
}
const emptyCond = () => ({ field: "risk_score", operator: "gte", value: "" });
function CondValue({ c, onChange }) {
  const cls = "min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand";
  const opts = FIELD_VALUE_OPTIONS[c.field];
  if (c.field === "risk_score")
    return /* @__PURE__ */ jsx("input", { type: "number", min: 0, max: 100, value: c.value, onChange: (e) => onChange(e.target.value), placeholder: "0–100", required: true, className: cls });
  if (c.field === "requests_per_min")
    return /* @__PURE__ */ jsx("input", { type: "number", min: 1, value: c.value, onChange: (e) => onChange(e.target.value), placeholder: "e.g. 30", required: true, className: cls });
  if (c.field === "country")
    return /* @__PURE__ */ jsxs("select", { value: c.value, onChange: (e) => onChange(e.target.value), required: true, className: cls, children: [
      /* @__PURE__ */ jsx("option", { value: "", children: "Country…" }),
      COUNTRIES.map(([v, l]) => /* @__PURE__ */ jsxs("option", { value: v, children: [
        l,
        " (",
        v,
        ")"
      ] }, v))
    ] });
  if (opts)
    return /* @__PURE__ */ jsxs("select", { value: c.value, onChange: (e) => onChange(e.target.value), required: true, className: cls, children: [
      /* @__PURE__ */ jsx("option", { value: "", children: "Choose…" }),
      opts.map(([v, l]) => /* @__PURE__ */ jsx("option", { value: v, children: l }, v))
    ] });
  return /* @__PURE__ */ jsx("input", { value: c.value, onChange: (e) => onChange(e.target.value), placeholder: "value", required: true, className: cls });
}
export {
  ACTION_META as A,
  CondValue as C,
  REDIRECT_PRESETS as R,
  actionTone as a,
  opsFor as b,
  ACTIONS as c,
  REDIRECT_ORIGIN as d,
  emptyCond as e,
  fieldLabel as f,
  opLabel as o,
  valueLabel as v
};

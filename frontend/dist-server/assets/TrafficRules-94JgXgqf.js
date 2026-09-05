import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { A as useDialog, B as Button, E as ipFilterApi, c as useWorkspace, R as RULE_FIELDS, F as ruleApi, x as websiteApi, G as RULE_OPS, H as FIELD_VALUE_OPTIONS, J as COUNTRIES } from "../entry-server.js";
import { M as Modal } from "./Modal-CEHlixCW.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function IPFilters({ orgId, canManage }) {
  const { confirm } = useDialog();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [kind, setKind] = useState("deny");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function load() {
    setLoading(true);
    try {
      setEntries((await ipFilterApi.list(orgId)).results);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [orgId]);
  async function add(e) {
    var _a, _b, _c;
    e.preventDefault();
    setErr("");
    if (!value.trim()) {
      setErr("Enter an IP address or CIDR range.");
      return;
    }
    setBusy(true);
    try {
      await ipFilterApi.create({ organization: orgId, value: value.trim(), kind, note: note.trim() });
      setValue("");
      setNote("");
      await load();
    } catch (e2) {
      setErr(((_b = (_a = e2.data) == null ? void 0 : _a.value) == null ? void 0 : _b[0]) || ((_c = e2.data) == null ? void 0 : _c.detail) || "Could not add the entry.");
    } finally {
      setBusy(false);
    }
  }
  async function del(entry) {
    if (!await confirm({
      title: "Remove this entry?",
      message: `${entry.value} will no longer be filtered.`,
      confirmLabel: "Remove"
    })) return;
    await ipFilterApi.remove(entry.id);
    await load();
  }
  async function toggle(entry) {
    await ipFilterApi.update(entry.id, { active: !entry.active });
    await load();
  }
  const deny = entries.filter((e) => e.kind === "deny");
  const allow = entries.filter((e) => e.kind === "allow");
  return /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-6", children: [
    /* @__PURE__ */ jsxs("p", { className: "text-sm text-fg-muted", children: [
      "Block or always-allow specific IPs and ranges. Enforced instantly on every request: a ",
      /* @__PURE__ */ jsx("b", { children: "blocked" }),
      " IP is stopped outright, an ",
      /* @__PURE__ */ jsx("b", { children: "allowed" }),
      " IP always passes (it beats every other rule). Accepts an exact IP (",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1", children: "1.2.3.4" }),
      ") or a CIDR range (",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1", children: "10.0.0.0/8" }),
      ")."
    ] }),
    canManage && /* @__PURE__ */ jsxs("form", { onSubmit: add, className: "card shadow-soft flex flex-wrap items-end gap-3 p-4", children: [
      /* @__PURE__ */ jsxs("label", { className: "min-w-[180px] flex-1", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1 block text-xs font-semibold text-fg-dim", children: "IP or CIDR" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value,
            onChange: (e) => setValue(e.target.value),
            placeholder: "1.2.3.4 or 10.0.0.0/8",
            className: "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1 block text-xs font-semibold text-fg-dim", children: "List" }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: kind,
            onChange: (e) => setKind(e.target.value),
            className: "rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand",
            children: [
              /* @__PURE__ */ jsx("option", { value: "deny", children: "Block (blacklist)" }),
              /* @__PURE__ */ jsx("option", { value: "allow", children: "Allow (whitelist)" })
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "min-w-[160px] flex-1", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1 block text-xs font-semibold text-fg-dim", children: "Note (optional)" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value: note,
            onChange: (e) => setNote(e.target.value),
            placeholder: "why?",
            className: "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          }
        )
      ] }),
      /* @__PURE__ */ jsx(Button, { type: "submit", disabled: busy, children: busy ? "Adding…" : "Add" }),
      err && /* @__PURE__ */ jsx("p", { className: "w-full text-sm text-red-600", children: err })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-12", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : /* @__PURE__ */ jsx("div", { className: "grid gap-5 lg:grid-cols-2", children: [["deny", "Blocked IPs", deny], ["allow", "Allowed IPs", allow]].map(([k, title, list]) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
      /* @__PURE__ */ jsxs("h3", { className: "flex items-center gap-2 text-sm font-bold", children: [
        /* @__PURE__ */ jsx("span", { className: `inline-block h-2 w-2 rounded-full ${k === "deny" ? "bg-red-500" : "bg-emerald-500"}` }),
        title,
        " ",
        /* @__PURE__ */ jsxs("span", { className: "text-fg-dim", children: [
          "(",
          list.length,
          ")"
        ] })
      ] }),
      list.length === 0 ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-fg-muted", children: "Nothing here yet." }) : /* @__PURE__ */ jsx("ul", { className: "mt-3 divide-y divide-line", children: list.map((e) => /* @__PURE__ */ jsxs("li", { className: `flex items-center justify-between py-2.5 ${!e.active ? "opacity-50" : ""}`, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "font-mono text-sm", children: e.value }),
          e.note && /* @__PURE__ */ jsx("div", { className: "text-xs text-fg-dim", children: e.note })
        ] }),
        canManage && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => toggle(e), className: "text-xs text-fg-muted hover:text-brand", children: e.active ? "Pause" : "Resume" }),
          /* @__PURE__ */ jsx("button", { onClick: () => del(e), className: "text-xs text-red-600 hover:underline", children: "Remove" })
        ] })
      ] }, e.id)) })
    ] }, k)) })
  ] });
}
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
function TrafficRules() {
  const { confirm } = useDialog();
  const { current } = useWorkspace();
  const [tab, setTab] = useState("rules");
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [presetUrl, setPresetUrl] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const [sites, setSites] = useState([]);
  const blank = { name: "", priority: "100", action: "review", tag: "", redirect_url: "", website: "", conditions: [emptyCond()] };
  const [form, setForm] = useState(blank);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  const siteName = (id) => {
    var _a;
    return (_a = sites.find((s) => s.id === id)) == null ? void 0 : _a.name;
  };
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [r, w] = await Promise.all([ruleApi.list(current.id), websiteApi.list(current.id)]);
      setRules(r.results);
      setSites(w.results);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  function setCond(i, patch) {
    setForm((f) => ({
      ...f,
      conditions: f.conditions.map((c, j) => {
        if (j !== i) return c;
        const next = { ...c, ...patch };
        if (patch.field && patch.field !== c.field) {
          next.value = "";
          const ops = opsFor(patch.field).map(([v]) => v);
          if (!ops.includes(next.operator)) next.operator = ops[0];
        }
        return next;
      })
    }));
  }
  const addCond = () => setForm((f) => ({ ...f, conditions: [...f.conditions, emptyCond()] }));
  const rmCond = (i) => setForm((f) => ({ ...f, conditions: f.conditions.filter((_, j) => j !== i) }));
  function openCreate() {
    setEditingId(null);
    setForm(blank);
    setErr("");
    setOpen(true);
  }
  function openEdit(r) {
    setEditingId(r.id);
    setForm({
      name: r.name,
      priority: String(r.priority),
      action: r.action,
      tag: r.tag || "",
      redirect_url: r.redirect_url || "",
      website: r.website ? String(r.website) : "",
      conditions: r.conditions.length ? r.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value })) : [emptyCond()]
    });
    setErr("");
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
    setEditingId(null);
  }
  async function submit(e) {
    var _a, _b, _c;
    e.preventDefault();
    setErr("");
    setBusy(true);
    const payload = {
      name: form.name,
      priority: Number(form.priority),
      action: form.action,
      tag: form.tag,
      redirect_url: form.redirect_url,
      conditions: form.conditions,
      website: form.website ? Number(form.website) : null
    };
    try {
      if (editingId) await ruleApi.update(editingId, payload);
      else await ruleApi.create({ organization: current.id, ...payload });
      closeModal();
      setForm(blank);
      load();
    } catch (e2) {
      setErr(((_a = e2.data) == null ? void 0 : _a.detail) || ((_c = (_b = e2.data) == null ? void 0 : _b.conditions) == null ? void 0 : _c[0]) || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function applyRecommended() {
    var _a;
    if (!current) return;
    setPresetBusy(true);
    setErr("");
    const badAction = presetUrl ? "redirect" : "block";
    const mk = (name, cls, priority, action) => ruleApi.create({
      organization: current.id,
      name,
      priority,
      action,
      tag: "",
      redirect_url: action === "redirect" ? presetUrl : "",
      conditions: [{ field: "classification", operator: "eq", value: cls }]
    });
    try {
      await mk("Turn away fraud", "fraud", 10, badAction);
      await mk("Turn away bots", "bot", 20, badAction);
      await mk("Flag suspicious for review", "suspicious", 30, "review");
      setPresetUrl("");
      load();
    } catch (e) {
      setErr(((_a = e.data) == null ? void 0 : _a.detail) || e.message);
    } finally {
      setPresetBusy(false);
    }
  }
  async function toggle(r) {
    await ruleApi.update(r.id, { active: !r.active });
    load();
  }
  async function remove(id) {
    if (!await confirm({
      title: "Delete this rule?",
      message: "Traffic matching it will no longer be filtered.",
      confirmLabel: "Delete rule"
    })) return;
    await ruleApi.remove(id);
    load();
  }
  const TabButton = ({ id, label }) => /* @__PURE__ */ jsx(
    "button",
    {
      onClick: () => setTab(id),
      className: `border-b-2 px-1 pb-2 text-sm font-semibold transition ${tab === id ? "border-brand text-brand" : "border-transparent text-fg-muted hover:text-fg"}`,
      children: label
    }
  );
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "traffic-rules", children: [
      "Rules act for you automatically. Example: “if a visitor is on mobile from Nigeria → block”. Pick what to check and what should happen. Rules run top to bottom and the ",
      /* @__PURE__ */ jsx("b", { children: "first match wins" }),
      ". Use ",
      /* @__PURE__ */ jsx("b", { children: "IP allow/deny" }),
      " to hard-block or always-allow specific addresses."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Traffic Rules" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Filter by risk, country, device, OS, browser, JA3 and more — or manage IP allow/deny lists." })
      ] }),
      canManage && tab === "rules" && /* @__PURE__ */ jsx(Button, { onClick: openCreate, children: "+ New rule" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 flex gap-6 border-b border-line", children: [
      /* @__PURE__ */ jsx(TabButton, { id: "rules", label: "Rules" }),
      /* @__PURE__ */ jsx(TabButton, { id: "ip", label: "IP allow / deny" })
    ] }),
    tab === "ip" ? current ? /* @__PURE__ */ jsx(IPFilters, { orgId: current.id, canManage }) : null : loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rules.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "mt-6 space-y-4", children: [
      canManage && /* @__PURE__ */ jsxs("div", { className: "card shadow-soft border-brand/30 bg-brand/5 p-6", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "Protect this workspace in one click" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1.5 max-w-xl text-sm text-fg-muted", children: [
          "Not sure where to start? We'll add three recommended rules: ",
          /* @__PURE__ */ jsx("b", { children: "fraud" }),
          " and ",
          /* @__PURE__ */ jsx("b", { children: "bots" }),
          " are turned away, and ",
          /* @__PURE__ */ jsx("b", { children: "suspicious" }),
          " visitors are flagged so you can review them."
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "mt-4 block max-w-md", children: [
          /* @__PURE__ */ jsxs("span", { className: "mb-1.5 block text-sm font-semibold", children: [
            "Where should we send fraud & bots? ",
            /* @__PURE__ */ jsx("span", { className: "font-normal text-fg-dim", children: "(optional)" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "url",
              value: presetUrl,
              onChange: (e) => setPresetUrl(e.target.value),
              placeholder: "https://your-site.com/blocked",
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1.5 max-w-md text-xs text-fg-dim", children: [
          "With a page here, bad visitors are ",
          /* @__PURE__ */ jsx("b", { children: "redirected away in real time" }),
          ". Leave it blank and they're just ",
          /* @__PURE__ */ jsx("b", { children: "labeled" }),
          " in your reports (they still see your page)."
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap gap-3", children: [
          /* @__PURE__ */ jsx(Button, { onClick: applyRecommended, disabled: presetBusy, children: presetBusy ? "Setting up…" : "Add recommended protection" }),
          /* @__PURE__ */ jsx(Button, { variant: "ghost", onClick: openCreate, children: "Build my own rule" })
        ] }),
        err && /* @__PURE__ */ jsx("div", { className: "mt-3 rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err })
      ] }),
      !canManage && /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-10 text-center", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "No rules yet" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-sm text-sm text-fg-muted", children: "An owner or admin can set up traffic protection here." })
      ] })
    ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-3", children: rules.map((r) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("span", { className: "grid h-7 w-9 place-items-center rounded-lg bg-bg-mute text-xs font-bold text-fg-muted", title: "Priority", children: r.priority }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "font-bold", children: r.name }),
              /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.website ? "bg-brand/10 text-brand" : "bg-bg-mute text-fg-dim"}`, children: r.website ? siteName(r.website) || "One website" : "All websites" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-xs text-fg-dim", children: [
              r.conditions.length,
              " condition",
              r.conditions.length === 1 ? "" : "s"
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsxs(
            "span",
            {
              className: `rounded-full px-2.5 py-1 text-xs font-semibold ${actionTone[r.action]}`,
              title: r.action === "redirect" && r.redirect_url ? r.redirect_url : void 0,
              children: [
                ACTION_META[r.action].label,
                r.action === "tag" && r.tag ? `: ${r.tag}` : "",
                r.action === "redirect" && r.redirect_url ? " →" : ""
              ]
            }
          ),
          canManage && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx("button", { onClick: () => openEdit(r), className: "text-sm font-medium text-brand hover:underline", children: "Edit" }),
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggle(r),
                title: r.active ? "Active — click to pause" : "Paused — click to activate",
                className: `h-6 w-11 rounded-full p-0.5 transition ${r.active ? "bg-brand" : "bg-bg-mute"}`,
                children: /* @__PURE__ */ jsx("span", { className: `block h-5 w-5 rounded-full bg-white shadow transition ${r.active ? "translate-x-5" : ""}` })
              }
            ),
            /* @__PURE__ */ jsx("button", { onClick: () => remove(r.id), className: "text-sm text-red-500 hover:underline", children: "Delete" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm", children: [
        /* @__PURE__ */ jsx("span", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "IF" }),
        r.conditions.map((c, i) => /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1.5", children: [
          i > 0 && /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-fg-dim", children: "AND" }),
          /* @__PURE__ */ jsxs("span", { className: "rounded-lg border border-line bg-bg-soft px-2 py-1 text-xs", children: [
            /* @__PURE__ */ jsx("b", { children: fieldLabel(c.field) }),
            " ",
            opLabel(c.operator),
            " ",
            /* @__PURE__ */ jsx("b", { children: valueLabel(c.field, c.value) })
          ] })
        ] }, i))
      ] })
    ] }, r.id)) }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: closeModal, size: "xl", title: editingId ? "Edit traffic rule" : "New traffic rule", children: /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsx(Field, { label: "Rule name", value: form.name, onChange: (v) => setForm({ ...form, name: v }), placeholder: "Block mobile bots" }),
        /* @__PURE__ */ jsx(Field, { label: "Priority", type: "number", value: form.priority, onChange: (v) => setForm({ ...form, priority: v }) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Applies to" }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: form.website,
            onChange: (e) => setForm({ ...form, website: e.target.value }),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "All websites in this workspace" }),
              sites.map((s) => /* @__PURE__ */ jsxs("option", { value: s.id, children: [
                "Only: ",
                s.name
              ] }, s.id))
            ]
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-fg-dim", children: 'Pick a website to make this rule apply to it only, or keep "All websites" to share it across every site you add.' })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line bg-bg-soft p-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("span", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "IF all conditions match" }),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: addCond, className: "text-xs font-semibold text-brand hover:underline", children: "+ condition" })
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "mb-2.5 rounded-lg bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-fg-muted", children: [
          "A visitor must match ",
          /* @__PURE__ */ jsx("b", { children: "every" }),
          " condition below for this rule to act. Each condition you add makes the rule ",
          /* @__PURE__ */ jsx("b", { children: "stricter" }),
          " — it catches ",
          /* @__PURE__ */ jsx("b", { children: "fewer" }),
          " visitors, not more. To cover a lot of traffic, use just one condition (e.g. only ",
          /* @__PURE__ */ jsx("b", { children: "Country is United States" }),
          "). Add a second only to narrow it down further (e.g. United States ",
          /* @__PURE__ */ jsx("b", { children: "and" }),
          " Bot detected is Yes)."
        ] }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2", children: form.conditions.map((c, i) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
          /* @__PURE__ */ jsx(
            "select",
            {
              value: c.field,
              onChange: (e) => setCond(i, { field: e.target.value }),
              className: "min-w-0 flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand",
              children: RULE_FIELDS.map(([v, l]) => /* @__PURE__ */ jsx("option", { value: v, children: l }, v))
            }
          ),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: c.operator,
              onChange: (e) => setCond(i, { operator: e.target.value }),
              className: "rounded-lg border border-line bg-white px-2 py-1.5 text-xs outline-none focus:border-brand",
              children: opsFor(c.field).map(([v, l]) => /* @__PURE__ */ jsx("option", { value: v, children: l }, v))
            }
          ),
          /* @__PURE__ */ jsx(CondValue, { c, onChange: (v) => setCond(i, { value: v }) }),
          form.conditions.length > 1 && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => rmCond(i), className: "text-fg-dim hover:text-red-500", children: /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })
        ] }, i)) }),
        /* @__PURE__ */ jsxs("p", { className: "mt-2 text-[11px] text-fg-dim", children: [
          "Tip: pick “is any of” to match several values at once, e.g. Country is any of ",
          /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1", children: "US, CA, GB" }),
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "THEN do this" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: form.action,
              onChange: (e) => setForm({ ...form, action: e.target.value }),
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
              children: ACTIONS.map((a) => /* @__PURE__ */ jsx("option", { value: a, children: ACTION_META[a].label }, a))
            }
          )
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-1.5 rounded-lg bg-bg-soft px-3 py-2 text-xs text-fg-muted", children: ACTION_META[form.action].desc }),
        form.action === "redirect" && /* @__PURE__ */ jsxs("label", { className: "mt-3 block", children: [
          /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Send them to this page" }),
          /* @__PURE__ */ jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-1.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "Use a ready-made page:" }),
            REDIRECT_PRESETS.map((p) => {
              const url = REDIRECT_ORIGIN + p.path;
              const active = form.redirect_url === url;
              return /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setForm({ ...form, redirect_url: url }),
                  className: `rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${active ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-brand hover:text-brand"}`,
                  children: p.label
                },
                p.path
              );
            })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "url",
              value: form.redirect_url,
              onChange: (e) => setForm({ ...form, redirect_url: e.target.value }),
              placeholder: "…or paste your own page URL, e.g. https://yoursite.com/unauthorized",
              required: true,
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs text-fg-dim", children: "Pick one of our hosted pages above (nothing to build), or paste a link to your own page." })
        ] }),
        form.action === "tag" && /* @__PURE__ */ jsx("div", { className: "mt-3", children: /* @__PURE__ */ jsx(Field, { label: "Label to attach", value: form.tag, onChange: (v) => setForm({ ...form, tag: v }), placeholder: "fb-traffic" }) })
      ] }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: busy, children: busy ? editingId ? "Saving…" : "Creating…" : editingId ? "Save changes" : "Create rule" })
    ] }) })
  ] });
}
export {
  TrafficRules as default
};

import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { A as useDialog, B as Button, R as RULE_FIELDS, F as ruleApi, c as useWorkspace, y as linkApi, x as websiteApi, d as billingApi } from "../entry-server.js";
import { u as useLivePoll } from "./useLivePoll-JHywBTNY.js";
import { M as Modal } from "./Modal-CCIcMfR1.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { A as ACTION_META, a as actionTone, f as fieldLabel, o as opLabel, v as valueLabel, e as emptyCond, b as opsFor, C as CondValue, c as ACTIONS, R as REDIRECT_PRESETS, d as REDIRECT_ORIGIN } from "./ruleFields-BHbrkhqx.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const blank = () => ({
  name: "",
  priority: "100",
  action: "block",
  tag: "",
  redirect_url: "",
  conditions: [emptyCond()]
});
function RedirectRulesModal({ link, orgId, onClose, onSaved }) {
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState(blank());
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { confirm } = useDialog();
  async function load() {
    if (!link) return;
    try {
      setRules((await ruleApi.list(orgId, link.id)).results);
    } catch {
      setRules([]);
    }
  }
  useEffect(() => {
    load();
    setAdding(false);
    setEditingId(null);
  }, [link == null ? void 0 : link.id]);
  if (!link) return null;
  const linkId = link.id;
  const setCond = (i, patch) => setForm({ ...form, conditions: form.conditions.map((c, j) => j === i ? { ...c, ...patch } : c) });
  function startAdd() {
    setForm(blank());
    setEditingId(null);
    setAdding(true);
    setErr("");
  }
  function startEdit(r) {
    setForm({
      name: r.name,
      priority: String(r.priority),
      action: r.action,
      tag: r.tag || "",
      redirect_url: r.redirect_url || "",
      conditions: r.conditions.map((c) => ({ field: c.field, operator: c.operator, value: c.value }))
    });
    setEditingId(r.id);
    setAdding(true);
    setErr("");
  }
  async function submit(e) {
    var _a, _b, _c;
    e.preventDefault();
    setBusy(true);
    setErr("");
    const payload = {
      organization: orgId,
      short_link: linkId,
      website: null,
      name: form.name || "Rule",
      priority: Number(form.priority) || 100,
      action: form.action,
      tag: form.tag,
      redirect_url: form.redirect_url,
      conditions: form.conditions.filter((c) => c.value !== "")
    };
    try {
      if (editingId) await ruleApi.update(editingId, payload);
      else await ruleApi.create(payload);
      setAdding(false);
      setEditingId(null);
      await load();
      onSaved();
    } catch (e2) {
      setErr(((_a = e2 == null ? void 0 : e2.data) == null ? void 0 : _a.detail) || ((_c = (_b = e2 == null ? void 0 : e2.data) == null ? void 0 : _b.conditions) == null ? void 0 : _c[0]) || "Could not save that rule.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(r) {
    if (!await confirm({
      title: "Delete this rule?",
      message: "Traffic matching it will no longer be filtered on this redirect.",
      confirmLabel: "Delete rule"
    })) return;
    await ruleApi.remove(r.id);
    await load();
    onSaved();
  }
  return /* @__PURE__ */ jsx(
    Modal,
    {
      open: !!link,
      onClose,
      size: "wide",
      title: `Rules for ${link.domain_host || ""}/${link.slug}`,
      children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("p", { className: "rounded-lg bg-brand/5 px-3 py-2 text-xs leading-relaxed text-fg-muted", children: [
          "Rules run top to bottom and the ",
          /* @__PURE__ */ jsx("b", { children: "first match wins" }),
          ". They're checked on every click of this redirect, before anyone reaches your destination — so you can block by country, device, OS, browser, risk score, VPN and more. These apply to this link only."
        ] }),
        rules.length > 0 && /* @__PURE__ */ jsx("div", { className: "space-y-2", children: rules.map((r) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line p-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "rounded-md bg-bg-mute px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-fg-dim", children: r.priority }),
              /* @__PURE__ */ jsx("span", { className: "font-semibold", children: r.name }),
              /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold ${actionTone[r.action]}`, children: ACTION_META[r.action].label })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-xs", children: [
              /* @__PURE__ */ jsx("button", { onClick: () => startEdit(r), className: "font-semibold text-brand hover:underline", children: "Edit" }),
              /* @__PURE__ */ jsx("button", { onClick: () => remove(r), className: "font-semibold text-red-500 hover:underline", children: "Delete" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-2 flex flex-wrap items-center gap-1.5 text-xs", children: [
            /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "IF" }),
            r.conditions.map((c, i) => /* @__PURE__ */ jsxs("span", { className: "rounded-md bg-bg-soft px-2 py-0.5", children: [
              /* @__PURE__ */ jsx("b", { children: fieldLabel(c.field) }),
              " ",
              opLabel(c.operator),
              " ",
              /* @__PURE__ */ jsx("b", { children: valueLabel(c.field, c.value) })
            ] }, i))
          ] })
        ] }, r.id)) }),
        !adding ? /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          rules.length === 0 && /* @__PURE__ */ jsx("span", { className: "text-sm text-fg-muted", children: "No rules yet — this redirect uses the bot handling you chose when creating it." }),
          /* @__PURE__ */ jsx(Button, { onClick: startAdd, variant: "outline", className: "ml-auto", children: "+ Add a rule" })
        ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4 rounded-xl border border-line bg-bg-soft p-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsx(Field, { label: "Rule name", value: form.name, onChange: (v) => setForm({ ...form, name: v }), placeholder: "Block mobile from Nigeria" }),
            /* @__PURE__ */ jsx(Field, { label: "Priority", type: "number", value: form.priority, onChange: (v) => setForm({ ...form, priority: v }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line bg-white p-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "IF all conditions match" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setForm({ ...form, conditions: [...form.conditions, emptyCond()] }),
                  className: "text-xs font-semibold text-brand hover:underline",
                  children: "+ condition"
                }
              )
            ] }),
            /* @__PURE__ */ jsxs("p", { className: "mb-2.5 rounded-lg bg-brand/5 px-3 py-2 text-[11px] leading-relaxed text-fg-muted", children: [
              "A visitor must match ",
              /* @__PURE__ */ jsx("b", { children: "every" }),
              " condition for this rule to act, so each one you add catches ",
              /* @__PURE__ */ jsx("b", { children: "fewer" }),
              " visitors, not more. Start with one."
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
              form.conditions.length > 1 && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  onClick: () => setForm({ ...form, conditions: form.conditions.filter((_, j) => j !== i) }),
                  className: "text-fg-dim hover:text-red-500",
                  "aria-label": "Remove condition",
                  children: /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }) })
                }
              )
            ] }, i)) })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "THEN do this" }),
            /* @__PURE__ */ jsx(
              "select",
              {
                value: form.action,
                onChange: (e) => setForm({ ...form, action: e.target.value }),
                className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand",
                children: ACTIONS.map((a) => /* @__PURE__ */ jsx("option", { value: a, children: ACTION_META[a].label }, a))
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "mt-1.5 rounded-lg bg-white px-3 py-2 text-xs text-fg-muted", children: ACTION_META[form.action].desc })
          ] }),
          form.action === "redirect" && /* @__PURE__ */ jsxs("label", { className: "block", children: [
            /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Send them to this page" }),
            /* @__PURE__ */ jsxs("div", { className: "mb-2 flex flex-wrap items-center gap-1.5", children: [
              /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "Ready-made:" }),
              REDIRECT_PRESETS.map((pr) => {
                const url = REDIRECT_ORIGIN + pr.path;
                return /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => setForm({ ...form, redirect_url: url }),
                    className: `rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${form.redirect_url === url ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-brand hover:text-brand"}`,
                    children: pr.label
                  },
                  pr.path
                );
              })
            ] }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "url",
                value: form.redirect_url,
                required: true,
                onChange: (e) => setForm({ ...form, redirect_url: e.target.value }),
                placeholder: "…or your own page URL",
                className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
              }
            )
          ] }),
          form.action === "tag" && /* @__PURE__ */ jsx(Field, { label: "Label to attach", value: form.tag, onChange: (v) => setForm({ ...form, tag: v }), placeholder: "fb-traffic" }),
          err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsx(Button, { type: "button", variant: "outline", className: "flex-1", onClick: () => setAdding(false), disabled: busy, children: "Cancel" }),
            /* @__PURE__ */ jsx(Button, { type: "submit", className: "flex-1", disabled: busy, children: busy ? "Saving…" : editingId ? "Save changes" : "Add rule" })
          ] })
        ] })
      ] })
    }
  );
}
const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randSlug = (len = 10) => {
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  return s;
};
const MAX_SLUG = 200;
const PRIVATE_DOMAIN_PRICE = 5;
const clampLen = (n) => Math.min(MAX_SLUG, Math.max(6, n || 6));
const BOT_OPTIONS = [
  { value: "decoy", label: "A decoy page", desc: "Looks like a real page and wastes their time." },
  { value: "notfound", label: "Nothing — a 404", desc: "Looks like the link doesn't exist." },
  { value: "blank", label: "A blank page", desc: "Quietly gives them nothing." },
  { value: "off", label: "Send them through too", desc: "No filtering — bots also reach your destination." }
];
const CHALLENGE_STYLES = [
  {
    value: "hold",
    label: "Press and hold",
    desc: "Hold a button for five seconds while a bar fills. The strongest of the three — software won't wait."
  },
  {
    value: "checkbox",
    label: "Tick a box",
    desc: "A single click on an “I am human” box. Fastest for real visitors, and the most familiar."
  },
  {
    value: "slide",
    label: "Slide to continue",
    desc: "Drag a handle across to the end. Nothing to read, so it travels well across languages."
  }
];
function PrivateDomainPanel({ priv, canManage, orgId, onChanged }) {
  var _a, _b;
  const owned = priv.owned.length;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { confirm, notify } = useDialog();
  async function buy() {
    var _a2;
    if (!await confirm({
      title: `Private domain — $${PRIVATE_DOMAIN_PRICE}/month`,
      message: "A short domain used by you and nobody else, so another customer's traffic can never affect its reputation. Billed for 30 days at a time, alongside your plan.",
      confirmLabel: "Continue to payment",
      cancelLabel: "Not now",
      tone: "brand"
    })) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await linkApi.buyPrivateDomain(orgId);
      if (r.checkout_url) {
        window.location.href = r.checkout_url;
        return;
      }
      notify("Private domain added.");
      onChanged();
    } catch (e) {
      setMsg(((_a2 = e == null ? void 0 : e.data) == null ? void 0 : _a2.detail) || "Could not start the purchase.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-5 flex flex-wrap items-center justify-between gap-3 p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx("div", { className: "text-sm font-bold", children: owned > 0 ? `Your private ${owned === 1 ? "domain" : "domains"}` : "Private domain" }),
      owned > 0 ? /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
        priv.owned.map((d) => d.host).join(", "),
        " — yours alone. Nobody else can create links on ",
        owned === 1 ? "it" : "them",
        ", so another customer's traffic can never affect",
        owned === 1 ? " its" : " their",
        " reputation.",
        ((_a = priv.owned[0]) == null ? void 0 : _a.private_until) && /* @__PURE__ */ jsxs(Fragment, { children: [
          " Renews ",
          /* @__PURE__ */ jsx("b", { children: new Date(priv.owned[0].private_until).toLocaleDateString() }),
          "."
        ] })
      ] }) : /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
        "Shared domains work well, but you're on them alongside other customers. A private domain is used by you and nobody else.",
        " ",
        priv.available > 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("b", { children: priv.available }),
          " available right now."
        ] }) : /* @__PURE__ */ jsx(Fragment, { children: "None in stock at the moment — ask and we'll source one." })
      ] })
    ] }),
    owned > 0 && ((_b = priv.owned[0]) == null ? void 0 : _b.private_until) && new Date(priv.owned[0].private_until) < /* @__PURE__ */ new Date() && /* @__PURE__ */ jsxs("div", { className: "w-full rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm", children: [
      "⚠️ This rental has lapsed. Your links still work for a short grace period, then the domain is released. ",
      canManage && /* @__PURE__ */ jsx("button", { onClick: buy, className: "font-semibold text-brand hover:underline", children: "Renew now" })
    ] }),
    canManage && owned > 0 && /* @__PURE__ */ jsx(Button, { onClick: buy, variant: "outline", disabled: busy, children: busy ? "Starting…" : `Renew · $${PRIVATE_DOMAIN_PRICE}/mo` }),
    canManage && owned === 0 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-1", children: [
      /* @__PURE__ */ jsx(Button, { onClick: buy, variant: "outline", disabled: busy, children: busy ? "Starting…" : `Get a private domain · $${PRIVATE_DOMAIN_PRICE}/mo` }),
      msg && /* @__PURE__ */ jsx("span", { className: "max-w-xs text-right text-xs text-red-600", children: msg })
    ] })
  ] });
}
function LockedBanner({ planName, canManage }) {
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand/5 p-5", children: [
    /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
      /* @__PURE__ */ jsx("div", { className: "text-sm font-bold", children: "🔒 Redirects are on every paid plan" }),
      /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
        "This is what you'd get: bot-filtered campaign links with click analytics",
        planName ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " — you're on ",
          /* @__PURE__ */ jsx("b", { children: planName }),
          "."
        ] }) : "."
      ] })
    ] }),
    canManage ? /* @__PURE__ */ jsx(Button, { to: "/dashboard/billing", children: "Choose a plan →" }) : /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "Ask an owner or admin to upgrade." })
  ] });
}
const BOT_LABEL = { decoy: "Decoy page", notfound: "404", blank: "Blank page", off: "No filtering" };
function Links() {
  var _a, _b, _c;
  const { confirm, notify } = useDialog();
  const { current } = useWorkspace();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rulesFor, setRulesFor] = useState(null);
  const [linkBase, setLinkBase] = useState("");
  const [domains, setDomains] = useState([]);
  const [priv, setPriv] = useState({ owned: [], available: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(null);
  const [sites, setSites] = useState([]);
  const [sub, setSub] = useState(null);
  const [form, setForm] = useState(
    { destination_url: "", title: "", slug: "", bot_action: "decoy", website: "", challenge: false, challenge_style: "hold", forward_params: false, forward_param_keys: "", block_vpn: false, domain: "" }
  );
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  const serviceUp = linkBase !== "";
  const linkEnabled = serviceUp && !!sub && sub.status === "active" && !((_a = sub.access) == null ? void 0 : _a.locked);
  const used = rows.length;
  const cap = (sub == null ? void 0 : sub.interval) === "monthly" && (sub == null ? void 0 : sub.plan.max_redirects_monthly) ? sub.plan.max_redirects_monthly : (sub == null ? void 0 : sub.plan.max_redirects) ?? 0;
  const atCap = linkEnabled && cap > 0 && used >= cap;
  const siteName = (id) => {
    var _a2;
    return (_a2 = sites.find((s) => s.id === id)) == null ? void 0 : _a2.name;
  };
  async function load(silent = false) {
    if (!current) return;
    if (!silent) setLoading(true);
    try {
      const [l, w, s] = await Promise.all([linkApi.list(current.id), websiteApi.list(current.id), billingApi.subscription(current.id)]);
      setRows(l.results);
      setSites(w.results);
      setSub(s);
      setLinkBase(l.base || "");
      setDomains(l.domains || []);
      if (l.private) setPriv(l.private);
    } finally {
      setLoading(false);
    }
  }
  useLivePoll(load, [current == null ? void 0 : current.id]);
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
          notify(r.awaiting_stock ? "Payment received. We're preparing your domain and will email you shortly." : `${r.host} is yours — pick it when you create a redirect.`);
          load();
        }
      } catch {
      }
      if (tries >= 10) clearInterval(iv);
    }, 2e3);
    return () => clearInterval(iv);
  }, [current == null ? void 0 : current.id]);
  async function explainLocked() {
    if (await confirm({
      title: "Redirects need a paid plan",
      message: "Every paid plan includes them — bot-filtered links with click analytics, VPN blocking and a human check. Your trial covers the antibot side only.",
      confirmLabel: "See plans",
      cancelLabel: "Not now",
      tone: "brand"
    })) navigate("/dashboard/billing");
  }
  function openCreate() {
    setErr("");
    setEditing(null);
    const def = domains.find((d) => d.is_default) || domains[0];
    setForm({ destination_url: "", title: "", slug: randSlug(), bot_action: "decoy", website: "", challenge: false, challenge_style: "hold", forward_params: false, forward_param_keys: "", block_vpn: false, domain: def ? String(def.id) : "" });
    setOpen(true);
  }
  function openEdit(l) {
    setErr("");
    setEditing(l);
    setForm({
      destination_url: l.destination_url,
      title: l.title || "",
      slug: l.slug,
      bot_action: l.bot_action,
      website: l.website ? String(l.website) : "",
      challenge: !!l.challenge,
      challenge_style: l.challenge_style || "hold",
      forward_params: !!l.forward_params,
      forward_param_keys: l.forward_param_keys || "",
      block_vpn: !!l.block_vpn,
      domain: l.domain ? String(l.domain) : ""
    });
    setOpen(true);
  }
  async function save(e) {
    var _a2, _b2, _c2, _d, _e;
    e.preventDefault();
    setErr("");
    setBusy(true);
    const payload = {
      destination_url: form.destination_url,
      title: form.title || "",
      slug: form.slug || void 0,
      bot_action: form.bot_action,
      challenge: form.challenge,
      challenge_style: form.challenge_style,
      block_vpn: form.block_vpn,
      domain: form.domain ? Number(form.domain) : null,
      forward_params: form.forward_params,
      forward_param_keys: form.forward_params ? form.forward_param_keys.trim() : "",
      website: form.website ? Number(form.website) : null
    };
    try {
      const saved = editing ? await linkApi.update(editing.id, payload) : await linkApi.create({ organization: current.id, ...payload });
      setOpen(false);
      if (saved.url_safe === false) {
        notify("Saved, but the destination was flagged as unsafe — the redirect is disabled.", "danger");
      } else {
        notify(editing ? "Redirect updated." : "Redirect created.");
      }
      load();
    } catch (e2) {
      setErr(((_b2 = (_a2 = e2.data) == null ? void 0 : _a2.slug) == null ? void 0 : _b2[0]) || ((_d = (_c2 = e2.data) == null ? void 0 : _c2.destination_url) == null ? void 0 : _d[0]) || ((_e = e2.data) == null ? void 0 : _e.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(l) {
    await linkApi.update(l.id, { active: !l.active });
    load();
  }
  async function remove(id) {
    if (!await confirm({
      title: "Delete this redirect?",
      message: "The short link stops working immediately. Anyone who already has it will get a 404. This can't be undone.",
      confirmLabel: "Delete redirect"
    })) return;
    await linkApi.remove(id);
    notify("Redirect deleted.");
    load();
  }
  function copy(l) {
    var _a2;
    (_a2 = navigator.clipboard) == null ? void 0 : _a2.writeText(l.short_url);
    setCopied(l.id);
    setTimeout(() => setCopied(null), 1500);
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "links", children: [
      "Create short, branded links for your ads and campaigns. Every click is ",
      /* @__PURE__ */ jsx("b", { children: "screened by the bot engine" }),
      " —",
      /* @__PURE__ */ jsx("b", { children: " real people always go to your destination" }),
      ", and you choose what ",
      /* @__PURE__ */ jsx("b", { children: "bots" }),
      " get (a decoy page, a 404, or nothing). Destinations are ",
      /* @__PURE__ */ jsx("b", { children: "scanned for malware/phishing" }),
      " and unsafe links are auto-disabled."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
          /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Redirection" }),
          linkEnabled && /* @__PURE__ */ jsxs("span", { className: `rounded-full border px-2.5 py-1 text-xs font-semibold ${atCap ? "border-danger/30 bg-danger/10 text-danger" : "border-line bg-bg-mute text-fg-muted"}`, children: [
            used,
            " of ",
            cap || "∞",
            " used"
          ] })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Redirect links with built-in bot filtering & click analytics." })
      ] }),
      canManage && serviceUp && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-1", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            onClick: linkEnabled ? openCreate : explainLocked,
            disabled: atCap,
            variant: linkEnabled ? "primary" : "outline",
            children: linkEnabled ? "+ New redirect" : "🔒 New redirect"
          }
        ),
        atCap && /* @__PURE__ */ jsxs("span", { className: "max-w-full text-right text-xs text-fg-muted", children: [
          sub == null ? void 0 : sub.plan.name,
          " includes ",
          cap,
          ". ",
          /* @__PURE__ */ jsx("a", { href: "/dashboard/billing", className: "font-semibold text-brand hover:underline", children: "Upgrade" }),
          " for more."
        ] })
      ] })
    ] }),
    linkEnabled && current && /* @__PURE__ */ jsx(
      PrivateDomainPanel,
      {
        priv,
        canManage,
        orgId: current.id,
        onChanged: load
      }
    ),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : !serviceUp ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 border-warning/40 bg-warning/5 p-8 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warning/10 text-2xl", children: "⏸️" }),
      /* @__PURE__ */ jsx("h2", { className: "mt-3 text-lg font-bold", children: "Redirects are paused" }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-md text-sm text-fg-muted", children: "The redirect service is temporarily unavailable, so no links are being served and none can be created. Your existing links and their stats are safe and will work again as soon as it's back." })
    ] }) : rows.length === 0 ? /* @__PURE__ */ jsxs(Fragment, { children: [
      !linkEnabled && /* @__PURE__ */ jsx(LockedBanner, { planName: sub == null ? void 0 : sub.plan.name, canManage }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-4 p-5 opacity-70", children: [
        /* @__PURE__ */ jsx("div", { className: "mb-3 inline-block rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-dim", children: "Example — not a real link" }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 basis-64", children: [
            /* @__PURE__ */ jsx("span", { className: "break-all font-bold", children: "Summer promo" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-1 break-all font-mono text-sm text-fg-dim", children: [
              linkBase || "https://trynb.cc",
              "/",
              /* @__PURE__ */ jsx("span", { className: "italic", children: "your-link" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-1 truncate text-xs text-fg-dim", children: "→ https://your-offer.com/landing" }),
            /* @__PURE__ */ jsxs("div", { className: "mt-1 text-xs text-fg-dim", children: [
              "Bots get: ",
              /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: "Decoy page" }),
              " · ",
              /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: "VPN/RDP blocked" }),
              " · ",
              /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: "Human check: Press and hold" })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm", children: [
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "font-bold tabular-nums", children: "1,284" }),
              /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "clicks" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "font-bold tabular-nums text-emerald-600", children: "1,097" }),
              /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "human" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
              /* @__PURE__ */ jsx("div", { className: "font-bold tabular-nums text-red-500", children: "187" }),
              /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "bot" })
            ] })
          ] })
        ] })
      ] }),
      linkEnabled && /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-3", children: /* @__PURE__ */ jsx(NoData, { msg: "No links yet. Create one to start filtering clicks." }) })
    ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-3", children: rows.map((l) => {
      var _a2;
      return /* @__PURE__ */ jsx("div", { className: "card shadow-soft p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1 basis-64", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "min-w-0 break-all font-bold", children: l.title || l.slug }),
            l.url_safe === false && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600", children: "Unsafe — disabled" }),
            !l.active && l.url_safe !== false && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-dim", children: "Paused" })
          ] }),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => copy(l),
              className: "mt-1 flex w-full max-w-full flex-wrap items-center gap-x-2 text-left text-sm text-brand hover:underline",
              children: [
                /* @__PURE__ */ jsx("span", { className: "min-w-0 break-all font-mono", children: l.short_url }),
                /* @__PURE__ */ jsx("span", { className: "shrink-0 text-xs text-fg-dim", children: copied === l.id ? "Copied ✓" : "Copy" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "mt-1 min-w-0 truncate text-xs text-fg-dim", children: [
            "→ ",
            l.destination_url
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-1 text-xs text-fg-dim", children: [
            "Bots get: ",
            /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: BOT_LABEL[l.bot_action] }),
            l.website && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · Rules: ",
              /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: siteName(l.website) || "a website" })
            ] }),
            domains.length > 1 && l.domain_host && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · ",
              /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: l.domain_host })
            ] }),
            l.block_vpn && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · ",
              /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: "VPN/RDP blocked" })
            ] }),
            l.challenge && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · ",
              /* @__PURE__ */ jsxs("b", { className: "text-fg-muted", children: [
                "Human check: ",
                (_a2 = CHALLENGE_STYLES.find((c) => c.value === (l.challenge_style || "hold"))) == null ? void 0 : _a2.label
              ] })
            ] }),
            l.forward_params && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · ",
              /* @__PURE__ */ jsxs("b", { className: "text-fg-muted", children: [
                "Forwards ",
                l.forward_param_keys || "all params"
              ] })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm", children: [
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold tabular-nums", children: l.clicks }),
            /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "clicks" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold tabular-nums text-emerald-600", children: l.human_clicks }),
            /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "human" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "text-center", children: [
            /* @__PURE__ */ jsx("div", { className: "font-bold tabular-nums text-red-500", children: l.bot_clicks }),
            /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "bot" })
          ] }),
          canManage && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => toggle(l),
                title: l.active ? "Active — click to pause" : "Paused — click to activate",
                className: `h-6 w-11 rounded-full p-0.5 transition ${l.active ? "bg-brand" : "bg-bg-mute"}`,
                children: /* @__PURE__ */ jsx("span", { className: `block h-5 w-5 rounded-full bg-white shadow transition ${l.active ? "translate-x-5" : ""}` })
              }
            ),
            /* @__PURE__ */ jsx("button", { onClick: () => setRulesFor(l), className: "text-brand hover:underline", children: "Rules" }),
            /* @__PURE__ */ jsx("button", { onClick: () => openEdit(l), className: "text-brand hover:underline", children: "Edit" }),
            /* @__PURE__ */ jsx("button", { onClick: () => remove(l.id), className: "text-red-500 hover:underline", children: "Delete" })
          ] })
        ] })
      ] }) }, l.id);
    }) }),
    current && /* @__PURE__ */ jsx(
      RedirectRulesModal,
      {
        link: rulesFor,
        orgId: current.id,
        onClose: () => setRulesFor(null),
        onSaved: load
      }
    ),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: editing ? "Edit redirect" : "Create a redirect", size: "xl", children: /* @__PURE__ */ jsxs("form", { onSubmit: save, className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-brand/30 bg-brand/5 px-4 py-3", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "Your link" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-0.5 break-all font-mono text-sm font-semibold text-brand", children: [
          ((_b = domains.find((d) => String(d.id) === form.domain)) == null ? void 0 : _b.base) || linkBase,
          "/",
          form.slug || "…"
        ] })
      ] }),
      domains.length > 1 && /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Domain" }),
        /* @__PURE__ */ jsx(
          "select",
          {
            value: form.domain,
            onChange: (e) => setForm({ ...form, domain: e.target.value }),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
            children: domains.map((d) => /* @__PURE__ */ jsxs("option", { value: d.id, children: [
              d.host,
              d.is_default ? " · default" : ""
            ] }, d.id))
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs text-fg-dim", children: "Spreading links across domains means one blocklisting can't take them all down. The domain can't be changed after the link is created." })
      ] }),
      /* @__PURE__ */ jsx(Field, { label: "Where should it send people?", type: "url", value: form.destination_url, onChange: (v) => setForm({ ...form, destination_url: v }), placeholder: "https://your-offer.com/landing" }),
      /* @__PURE__ */ jsx(Field, { label: "Title (optional)", required: false, value: form.title, onChange: (v) => setForm({ ...form, title: v }), placeholder: "Summer promo" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Link ending" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value: form.slug,
            onChange: (e) => setForm({ ...form, slug: e.target.value }),
            placeholder: "offer",
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 flex items-center gap-3", children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "range",
              min: 6,
              max: MAX_SLUG,
              value: clampLen(form.slug.length),
              onChange: (e) => setForm({ ...form, slug: randSlug(Number(e.target.value)) }),
              className: "min-w-0 flex-1 accent-brand"
            }
          ),
          /* @__PURE__ */ jsxs("span", { className: "w-12 shrink-0 text-right text-xs tabular-nums text-fg-dim", children: [
            form.slug.length,
            "/",
            MAX_SLUG
          ] }),
          /* @__PURE__ */ jsx(Button, { type: "button", variant: "outline", onClick: () => setForm({ ...form, slug: randSlug(clampLen(form.slug.length || 10)) }), children: "Regenerate" })
        ] }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-fg-dim", children: "Drag for a random ending, or type your own. Longer is harder to guess." }),
        editing && form.slug !== editing.slug && /* @__PURE__ */ jsxs("p", { className: "mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-amber-800", children: [
          "Changing the ending breaks the old link",
          editing.clicks > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
            " — it already has ",
            /* @__PURE__ */ jsx("b", { children: editing.clicks }),
            " click",
            editing.clicks === 1 ? "" : "s"
          ] }),
          ". Anyone who already has ",
          /* @__PURE__ */ jsx("span", { className: "break-all font-mono", children: editing.slug }),
          " will get a 404."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "What should bots get instead?" }),
        /* @__PURE__ */ jsx("p", { className: "mb-2 text-xs text-fg-dim", children: "Real visitors always go to your destination. This only affects traffic we flag as automated." }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2", children: BOT_OPTIONS.map((o) => /* @__PURE__ */ jsxs("label", { className: `flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${form.bot_action === o.value ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`, children: [
          /* @__PURE__ */ jsx("input", { type: "radio", name: "bot_action", checked: form.bot_action === o.value, onChange: () => setForm({ ...form, bot_action: o.value }), className: "mt-0.5" }),
          /* @__PURE__ */ jsxs("span", { children: [
            /* @__PURE__ */ jsx("span", { className: "block text-sm font-semibold", children: o.label }),
            /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: o.desc })
          ] })
        ] }, o.value)) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: `flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.block_vpn ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: form.block_vpn,
            className: "mt-0.5",
            onChange: (e) => setForm({ ...form, block_vpn: e.target.checked })
          }
        ),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("span", { className: "block text-sm font-semibold", children: "Block VPN, proxy and RDP traffic" }),
          /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: "Visitors on a VPN, proxy, Tor, or a datacenter/RDP connection get the bot handling above instead of your destination — they're never told why. Useful when you're paying for ad clicks and don't want to pay for masked traffic." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: `flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.challenge ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: form.challenge,
            className: "mt-0.5",
            onChange: (e) => setForm({ ...form, challenge: e.target.checked })
          }
        ),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("span", { className: "block text-sm font-semibold", children: "Ask visitors to confirm they're human" }),
          /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: `Shows a "I'm not a robot" button before the redirect. Only people we'd already let through see it — bots still get the handling above — so it catches automation the score missed. Confirmed visitors aren't asked again for 30 minutes.` })
        ] })
      ] }),
      form.challenge && /* @__PURE__ */ jsxs("div", { className: "-mt-1 rounded-xl border border-line bg-bg-soft p-3.5", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-2 block text-sm font-semibold", children: "Which check should they get?" }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2", children: CHALLENGE_STYLES.map((o) => /* @__PURE__ */ jsxs(
          "label",
          {
            className: `flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${form.challenge_style === o.value ? "border-brand bg-brand/5" : "border-line bg-white hover:border-brand/40"}`,
            children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "radio",
                  name: "challenge_style",
                  className: "mt-0.5",
                  checked: form.challenge_style === o.value,
                  onChange: () => setForm({ ...form, challenge_style: o.value })
                }
              ),
              /* @__PURE__ */ jsxs("span", { children: [
                /* @__PURE__ */ jsx("span", { className: "block text-sm font-semibold", children: o.label }),
                /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: o.desc })
              ] })
            ]
          },
          o.value
        )) })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: `flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${form.forward_params ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`, children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "checkbox",
            checked: form.forward_params,
            className: "mt-0.5",
            onChange: (e) => setForm({ ...form, forward_params: e.target.checked })
          }
        ),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("span", { className: "block text-sm font-semibold", children: "Pass the link's query string to the destination" }),
          /* @__PURE__ */ jsxs("span", { className: "block text-xs text-fg-muted", children: [
            "For personalised links: ",
            /* @__PURE__ */ jsx("span", { className: "font-mono", children: "?rid=8842" }),
            " on the short link arrives on your page. Needed for per-recipient survey and campaign tracking. Query values are never written to your click log, so anything personal in them isn't stored here."
          ] })
        ] })
      ] }),
      form.forward_params && /* @__PURE__ */ jsxs("div", { className: "-mt-1 rounded-xl border border-line bg-bg-soft p-3.5", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Which parameters?" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value: form.forward_param_keys,
            placeholder: "email, rid",
            onChange: (e) => setForm({ ...form, forward_param_keys: e.target.value }),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs text-fg-dim", children: "Comma-separated names. Only these are passed on — anything else on the link is dropped, so stray trackers picked up in transit don't follow people to your page. Leave blank to forward everything." }),
        form.forward_param_keys.trim() && /* @__PURE__ */ jsxs("p", { className: "mt-2 break-all font-mono text-xs text-fg-muted", children: [
          ((_c = domains.find((d) => String(d.id) === form.domain)) == null ? void 0 : _c.base) || linkBase,
          "/",
          form.slug || "…",
          "?",
          form.forward_param_keys.split(",").map((k) => k.trim()).filter(Boolean).map((k, i) => /* @__PURE__ */ jsxs("span", { children: [
            i > 0 && "&",
            /* @__PURE__ */ jsx("b", { className: "text-brand", children: k }),
            "=…"
          ] }, k))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsxs("span", { className: "mb-1.5 block text-sm font-semibold", children: [
          "Apply a website's Traffic Rules? ",
          /* @__PURE__ */ jsx("span", { className: "font-normal text-fg-dim", children: "(optional, advanced)" })
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "mb-2 rounded-lg bg-brand/5 px-3 py-2 text-xs leading-relaxed text-fg-muted", children: [
          "Want to block by ",
          /* @__PURE__ */ jsx("b", { children: "country, device, OS, browser or risk score" }),
          " on this link alone? You don't need a website — save the redirect, then tap ",
          /* @__PURE__ */ jsx("b", { children: "Rules" }),
          " on it in the list."
        ] }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: form.website,
            onChange: (e) => setForm({ ...form, website: e.target.value }),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
            children: [
              /* @__PURE__ */ jsx("option", { value: "", children: "No — just use the bot handling above" }),
              sites.map((s) => /* @__PURE__ */ jsxs("option", { value: s.id, children: [
                "Use ",
                s.name,
                "'s Traffic Rules"
              ] }, s.id))
            ]
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-fg-dim", children: "For tighter control, run a website's Traffic Rules on each click (block by country, device, risk, IP allow/deny, etc.). Those rules win; the bot handling above is the fallback." })
      ] }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: busy, children: busy ? "Saving…" : editing ? "Save changes" : "Create redirect" })
    ] }) })
  ] });
}
export {
  Links as default
};

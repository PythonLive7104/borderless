import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { y as useDialog, c as useWorkspace, B as Button, J as linkApi, z as websiteApi, d as billingApi } from "../entry-server.js";
import { u as useLivePoll } from "./useLivePoll-JHywBTNY.js";
import { M as Modal } from "./Modal-CEHlixCW.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randSlug = (len = 10) => {
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  return s;
};
const clampLen = (n) => Math.min(48, Math.max(6, n || 6));
const BOT_OPTIONS = [
  { value: "decoy", label: "A decoy page", desc: "Looks like a real page and wastes their time." },
  { value: "notfound", label: "Nothing — a 404", desc: "Looks like the link doesn't exist." },
  { value: "blank", label: "A blank page", desc: "Quietly gives them nothing." },
  { value: "off", label: "Send them through too", desc: "No filtering — bots also reach your destination." }
];
const BOT_LABEL = { decoy: "Decoy page", notfound: "404", blank: "Blank page", off: "No filtering" };
function Links() {
  var _a, _b;
  const { confirm, notify } = useDialog();
  const { current } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(null);
  const [sites, setSites] = useState([]);
  const [sub, setSub] = useState(null);
  const [form, setForm] = useState(
    { destination_url: "", title: "", slug: "", bot_action: "decoy", website: "" }
  );
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  const linkEnabled = !!sub && sub.status === "active" && !((_a = sub.access) == null ? void 0 : _a.locked);
  const used = rows.length;
  const cap = (sub == null ? void 0 : sub.plan.max_redirects) ?? 0;
  const atCap = linkEnabled && cap > 0 && used >= cap;
  const siteName = (id) => {
    var _a2;
    return (_a2 = sites.find((s) => s.id === id)) == null ? void 0 : _a2.name;
  };
  const linkBase = ((_b = rows[0]) == null ? void 0 : _b.short_url.replace(/\/[^/]*$/, "")) || `${ORIGIN}/l`;
  async function load(silent = false) {
    if (!current) return;
    if (!silent) setLoading(true);
    try {
      const [l, w, s] = await Promise.all([linkApi.list(current.id), websiteApi.list(current.id), billingApi.subscription(current.id)]);
      setRows(l.results);
      setSites(w.results);
      setSub(s);
    } finally {
      setLoading(false);
    }
  }
  useLivePoll(load, [current == null ? void 0 : current.id]);
  function openCreate() {
    setErr("");
    setEditing(null);
    setForm({ destination_url: "", title: "", slug: randSlug(), bot_action: "decoy", website: "" });
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
      website: l.website ? String(l.website) : ""
    });
    setOpen(true);
  }
  async function save(e) {
    var _a2, _b2, _c, _d, _e;
    e.preventDefault();
    setErr("");
    setBusy(true);
    const payload = {
      destination_url: form.destination_url,
      title: form.title || "",
      slug: form.slug || void 0,
      bot_action: form.bot_action,
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
      setErr(((_b2 = (_a2 = e2.data) == null ? void 0 : _a2.slug) == null ? void 0 : _b2[0]) || ((_d = (_c = e2.data) == null ? void 0 : _c.destination_url) == null ? void 0 : _d[0]) || ((_e = e2.data) == null ? void 0 : _e.detail) || e2.message);
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
      canManage && linkEnabled && /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-1", children: [
        /* @__PURE__ */ jsx(Button, { onClick: openCreate, disabled: atCap, children: "+ New redirect" }),
        atCap && /* @__PURE__ */ jsxs("span", { className: "text-xs text-fg-muted", children: [
          sub == null ? void 0 : sub.plan.name,
          " includes ",
          cap,
          ". ",
          /* @__PURE__ */ jsx("a", { href: "/dashboard/billing", className: "font-semibold text-brand hover:underline", children: "Upgrade" }),
          " for more."
        ] })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : !linkEnabled ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 border-brand/30 bg-brand/5 p-8 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand/10 text-2xl", children: "🔗" }),
      /* @__PURE__ */ jsx("h2", { className: "mt-3 text-lg font-bold", children: "Redirection is a paid feature" }),
      /* @__PURE__ */ jsxs("p", { className: "mx-auto mt-2 max-w-md text-sm text-fg-muted", children: [
        "Create bot-filtered campaign redirects with click analytics. It's included on every paid plan",
        sub ? /* @__PURE__ */ jsxs(Fragment, { children: [
          " — you're on ",
          /* @__PURE__ */ jsx("b", { children: sub.plan.name }),
          "."
        ] }) : "."
      ] }),
      canManage ? /* @__PURE__ */ jsx(Button, { to: "/dashboard/billing", className: "mt-4", children: "Upgrade to unlock →" }) : /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-fg-dim", children: "Ask an owner or admin to upgrade the workspace." })
    ] }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6", children: /* @__PURE__ */ jsx(NoData, { msg: "No links yet. Create one to start filtering clicks." }) }) : /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-3", children: rows.map((l) => /* @__PURE__ */ jsx("div", { className: "card shadow-soft p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "font-bold", children: l.title || l.slug }),
          l.url_safe === false && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600", children: "Unsafe — disabled" }),
          !l.active && l.url_safe !== false && /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-dim", children: "Paused" })
        ] }),
        /* @__PURE__ */ jsxs("button", { onClick: () => copy(l), className: "mt-1 flex items-center gap-2 text-sm text-brand hover:underline", children: [
          /* @__PURE__ */ jsx("span", { className: "font-mono", children: l.short_url }),
          /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: copied === l.id ? "Copied ✓" : "Copy" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 truncate text-xs text-fg-dim", children: [
          "→ ",
          l.destination_url
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 text-xs text-fg-dim", children: [
          "Bots get: ",
          /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: BOT_LABEL[l.bot_action] }),
          l.website && /* @__PURE__ */ jsxs(Fragment, { children: [
            " · Rules: ",
            /* @__PURE__ */ jsx("b", { className: "text-fg-muted", children: siteName(l.website) || "a website" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 text-sm", children: [
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
          /* @__PURE__ */ jsx("button", { onClick: () => openEdit(l), className: "text-brand hover:underline", children: "Edit" }),
          /* @__PURE__ */ jsx("button", { onClick: () => remove(l.id), className: "text-red-500 hover:underline", children: "Delete" })
        ] })
      ] })
    ] }) }, l.id)) }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: editing ? "Edit redirect" : "Create a redirect", size: "lg", children: /* @__PURE__ */ jsxs("form", { onSubmit: save, className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-brand/30 bg-brand/5 px-4 py-3", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "Your link" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-0.5 break-all font-mono text-sm font-semibold text-brand", children: [
          linkBase,
          "/",
          form.slug || "…"
        ] })
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
              max: 48,
              value: clampLen(form.slug.length),
              onChange: (e) => setForm({ ...form, slug: randSlug(Number(e.target.value)) }),
              className: "min-w-0 flex-1 accent-brand"
            }
          ),
          /* @__PURE__ */ jsxs("span", { className: "w-12 shrink-0 text-right text-xs tabular-nums text-fg-dim", children: [
            form.slug.length,
            "/48"
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
          /* @__PURE__ */ jsx("span", { className: "font-mono", children: editing.slug }),
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
      /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsxs("span", { className: "mb-1.5 block text-sm font-semibold", children: [
          "Apply a website's Traffic Rules? ",
          /* @__PURE__ */ jsx("span", { className: "font-normal text-fg-dim", children: "(optional, advanced)" })
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

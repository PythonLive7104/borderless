import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { H as HelpVideo } from "./HelpVideo-C4NguLet.js";
import { A as useDialog, c as useWorkspace, y as linkApi, B as Button, x as websiteApi, d as billingApi } from "../entry-server.js";
import { u as useLivePoll } from "./useLivePoll-JHywBTNY.js";
import { M as Modal } from "./Modal-CCIcMfR1.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randSlug = (len = 10) => {
  let s = "";
  for (let i = 0; i < len; i++) s += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  return s;
};
const MAX_SLUG = 200;
const PRIVATE_DOMAIN_PRICE = 5;
const DEVICE_CHOICES = [
  ["mobile", "Phones"],
  ["desktop", "Computers"],
  ["tablet", "Tablets"]
];
const OS_CHOICES = [
  ["windows", "Windows"],
  ["macos", "Mac"],
  ["ios", "iPhone / iPad"],
  ["android", "Android"],
  ["linux", "Linux"]
];
const STRICTNESS = [
  { value: 0, label: "Normal", desc: "Filter the visitors we're confident are bots." },
  { value: 60, label: "Strict", desc: "Also turn away visitors that look suspicious." },
  { value: 40, label: "Very strict", desc: "Turn away anything questionable. May stop some real people." }
];
const MODE_LABELS = [
  ["off", "Everyone"],
  ["allow", "Only these"],
  ["block", "Everyone except these"]
];
function ChoiceGate({ title, mode, values, choices, onMode, onValues }) {
  const picked = values.split(",").map((v) => v.trim()).filter(Boolean);
  const toggle = (v) => onValues((picked.includes(v) ? picked.filter((p) => p !== v) : [...picked, v]).join(","));
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line p-3.5", children: [
    /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: title }),
    /* @__PURE__ */ jsx(
      "select",
      {
        value: mode,
        onChange: (e) => onMode(e.target.value),
        className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
        children: MODE_LABELS.map(([v, l]) => /* @__PURE__ */ jsx("option", { value: v, children: l }, v))
      }
    ),
    mode !== "off" && /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-2", children: choices.map(([v, l]) => /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: () => toggle(v),
        className: `rounded-full border px-3 py-1.5 text-sm font-medium transition ${picked.includes(v) ? "border-brand bg-brand/10 text-brand" : "border-line hover:border-brand/50"}`,
        children: [
          picked.includes(v) ? "✓ " : "",
          l
        ]
      },
      v
    )) })
  ] });
}
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
      /* @__PURE__ */ jsx(Button, { onClick: buy, disabled: busy, className: busy ? "" : "cta-glow", children: busy ? "Starting…" : `Get a private domain · $${PRIVATE_DOMAIN_PRICE}/mo` }),
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
  const [linkBase, setLinkBase] = useState("");
  const [domains, setDomains] = useState([]);
  const [priv, setPriv] = useState({ owned: [], available: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(null);
  const [sites, setSites] = useState([]);
  const [sub, setSub] = useState(null);
  const [form, setForm] = useState(
    { destination_url: "", title: "", slug: "", bot_action: "decoy", website: "", challenge: false, challenge_style: "hold", forward_params: false, forward_param_keys: "", block_vpn: false, domain: "", country_mode: "off", countries: "", decoy_url: "", device_mode: "off", devices: "", os_mode: "off", operating_systems: "", max_risk: 0 }
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
    setForm({ destination_url: "", title: "", slug: randSlug(), bot_action: "decoy", website: "", challenge: false, challenge_style: "hold", forward_params: false, forward_param_keys: "", block_vpn: false, domain: def ? String(def.id) : "", country_mode: "off", countries: "", decoy_url: "", device_mode: "off", devices: "", os_mode: "off", operating_systems: "", max_risk: 0 });
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
      domain: l.domain ? String(l.domain) : "",
      country_mode: l.country_mode || "off",
      countries: l.countries || "",
      decoy_url: l.decoy_url || "",
      device_mode: l.device_mode || "off",
      devices: l.devices || "",
      os_mode: l.os_mode || "off",
      operating_systems: l.operating_systems || "",
      max_risk: l.max_risk || 0
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
      country_mode: form.country_mode,
      countries: form.country_mode === "off" ? "" : form.countries.trim(),
      decoy_url: form.bot_action === "decoy" ? form.decoy_url.trim() : "",
      device_mode: form.device_mode,
      devices: form.device_mode === "off" ? "" : form.devices,
      os_mode: form.os_mode,
      operating_systems: form.os_mode === "off" ? "" : form.operating_systems,
      max_risk: form.max_risk,
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
    /* @__PURE__ */ jsx(
      HelpVideo,
      {
        id: "63562736a0f84abcb8a88c2a811d0b18",
        title: "How to create and protect a redirect"
      }
    ),
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
            l.country_mode !== "off" && l.countries && /* @__PURE__ */ jsxs(Fragment, { children: [
              " · ",
              /* @__PURE__ */ jsxs("b", { className: "text-fg-muted", children: [
                l.country_mode === "allow" ? "Only" : "Not",
                " ",
                l.countries
              ] })
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
            /* @__PURE__ */ jsx("button", { onClick: () => openEdit(l), className: "text-brand hover:underline", children: "Edit" }),
            /* @__PURE__ */ jsx("button", { onClick: () => remove(l.id), className: "text-red-500 hover:underline", children: "Delete" })
          ] })
        ] })
      ] }) }, l.id);
    }) }),
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
      form.bot_action === "decoy" && /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line p-3.5", children: [
        /* @__PURE__ */ jsxs("span", { className: "mb-1.5 block text-sm font-semibold", children: [
          "Which decoy page? ",
          /* @__PURE__ */ jsx("span", { className: "font-normal text-fg-dim", children: "(optional)" })
        ] }),
        /* @__PURE__ */ jsx(
          "input",
          {
            value: form.decoy_url,
            placeholder: "Leave blank to use ours",
            onChange: (e) => setForm({ ...form, decoy_url: e.target.value }),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          }
        ),
        /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs text-fg-dim", children: "Blank uses our built-in decoy, served from your own short domain. Or paste any page of your own — an old offer, a landing page, anywhere you'd rather send bots. It's scanned for malware like your destination is." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line p-3.5", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Which countries can use this link?" }),
        /* @__PURE__ */ jsxs(
          "select",
          {
            value: form.country_mode,
            onChange: (e) => setForm({ ...form, country_mode: e.target.value }),
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
            children: [
              /* @__PURE__ */ jsx("option", { value: "off", children: "Everywhere — no country restriction" }),
              /* @__PURE__ */ jsx("option", { value: "allow", children: "Only these countries" }),
              /* @__PURE__ */ jsx("option", { value: "block", children: "Everywhere except these" })
            ]
          }
        ),
        form.country_mode !== "off" && /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              value: form.countries,
              placeholder: "US, CA, GB",
              onChange: (e) => setForm({ ...form, countries: e.target.value }),
              className: "mt-2 w-full rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm uppercase outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          ),
          /* @__PURE__ */ jsxs("p", { className: "mt-1.5 text-xs text-fg-dim", children: [
            "Two-letter country codes, comma separated. Anyone refused gets the bot handling above — they're never told why.",
            form.country_mode === "allow" && " Visitors whose country we can't determine are refused too."
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        ChoiceGate,
        {
          title: "Which devices can use this link?",
          mode: form.device_mode,
          values: form.devices,
          choices: DEVICE_CHOICES,
          onMode: (m) => setForm({ ...form, device_mode: m }),
          onValues: (v) => setForm({ ...form, devices: v })
        }
      ),
      /* @__PURE__ */ jsx(
        ChoiceGate,
        {
          title: "Which systems can use this link?",
          mode: form.os_mode,
          values: form.operating_systems,
          choices: OS_CHOICES,
          onMode: (m) => setForm({ ...form, os_mode: m }),
          onValues: (v) => setForm({ ...form, operating_systems: v })
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line p-3.5", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "How strict should we be?" }),
        /* @__PURE__ */ jsx("div", { className: "grid gap-2", children: STRICTNESS.map((o) => /* @__PURE__ */ jsxs("label", { className: `flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition ${form.max_risk === o.value ? "border-brand bg-brand/5" : "border-line hover:border-brand/40"}`, children: [
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "radio",
              name: "max_risk",
              checked: form.max_risk === o.value,
              className: "mt-0.5",
              onChange: () => setForm({ ...form, max_risk: o.value })
            }
          ),
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
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-fg-dim", children: "Most people leave this alone. It reuses the detailed rules from a website you've already set up (IP allow/deny, browser, referrer…) on top of the settings above." })
      ] }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: busy, children: busy ? "Saving…" : editing ? "Save changes" : "Create redirect" })
    ] }) })
  ] });
}
export {
  Links as default
};

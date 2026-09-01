import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { c as useWorkspace, B as Button, d as billingApi } from "../entry-server.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const statusTone = {
  trialing: "bg-brand/10 text-brand",
  active: "bg-success/10 text-emerald-700",
  canceled: "bg-danger/10 text-red-600"
};
const BASE = [
  "Real-time bot & fraud scoring",
  "JS + TLS/JA3 fingerprinting",
  "Traffic rules (country, device, OS, browser)",
  "IP allow / deny lists"
];
const GROWTH_ADD = [
  "A/B split testing with per-variant CVR",
  "Destination URL threat scanning",
  "Webhooks & full REST API",
  "Priority email support"
];
const BUSINESS_ADD = [
  "Guest access to statistics",
  "Higher rate limits",
  "Dedicated onboarding"
];
const PLAN_FEATURES = {
  starter: [{ items: BASE }],
  growth: [{ items: BASE }, { label: "Everything in Starter, plus:", items: GROWTH_ADD }],
  business: [
    { items: BASE },
    { label: "Everything in Growth, plus:", items: GROWTH_ADD },
    { label: "Plus advanced:", items: BUSINESS_ADD }
  ]
};
const Check = () => /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", className: "mt-0.5 shrink-0 text-brand", children: /* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
function Billing() {
  const { current } = useWorkspace();
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([billingApi.subscription(current.id), billingApi.plans()]);
      setSub(s);
      setPlans(p);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  async function change(slug) {
    if (!confirm(`Switch to the ${slug} plan?`)) return;
    const res = await billingApi.checkout(current.id, slug);
    if (res.checkout_url) {
      window.location.href = res.checkout_url;
      return;
    }
    setSub(await billingApi.subscription(current.id));
  }
  async function cancel() {
    if (!confirm("Cancel your subscription?")) return;
    setSub(await billingApi.cancel(current.id));
  }
  if (loading || !sub) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "billing", children: [
      "Your plan decides how much traffic you can process each month. Pick the plan that fits — you can switch anytime. Payments run through ",
      /* @__PURE__ */ jsx("b", { children: "Bachs" }),
      " (card, mobile money or crypto); until a live payment key is set, plan changes activate instantly."
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Billing" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Manage your workspace subscription." }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-4 p-6", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Current plan" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "text-2xl font-extrabold", children: sub.plan.name }),
          /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[sub.status]}`, children: sub.status })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 text-sm text-fg-muted", children: [
          "$",
          sub.plan.price,
          "/month · renews ",
          new Date(sub.period_end).toLocaleDateString()
        ] })
      ] }),
      canManage && sub.status !== "canceled" && /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: cancel, children: "Cancel subscription" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-5 lg:grid-cols-3", children: plans.map((p) => {
      const isCurrent = p.slug === sub.plan.slug;
      return /* @__PURE__ */ jsxs("div", { className: `card flex flex-col p-6 ${isCurrent ? "ring-2 ring-brand" : "shadow-soft"}`, children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: p.name }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 text-3xl font-extrabold", children: [
          "$",
          p.price,
          /* @__PURE__ */ jsx("span", { className: "text-sm font-normal text-fg-dim", children: "/mo" })
        ] }),
        /* @__PURE__ */ jsxs("dl", { className: "mt-4 grid grid-cols-3 gap-2 rounded-xl bg-bg-soft p-3 text-center", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { className: "text-[11px] uppercase tracking-wide text-fg-dim", children: "Events/mo" }),
            /* @__PURE__ */ jsxs("dd", { className: "mt-0.5 text-sm font-bold", children: [
              (p.monthly_events / 1e3).toLocaleString(),
              "k"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { className: "text-[11px] uppercase tracking-wide text-fg-dim", children: "Retention" }),
            /* @__PURE__ */ jsxs("dd", { className: "mt-0.5 text-sm font-bold", children: [
              p.retention_days,
              "d"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("dt", { className: "text-[11px] uppercase tracking-wide text-fg-dim", children: "Team" }),
            /* @__PURE__ */ jsx("dd", { className: "mt-0.5 text-sm font-bold", children: p.team_members || "∞" })
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 flex-1 space-y-3", children: (PLAN_FEATURES[p.slug] || [{ items: BASE }]).map((g, gi) => /* @__PURE__ */ jsxs("div", { children: [
          g.label && /* @__PURE__ */ jsx("div", { className: "mb-1.5 text-xs font-bold uppercase tracking-wide text-fg-dim", children: g.label }),
          /* @__PURE__ */ jsx("ul", { className: "space-y-1.5 text-sm", children: g.items.map((f) => /* @__PURE__ */ jsxs("li", { className: "flex gap-2 text-fg-muted", children: [
            /* @__PURE__ */ jsx(Check, {}),
            /* @__PURE__ */ jsx("span", { children: f })
          ] }, f)) })
        ] }, gi)) }),
        isCurrent ? /* @__PURE__ */ jsx("div", { className: "mt-5 rounded-full bg-bg-mute py-2 text-center text-sm font-semibold text-fg-muted", children: "Current plan" }) : canManage ? /* @__PURE__ */ jsx(Button, { onClick: () => change(p.slug), variant: p.price > sub.plan.price ? "primary" : "outline", className: "mt-5 w-full", children: p.price > sub.plan.price ? "Upgrade" : "Switch" }) : /* @__PURE__ */ jsx("div", { className: "mt-5 text-center text-xs text-fg-dim", children: "Ask an admin to change plans" })
      ] }, p.id);
    }) })
  ] });
}
export {
  Billing as default
};

import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { c as useWorkspace, e as billingApi, B as Button, P as IntervalToggle, j as ILink, f as IGlobe } from "../entry-server.js";
import { M as Modal } from "./Modal-CCIcMfR1.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const statusTone = {
  trialing: "bg-brand/10 text-brand",
  active: "bg-success/10 text-emerald-700",
  canceled: "bg-danger/10 text-red-600"
};
const PLAN_FEATURES = {
  basic: [
    { text: "Smart redirects with bot detection on every click" },
    { text: "Full anti-bot engine included" },
    { text: "Smart shortlinks + custom domain redirects" },
    { text: "IP allow / deny rules" },
    { text: "Domain health + ownership checks" }
  ],
  plus: [
    { text: "Smart redirects with bot detection on every click" },
    { text: "Full anti-bot engine included" },
    { text: "Everything in Basic", muted: true },
    { text: "Priority support" }
  ],
  pro: [
    { text: "Smart redirects with bot detection on every click" },
    { text: "Full anti-bot engine included" },
    { text: "Everything in Plus", muted: true },
    { text: "Dedicated support" }
  ]
};
const CheckFull = () => /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", className: "mt-0.5 shrink-0 text-brand", children: /* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round" }) });
const CheckHollow = () => /* @__PURE__ */ jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", className: "mt-0.5 shrink-0 text-fg-dim", children: [
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9", stroke: "currentColor", strokeWidth: "1.6" }),
  /* @__PURE__ */ jsx("path", { d: "M8.5 12l2.4 2.4 4.6-4.8", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" })
] });
function Spec({ icon, label, value }) {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line bg-bg-soft/60 px-3 py-2.5", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-dim", children: [
      /* @__PURE__ */ jsx("span", { className: "text-fg-muted", children: icon }),
      label
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-1 text-lg font-extrabold tabular-nums", children: value || "∞" })
  ] });
}
function Billing() {
  var _a, _b;
  const { current } = useWorkspace();
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [interval, setBillingInterval] = useState("weekly");
  const monthly = interval === "monthly";
  const priceOf = (p) => monthly ? p.price_monthly : p.price;
  const redirectsOf = (p) => monthly && p.max_redirects_monthly ? p.max_redirects_monthly : p.max_redirects;
  const websitesOf = (p) => monthly && p.max_websites_monthly ? p.max_websites_monthly : p.max_websites;
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [params, setParams] = useSearchParams();
  const [payMsg, setPayMsg] = useState(null);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([billingApi.subscription(current.id), billingApi.plans()]);
      if (s.interval) setBillingInterval(s.interval);
      setSub(s);
      setPlans(p);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  useEffect(() => {
    const c = params.get("checkout");
    const clear = () => {
      params.delete("checkout");
      setParams(params, { replace: true });
    };
    if (!c || !current) return;
    if (c === "cancelled") {
      setPayMsg({ kind: "cancelled", text: "Checkout was cancelled — you have not been charged." });
      clear();
      return;
    }
    if (c !== "success") return;
    setPayMsg({ kind: "confirming", text: "Confirming your payment — this can take a few seconds…" });
    let tries = 0;
    const iv = setInterval(async () => {
      tries++;
      try {
        const s = await billingApi.verifyCheckout(current.id);
        if (s.status === "active") {
          setSub(s);
          setPayMsg({ kind: "done", text: `Payment confirmed — you're now on the ${s.plan.name} plan. A receipt has been emailed to you.` });
          clearInterval(iv);
          clear();
          return;
        }
      } catch {
      }
      if (tries >= 12) {
        setPayMsg({ kind: "confirming", text: "Payment received. We're still confirming it with the payment provider — your plan will switch on automatically, usually within a few minutes. Nothing else to do." });
        clearInterval(iv);
        clear();
      }
    }, 2e3);
    return () => clearInterval(iv);
  }, [current == null ? void 0 : current.id]);
  async function doChange() {
    var _a2;
    if (!target) return;
    setBusy(true);
    setErr("");
    try {
      const res = await billingApi.checkout(current.id, target.slug, interval);
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }
      setSub(await billingApi.subscription(current.id));
      setTarget(null);
    } catch (e) {
      setErr(((_a2 = e.data) == null ? void 0 : _a2.detail) || e.message || "Could not change plan. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function doCancel() {
    var _a2;
    setBusy(true);
    setErr("");
    try {
      setSub(await billingApi.cancel(current.id));
      setCancelOpen(false);
    } catch (e) {
      setErr(((_a2 = e.data) == null ? void 0 : _a2.detail) || e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading || !sub) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  const onPaidPlan = sub.status === "active" && !((_a = sub.access) == null ? void 0 : _a.locked);
  const isCurrentSlug = onPaidPlan ? sub.plan.slug : "";
  const daysLeft = ((_b = sub.access) == null ? void 0 : _b.days_left) ?? null;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "billing", children: [
      "Choose ",
      /* @__PURE__ */ jsx("b", { children: "weekly" }),
      " or ",
      /* @__PURE__ */ jsx("b", { children: "monthly" }),
      " access — renew when it runs out, and any unused days roll over. Payment is in ",
      /* @__PURE__ */ jsx("b", { children: "cryptocurrency" }),
      " through our secure checkout (Bachs)."
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Billing" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Days you have left are added to whatever you buy next — you never lose time by renewing early or changing tier." }),
    payMsg && /* @__PURE__ */ jsxs("div", { className: `mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${payMsg.kind === "done" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : payMsg.kind === "cancelled" ? "border-line bg-bg-soft text-fg-muted" : "border-brand/30 bg-brand/5 text-brand"}`, children: [
      payMsg.kind === "confirming" && /* @__PURE__ */ jsx("span", { className: "h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" }),
      /* @__PURE__ */ jsxs("span", { children: [
        payMsg.kind === "done" ? "✅ " : "",
        payMsg.text
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 flex flex-wrap items-center justify-between gap-4 p-6", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Current plan" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("span", { className: "text-2xl font-extrabold", children: sub.plan.name }),
          /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[sub.status]}`, children: sub.status }),
          /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-muted", children: sub.interval })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 text-sm text-fg-muted", children: [
          "$",
          sub.interval === "monthly" ? sub.plan.price_monthly : sub.plan.price,
          "/",
          sub.interval === "monthly" ? "month" : "week",
          " · ",
          daysLeft != null ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} of access left` : "renew when it runs out",
          sub.period_end && ` · access through ${new Date(sub.period_end).toLocaleDateString()}`
        ] })
      ] }),
      canManage && sub.status !== "canceled" && /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => setCancelOpen(true), children: "Cancel subscription" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-8 flex justify-center", children: /* @__PURE__ */ jsx(IntervalToggle, { value: interval, onChange: setBillingInterval, savings: "Save up to 46%" }) }),
    /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-5 lg:grid-cols-3", children: plans.map((p) => {
      const isCurrent = p.slug === isCurrentSlug;
      const feats = PLAN_FEATURES[p.slug] || [];
      return /* @__PURE__ */ jsxs("div", { className: `card relative flex flex-col p-6 ${isCurrent ? "ring-2 ring-brand" : "shadow-soft"}`, children: [
        isCurrent && /* @__PURE__ */ jsx("span", { className: "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-fg px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-bg", children: "Current plan" }),
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: p.name }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 flex items-end gap-1", children: [
          /* @__PURE__ */ jsxs("span", { className: "text-3xl font-extrabold", children: [
            "$",
            priceOf(p)
          ] }),
          /* @__PURE__ */ jsxs("span", { className: "pb-1 text-sm text-fg-dim", children: [
            "/",
            monthly ? "month" : "week"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-0.5 text-xs text-fg-dim", children: [
          monthly ? "30" : "7",
          " days of access"
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsx(Spec, { icon: /* @__PURE__ */ jsx(ILink, { width: 13 }), label: "Redirects", value: redirectsOf(p) }),
          /* @__PURE__ */ jsx(Spec, { icon: /* @__PURE__ */ jsx(IGlobe, { width: 13 }), label: "Domains", value: websitesOf(p) })
        ] }),
        /* @__PURE__ */ jsx("ul", { className: "mt-4 flex-1 space-y-2 text-sm", children: feats.map((f) => /* @__PURE__ */ jsxs("li", { className: `flex gap-2 ${f.muted ? "text-fg-dim" : "text-fg-muted"}`, children: [
          f.muted ? /* @__PURE__ */ jsx(CheckHollow, {}) : /* @__PURE__ */ jsx(CheckFull, {}),
          /* @__PURE__ */ jsx("span", { children: f.text })
        ] }, f.text)) }),
        isCurrent ? /* @__PURE__ */ jsxs("div", { className: "mt-5", children: [
          canManage ? /* @__PURE__ */ jsxs(Button, { className: "w-full", onClick: () => {
            setErr("");
            setTarget(p);
          }, children: [
            "Renew ",
            p.name,
            " (",
            monthly ? "month" : "week",
            ")"
          ] }) : /* @__PURE__ */ jsx("div", { className: "rounded-full bg-bg-mute py-2 text-center text-sm font-semibold text-fg-muted", children: "Current plan" }),
          /* @__PURE__ */ jsx(Link, { to: "/dashboard/shield", className: "mt-2 block text-center text-xs font-semibold text-fg-muted hover:text-brand", children: "Configure anti-bot" })
        ] }) : canManage ? /* @__PURE__ */ jsxs(Button, { onClick: () => {
          setErr("");
          setTarget(p);
        }, variant: p.price > sub.plan.price ? "primary" : "outline", className: "mt-5 w-full", children: [
          onPaidPlan ? "Switch to" : "Get",
          " ",
          p.name,
          " (",
          monthly ? "month" : "week",
          ")"
        ] }) : /* @__PURE__ */ jsx("div", { className: "mt-5 text-center text-xs text-fg-dim", children: "Ask an admin to change plans" })
      ] }, p.id);
    }) }),
    /* @__PURE__ */ jsx(Modal, { open: !!target, onClose: () => !busy && setTarget(null), title: target && target.slug === isCurrentSlug ? `Renew ${target.name}` : "Choose a plan", children: target && sub && /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("p", { className: "text-sm text-fg-muted", children: [
        target.slug === isCurrentSlug ? "Renew" : "Move to",
        " the ",
        /* @__PURE__ */ jsx("b", { children: target.name }),
        " plan at ",
        /* @__PURE__ */ jsxs("b", { children: [
          "$",
          priceOf(target),
          "/",
          monthly ? "month" : "week"
        ] }),
        " ",
        "(",
        redirectsOf(target) || "∞",
        " redirects, ",
        websitesOf(target) || "∞",
        " domains)."
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "rounded-lg bg-bg-soft px-3 py-2 text-xs text-fg-muted", children: [
        "You'll be taken to our secure checkout (Bachs) — pay in cryptocurrency. Access starts as soon as payment succeeds, for ",
        monthly ? 30 : 7,
        " days. Any days you have left are added on top, so you never lose time."
      ] }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "outline", className: "flex-1", onClick: () => setTarget(null), disabled: busy, children: "Cancel" }),
        /* @__PURE__ */ jsx(Button, { className: "flex-1", onClick: doChange, disabled: busy, children: busy ? "Starting…" : "Continue to payment" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(Modal, { open: cancelOpen, onClose: () => !busy && setCancelOpen(false), title: "Cancel subscription", children: /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm text-fg-muted", children: "Your workspace keeps access until the end of the current 7-day period, then won't renew. You can resubscribe anytime." }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "outline", className: "flex-1", onClick: () => setCancelOpen(false), disabled: busy, children: "Keep my plan" }),
        /* @__PURE__ */ jsx(Button, { className: "flex-1", onClick: doCancel, disabled: busy, children: busy ? "Cancelling…" : "Cancel subscription" })
      ] })
    ] }) })
  ] });
}
export {
  Billing as default
};

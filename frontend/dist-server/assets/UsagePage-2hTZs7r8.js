import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { c as useWorkspace, d as billingApi } from "../entry-server.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const levelTone = {
  ok: { bar: "bg-success", text: "text-emerald-700", msg: "You're well within your limit." },
  notice: { bar: "bg-warning", text: "text-amber-700", msg: "You've used over 70% of your plan." },
  warning: { bar: "bg-warning", text: "text-amber-700", msg: "You've used over 85% — consider upgrading soon." },
  critical: { bar: "bg-danger", text: "text-red-600", msg: "You've hit your plan limit. Upgrade to keep full coverage." }
};
function UsagePage() {
  const { current } = useWorkspace();
  const [u, setU] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    billingApi.usage(current.id).then(setU).finally(() => setLoading(false));
  }, [current == null ? void 0 : current.id]);
  if (loading || !u) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  const pct = Math.min(u.events.pct * 100, 100);
  const tone = levelTone[u.events.level];
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "usage", children: [
      "This shows how much of your monthly allowance you've used. Each visit we analyze counts as one ",
      /* @__PURE__ */ jsx("b", { children: "event" }),
      ". If you're getting close to the limit, upgrade your plan so we keep checking every visitor."
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Usage" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
      "Billing period ",
      new Date(u.period.start).toLocaleDateString(),
      " – ",
      new Date(u.period.end).toLocaleDateString(),
      " · ",
      u.plan.name,
      " plan"
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-end justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Events processed" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-1 text-3xl font-extrabold", children: [
            u.events.used.toLocaleString(),
            " ",
            /* @__PURE__ */ jsxs("span", { className: "text-lg font-normal text-fg-dim", children: [
              "/ ",
              u.events.limit.toLocaleString()
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: `text-sm font-semibold ${tone.text}`, children: [
          (u.events.pct * 100).toFixed(1),
          "%"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-4 h-3 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: `h-full rounded-full ${tone.bar}`, style: { width: `${pct}%` } }) }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-between gap-2 text-sm", children: [
        /* @__PURE__ */ jsx("span", { className: tone.text, children: tone.msg }),
        /* @__PURE__ */ jsxs("span", { className: "text-fg-muted", children: [
          u.events.remaining.toLocaleString(),
          " events remaining"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "mt-2 flex gap-4 text-xs text-fg-dim", children: /* @__PURE__ */ jsx("span", { children: "Alerts at 70%, 85%, 100%" }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-4 sm:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Websites" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 text-2xl font-extrabold", children: [
          u.websites.used,
          u.websites.limit ? ` / ${u.websites.limit}` : ""
        ] }),
        /* @__PURE__ */ jsx("div", { className: `mt-1 text-xs ${u.websites.limit && u.websites.used >= u.websites.limit ? "font-semibold text-amber-700" : "text-fg-dim"}`, children: u.websites.limit ? u.websites.used >= u.websites.limit ? u.on_trial ? "Trial limit reached — upgrade to add more" : "Plan limit reached — upgrade to add more" : u.on_trial ? "of your trial limit" : "of your plan" : "Unlimited on your plan" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Campaigns" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 text-2xl font-extrabold", children: [
          u.campaigns.used,
          u.campaigns.limit ? ` / ${u.campaigns.limit}` : ""
        ] }),
        /* @__PURE__ */ jsx("div", { className: `mt-1 text-xs ${u.campaigns.limit && u.campaigns.used >= u.campaigns.limit ? "font-semibold text-amber-700" : "text-fg-dim"}`, children: u.campaigns.limit ? u.campaigns.used >= u.campaigns.limit ? u.on_trial ? "Trial limit reached — upgrade to add more" : "Plan limit reached — upgrade to add more" : u.on_trial ? "of your trial limit" : "of your plan" : "Unlimited on your plan" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Team members" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 text-2xl font-extrabold", children: [
          u.team.used,
          u.team.limit ? ` / ${u.team.limit}` : ""
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-fg-dim", children: u.team.limit ? "of your plan" : "Unlimited" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Data retention" }),
        /* @__PURE__ */ jsxs("div", { className: "mt-2 text-2xl font-extrabold", children: [
          u.retention_days,
          " days"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-fg-dim", children: "How long we keep your data" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: "Plan" }),
        /* @__PURE__ */ jsx("div", { className: "mt-2 text-2xl font-extrabold", children: u.plan.name }),
        /* @__PURE__ */ jsxs("div", { className: "mt-1 text-xs text-fg-dim", children: [
          "$",
          u.plan.price,
          "/month"
        ] })
      ] })
    ] })
  ] });
}
export {
  UsagePage as default
};

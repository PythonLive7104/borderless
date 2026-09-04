import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { P as adminApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function AdminOverview() {
  const [d, setD] = useState(null);
  useEffect(() => {
    adminApi.overview().then(setD);
  }, []);
  if (!d) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  const tiles = [
    ["MRR", `$${d.mrr.toLocaleString()}`],
    ["Active subscriptions", d.active_subscriptions],
    ["Users", d.users],
    ["Organizations", d.organizations],
    ["Events processed", d.events_processed.toLocaleString()],
    ["Conversions", d.conversions],
    ["Websites", d.websites],
    ["Campaigns", d.campaigns]
  ];
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Platform overview" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Company-wide metrics across all workspaces." }),
    /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: tiles.map(([k, v]) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
      /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: k }),
      /* @__PURE__ */ jsx("div", { className: "mt-2 text-2xl font-extrabold", children: v })
    ] }, k)) }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-6", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Subscriptions by plan" }),
      /* @__PURE__ */ jsx("div", { className: "mt-4 flex flex-wrap gap-4", children: Object.entries(d.subscriptions_by_plan).map(([plan, n]) => /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-line px-4 py-3", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: plan }),
        /* @__PURE__ */ jsx("div", { className: "text-2xl font-extrabold", children: n })
      ] }, plan)) })
    ] })
  ] });
}
export {
  AdminOverview as default
};

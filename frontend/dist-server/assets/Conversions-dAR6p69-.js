import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { c as useWorkspace, j as conversionsApi } from "../entry-server.js";
import { R as RangeTabs } from "./RangeTabs-BPSt5JoP.js";
import { S as StatCard } from "./StatCard-ChLtMs89.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const money = (n) => `$${n.toLocaleString(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
function Breakdown({ title, rows }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: title }),
    rows.length === 0 ? /* @__PURE__ */ jsx(NoData, { msg: "No data" }) : /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-3", children: rows.map((r) => /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-1 flex justify-between text-sm", children: [
        /* @__PURE__ */ jsx("span", { className: "capitalize", children: r.key }),
        /* @__PURE__ */ jsxs("span", { className: "font-semibold", children: [
          money(r.revenue),
          " · ",
          r.count
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "h-2 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-brand", style: { width: `${r.revenue / max * 100}%` } }) })
    ] }, r.key)) })
  ] });
}
function Conversions() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("7d");
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    conversionsApi.get(current.id, range).then(setD).finally(() => setLoading(false));
  }, [current == null ? void 0 : current.id, range]);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "conversions", children: [
      "A ",
      /* @__PURE__ */ jsx("b", { children: "conversion" }),
      " is a valuable action like a purchase or sign-up. This page shows how many you got and how much money they made — so you can see which traffic actually pays off. Your website sends these automatically when you call ",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1", children: "bl('conversion', …)" }),
      "."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Conversions" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Sales and sign-ups attributed to your traffic." })
      ] }),
      /* @__PURE__ */ jsx(RangeTabs, { value: range, onChange: setRange })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : !d ? null : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [
        /* @__PURE__ */ jsx(StatCard, { label: "Conversions", value: d.totals.conversions.toLocaleString(), tone: "brand" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Revenue", value: money(d.totals.revenue), tone: "green" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Revenue / visitor", value: money(d.totals.revenue_per_visitor), tone: "amber" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Avg order value", value: money(d.totals.avg_order_value) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-5 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsx(Breakdown, { title: "Revenue by campaign", rows: d.by_campaign }),
        /* @__PURE__ */ jsx(Breakdown, { title: "Revenue by source", rows: d.by_source })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 overflow-hidden", children: [
        /* @__PURE__ */ jsx("h3", { className: "border-b border-line px-5 py-3 text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Recent conversions" }),
        d.recent.length === 0 ? /* @__PURE__ */ jsx(NoData, {}) : /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
          /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Time" }),
            /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Event" }),
            /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Revenue" }),
            /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Source" }),
            /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Campaign" }),
            /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Visitor" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: d.recent.map((c) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 whitespace-nowrap text-fg-muted", children: new Date(c.created_at).toLocaleString() }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: c.event_name }),
            /* @__PURE__ */ jsxs("td", { className: "px-4 py-3 font-semibold", children: [
              money(c.revenue),
              " ",
              c.currency
            ] }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: c.utm_source }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: c.utm_campaign || "—" }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-mono text-xs", children: c.visitor_ref.slice(0, 12) })
          ] }, c.id)) })
        ] }) })
      ] })
    ] })
  ] });
}
export {
  Conversions as default
};

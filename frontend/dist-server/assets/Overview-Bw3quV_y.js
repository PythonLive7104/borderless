import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { ResponsiveContainer, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Area, LineChart, Line, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, e as analyticsApi } from "../entry-server.js";
import { R as RangeTabs } from "./RangeTabs-BPSt5JoP.js";
import { S as StatCard } from "./StatCard-ChLtMs89.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const CLASS_COLORS = {
  human: "#16a34a",
  suspicious: "#d97706",
  bot: "#ea580c",
  fraud: "#dc2626"
};
const fmtDate = (d) => new Date(d).toLocaleDateString(void 0, { month: "short", day: "numeric" });
function Panel({ title, children }) {
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
    /* @__PURE__ */ jsx("h3", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: title }),
    /* @__PURE__ */ jsx("div", { className: "mt-4", children })
  ] });
}
function Overview() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    analyticsApi.overview(current.id, range).then(setData).finally(() => setLoading(false));
  }, [current == null ? void 0 : current.id, range]);
  const t = data == null ? void 0 : data.totals;
  const hasData = ((t == null ? void 0 : t.events) ?? 0) > 0;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "overview", children: [
      "This is your ",
      /* @__PURE__ */ jsx("b", { children: "control center" }),
      ". It shows how many people visit your sites and how many are real vs. bots. A higher ",
      /* @__PURE__ */ jsx("b", { children: "Traffic quality" }),
      " is better — it means most visitors are genuine. Use the date buttons on the right to change the time period."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Dashboard" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          current == null ? void 0 : current.name,
          " · traffic overview"
        ] })
      ] }),
      /* @__PURE__ */ jsx(RangeTabs, { value: range, onChange: setRange })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [
        /* @__PURE__ */ jsx(StatCard, { label: "Visitors", value: t.visitors.toLocaleString(), sub: `${t.events} events`, tone: "brand" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Traffic quality", value: `${(t.quality * 100).toFixed(1)}%`, sub: `${t.human} human`, tone: "green" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Suspicious + Fraud", value: (t.suspicious + t.bot + t.fraud).toLocaleString(), sub: `${t.flagged} flagged`, tone: "red" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Conversions", value: t.conversions.toLocaleString(), sub: `${(t.conversion_rate * 100).toFixed(1)}% rate`, tone: "amber" })
      ] }),
      !hasData ? /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6", children: /* @__PURE__ */ jsx(NoData, { msg: "No traffic in this range yet. Install your tracking snippet to start receiving data." }) }) : /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-5 lg:grid-cols-2", children: [
        /* @__PURE__ */ jsx(Panel, { title: "Visitors over time", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: 220, children: /* @__PURE__ */ jsxs(AreaChart, { data: data.timeseries.visitors, children: [
          /* @__PURE__ */ jsx("defs", { children: /* @__PURE__ */ jsxs("linearGradient", { id: "gv", x1: "0", y1: "0", x2: "0", y2: "1", children: [
            /* @__PURE__ */ jsx("stop", { offset: "0%", stopColor: "#2563eb", stopOpacity: 0.35 }),
            /* @__PURE__ */ jsx("stop", { offset: "100%", stopColor: "#2563eb", stopOpacity: 0 })
          ] }) }),
          /* @__PURE__ */ jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#eef1f6" }),
          /* @__PURE__ */ jsx(XAxis, { dataKey: "date", tickFormatter: fmtDate, tick: { fontSize: 12, fill: "#8b93a3" } }),
          /* @__PURE__ */ jsx(YAxis, { allowDecimals: false, tick: { fontSize: 12, fill: "#8b93a3" }, width: 30 }),
          /* @__PURE__ */ jsx(Tooltip, { labelFormatter: fmtDate }),
          /* @__PURE__ */ jsx(Area, { type: "monotone", dataKey: "count", stroke: "#2563eb", strokeWidth: 2, fill: "url(#gv)" })
        ] }) }) }),
        /* @__PURE__ */ jsx(Panel, { title: "Traffic quality over time", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: 220, children: /* @__PURE__ */ jsxs(LineChart, { data: data.timeseries.quality.map((q) => ({ ...q, pct: Math.round(q.pct * 100) })), children: [
          /* @__PURE__ */ jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#eef1f6" }),
          /* @__PURE__ */ jsx(XAxis, { dataKey: "date", tickFormatter: fmtDate, tick: { fontSize: 12, fill: "#8b93a3" } }),
          /* @__PURE__ */ jsx(YAxis, { domain: [0, 100], tick: { fontSize: 12, fill: "#8b93a3" }, width: 30, unit: "%" }),
          /* @__PURE__ */ jsx(Tooltip, { labelFormatter: fmtDate, formatter: (v) => [`${v}%`, "Quality"] }),
          /* @__PURE__ */ jsx(Line, { type: "monotone", dataKey: "pct", stroke: "#16a34a", strokeWidth: 2, dot: false })
        ] }) }) }),
        /* @__PURE__ */ jsx(Panel, { title: "Risk distribution", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsx(ResponsiveContainer, { width: "50%", height: 180, children: /* @__PURE__ */ jsxs(PieChart, { children: [
            /* @__PURE__ */ jsx(Pie, { data: data.breakdowns.classifications, dataKey: "count", nameKey: "key", innerRadius: 45, outerRadius: 70, paddingAngle: 2, children: data.breakdowns.classifications.map((c) => /* @__PURE__ */ jsx(Cell, { fill: CLASS_COLORS[c.key] || "#94a3b8" }, c.key)) }),
            /* @__PURE__ */ jsx(Tooltip, {})
          ] }) }),
          /* @__PURE__ */ jsx("ul", { className: "flex-1 space-y-2 text-sm", children: data.breakdowns.classifications.map((c) => /* @__PURE__ */ jsxs("li", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 capitalize", children: [
              /* @__PURE__ */ jsx("span", { className: "h-2.5 w-2.5 rounded-full", style: { background: CLASS_COLORS[c.key] || "#94a3b8" } }),
              c.key
            ] }),
            /* @__PURE__ */ jsx("span", { className: "font-semibold", children: c.count })
          ] }, c.key)) })
        ] }) }),
        /* @__PURE__ */ jsx(Panel, { title: "Devices", children: /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: 180, children: /* @__PURE__ */ jsxs(BarChart, { data: data.breakdowns.devices, children: [
          /* @__PURE__ */ jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "#eef1f6", vertical: false }),
          /* @__PURE__ */ jsx(XAxis, { dataKey: "key", tick: { fontSize: 12, fill: "#8b93a3" } }),
          /* @__PURE__ */ jsx(YAxis, { allowDecimals: false, tick: { fontSize: 12, fill: "#8b93a3" }, width: 30 }),
          /* @__PURE__ */ jsx(Tooltip, {}),
          /* @__PURE__ */ jsx(Bar, { dataKey: "count", fill: "#6d5efc", radius: [6, 6, 0, 0] })
        ] }) }) }),
        /* @__PURE__ */ jsx(Panel, { title: "Top countries", children: /* @__PURE__ */ jsx(BarList, { rows: data.breakdowns.countries }) }),
        /* @__PURE__ */ jsx(Panel, { title: "Traffic sources", children: /* @__PURE__ */ jsx(BarList, { rows: data.breakdowns.sources }) })
      ] })
    ] })
  ] });
}
function BarList({ rows }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  if (!rows.length) return /* @__PURE__ */ jsx(NoData, { msg: "No data" });
  return /* @__PURE__ */ jsx("div", { className: "space-y-2.5", children: rows.map((r) => /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-1 flex justify-between text-sm", children: [
      /* @__PURE__ */ jsx("span", { className: "capitalize", children: r.key }),
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-fg-muted", children: r.count })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "h-2 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-brand", style: { width: `${r.count / max * 100}%` } }) })
  ] }, r.key)) });
}
export {
  Overview as default
};

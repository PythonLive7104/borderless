import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { A as analyticsApi, c as useWorkspace, S as downloadReportCsv } from "../entry-server.js";
import { R as RangeTabs } from "./RangeTabs-BPSt5JoP.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { W as WebsitePicker } from "./WebsitePicker-BhUQYD8k.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function FunnelReport({ orgId, range, website }) {
  var _a, _b;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    analyticsApi.funnel(orgId, range, website).then(setData).finally(() => setLoading(false));
  }, [orgId, range, website]);
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "card shadow-soft h-48 animate-pulse rounded-2xl bg-bg-mute/40" });
  }
  if (!data || data.total === 0) {
    return /* @__PURE__ */ jsx("div", { className: "card shadow-soft p-6 text-sm text-fg-muted", children: "No traffic checked in this period yet. Once visitors start arriving, this shows how many reached your page and how many were filtered out." });
  }
  const pct = (n) => data.total ? n / data.total * 100 : 0;
  const segs = [
    { key: "allowed", label: "Reached your page", count: data.passed, cls: "bg-success" },
    { key: "flagged", label: "Passed but flagged", count: data.flagged, cls: "bg-warning" },
    {
      key: "redirected",
      label: "Redirected away",
      count: ((_a = data.stages.find((s) => s.key === "redirected")) == null ? void 0 : _a.count) ?? 0,
      cls: "bg-indigo-500"
    },
    {
      key: "blocked",
      label: "Blocked",
      count: ((_b = data.stages.find((s) => s.key === "blocked")) == null ? void 0 : _b.count) ?? 0,
      cls: "bg-danger"
    }
  ].filter((s) => s.count > 0);
  const maxReason = Math.max(1, ...data.reasons.map((r) => r.count));
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-2", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "Filtering funnel" }),
      /* @__PURE__ */ jsxs("span", { className: "text-xs text-fg-dim", children: [
        "last ",
        data.range.days,
        " day",
        data.range.days === 1 ? "" : "s"
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "What the engine did with your traffic — real visitors through, automated traffic turned away." }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-3 sm:grid-cols-3", children: [
      /* @__PURE__ */ jsx(Tile, { label: "Traffic checked", value: data.total.toLocaleString(), tone: "neutral" }),
      /* @__PURE__ */ jsx(
        Tile,
        {
          label: "Reached your page",
          value: data.passed.toLocaleString(),
          sub: `${(data.pass_rate * 100).toFixed(1)}% of traffic`,
          tone: "good"
        }
      ),
      /* @__PURE__ */ jsx(
        Tile,
        {
          label: "Turned away",
          value: data.turned_away.toLocaleString(),
          sub: `${(data.filter_rate * 100).toFixed(1)}% filtered`,
          tone: "bad"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6", children: [
      /* @__PURE__ */ jsx("div", { className: "flex h-4 w-full overflow-hidden rounded-full bg-bg-mute", children: segs.map((s) => /* @__PURE__ */ jsx(
        "div",
        {
          className: s.cls,
          style: { width: `${pct(s.count)}%` },
          title: `${s.label}: ${s.count.toLocaleString()}`
        },
        s.key
      )) }),
      /* @__PURE__ */ jsx("div", { className: "mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted", children: segs.map((s) => /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5", children: [
        /* @__PURE__ */ jsx("span", { className: `inline-block h-2 w-2 rounded-full ${s.cls}` }),
        s.label,
        " ",
        /* @__PURE__ */ jsx("b", { className: "text-fg", children: s.count.toLocaleString() })
      ] }, s.key)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-6 md:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold", children: "Why traffic was turned away" }),
        data.reasons.length === 0 ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-fg-muted", children: "Nothing was filtered in this period." }) : /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-2", children: data.reasons.map((r) => /* @__PURE__ */ jsxs("li", { className: "text-sm", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("span", { children: r.label }),
            /* @__PURE__ */ jsx("span", { className: "tabular-nums text-fg-muted", children: r.count.toLocaleString() })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-1 h-1.5 w-full rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx(
            "div",
            {
              className: "h-1.5 rounded-full bg-danger/70",
              style: { width: `${r.count / maxReason * 100}%` }
            }
          ) })
        ] }, r.key)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h3", { className: "text-sm font-semibold", children: "By classification" }),
        /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-2 text-sm", children: data.by_classification.map((c) => /* @__PURE__ */ jsxs("li", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: `inline-block h-2 w-2 rounded-full ${CLASS_DOT[c.key] || "bg-fg-dim"}` }),
            /* @__PURE__ */ jsx("span", { className: "capitalize", children: c.key })
          ] }),
          /* @__PURE__ */ jsx("span", { className: "tabular-nums text-fg-muted", children: c.count.toLocaleString() })
        ] }, c.key)) })
      ] })
    ] })
  ] });
}
const CLASS_DOT = {
  human: "bg-success",
  suspicious: "bg-warning",
  bot: "bg-indigo-500",
  fraud: "bg-danger"
};
function Tile({ label, value, sub, tone }) {
  const ring = tone === "good" ? "border-success/30 bg-success/5" : tone === "bad" ? "border-danger/30 bg-danger/5" : "border-line";
  const num = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-600" : "text-fg";
  return /* @__PURE__ */ jsxs("div", { className: `rounded-xl border p-4 ${ring}`, children: [
    /* @__PURE__ */ jsx("div", { className: "text-xs font-medium uppercase tracking-wide text-fg-dim", children: label }),
    /* @__PURE__ */ jsx("div", { className: `mt-1 text-2xl font-extrabold tabular-nums ${num}`, children: value }),
    sub && /* @__PURE__ */ jsx("div", { className: "text-xs text-fg-muted", children: sub })
  ] });
}
const DIM_LABELS = {
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
  classification: "Classification",
  action: "Action",
  utm_source: "UTM source",
  utm_medium: "UTM medium",
  utm_campaign: "UTM campaign"
};
function Reports() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("30d");
  const [website, setWebsite] = useState("");
  const [dimension, setDimension] = useState("country");
  const [rows, setRows] = useState([]);
  const [dims, setDims] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    analyticsApi.report(current.id, dimension, range, website).then((d) => {
      setRows(d.rows);
      setDims(d.dimensions);
    }).finally(() => setLoading(false));
  }, [current == null ? void 0 : current.id, dimension, range, website]);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "reports", children: [
      "Build a quick report by choosing what to group your traffic by — country, device, source, and so on. You'll see visitors, quality and conversions for each. Click ",
      /* @__PURE__ */ jsx("b", { children: "Export CSV" }),
      " to download it for a spreadsheet."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Reports" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Break traffic down by any dimension and export it." })
      ] }),
      current && /* @__PURE__ */ jsx(WebsitePicker, { orgId: current.id, value: website, onChange: setWebsite }),
      /* @__PURE__ */ jsx(RangeTabs, { value: range, onChange: setRange })
    ] }),
    current && /* @__PURE__ */ jsx("div", { className: "mt-5", children: /* @__PURE__ */ jsx(FunnelReport, { orgId: current.id, range, website }) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold text-fg-muted", children: "Group by" }),
      /* @__PURE__ */ jsx(
        "select",
        {
          value: dimension,
          onChange: (e) => setDimension(e.target.value),
          className: "rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand",
          children: (dims.length ? dims : Object.keys(DIM_LABELS)).map((d) => /* @__PURE__ */ jsx("option", { value: d, children: DIM_LABELS[d] || d }, d))
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => current && downloadReportCsv(current.id, dimension, range, website),
          className: "ml-auto rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand/40",
          children: "↓ Export CSV"
        }
      )
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-5", children: /* @__PURE__ */ jsx(NoData, {}) }) : /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-5 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: DIM_LABELS[dimension] || dimension }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Events" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Visitors" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Human" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Conversions" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3 w-1/4", children: "Quality" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((r) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold capitalize", children: r.key }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: r.events }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: r.visitors }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: r.human }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: r.conversions }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("div", { className: "h-2 flex-1 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-success", style: { width: `${r.quality * 100}%` } }) }),
          /* @__PURE__ */ jsxs("span", { className: "w-10 text-right text-xs font-semibold", children: [
            (r.quality * 100).toFixed(0),
            "%"
          ] })
        ] }) })
      ] }, r.key)) })
    ] }) }) })
  ] });
}
export {
  Reports as default
};

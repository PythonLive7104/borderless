import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { c as useWorkspace, x as analyticsApi, P as downloadReportCsv } from "../entry-server.js";
import { R as RangeTabs } from "./RangeTabs-BPSt5JoP.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
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
  const [dimension, setDimension] = useState("country");
  const [rows, setRows] = useState([]);
  const [dims, setDims] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    analyticsApi.report(current.id, dimension, range).then((d) => {
      setRows(d.rows);
      setDims(d.dimensions);
    }).finally(() => setLoading(false));
  }, [current == null ? void 0 : current.id, dimension, range]);
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
      /* @__PURE__ */ jsx(RangeTabs, { value: range, onChange: setRange })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap items-center gap-2", children: [
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
          onClick: () => current && downloadReportCsv(current.id, dimension, range),
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

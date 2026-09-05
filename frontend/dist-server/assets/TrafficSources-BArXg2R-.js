import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, z as analyticsApi } from "../entry-server.js";
import { R as RangeTabs } from "./RangeTabs-BPSt5JoP.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function TrafficSources() {
  const { current } = useWorkspace();
  const [range, setRange] = useState("7d");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!current) return;
    setLoading(true);
    analyticsApi.sources(current.id, range).then((d) => setRows(d.sources)).finally(() => setLoading(false));
  }, [current == null ? void 0 : current.id, range]);
  const q = (v) => `${(v * 100).toFixed(0)}%`;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "traffic-sources", children: [
      "This shows ",
      /* @__PURE__ */ jsx("b", { children: "where your visitors come from" }),
      " (Facebook, Google, and so on) and how trustworthy each source is. Spend more on the sources with high quality."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Traffic Sources" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Volume and quality by source." })
      ] }),
      /* @__PURE__ */ jsx(RangeTabs, { value: range, onChange: setRange })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6", children: /* @__PURE__ */ jsx(NoData, {}) }) : /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Source" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Events" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Human" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3 w-1/3", children: "Quality" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((s) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold capitalize", children: s.key }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: s.events }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: s.human }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx("div", { className: "h-2 flex-1 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-success", style: { width: q(s.quality) } }) }),
          /* @__PURE__ */ jsx("span", { className: "w-10 text-right font-semibold", children: q(s.quality) })
        ] }) })
      ] }, s.key)) })
    ] }) })
  ] });
}
export {
  TrafficSources as default
};

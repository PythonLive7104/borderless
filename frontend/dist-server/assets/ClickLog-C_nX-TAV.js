import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, x as analyticsApi } from "../entry-server.js";
import { C as ClassBadge } from "./ClassBadge-B1OvS151.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { P as Pager } from "./Pager-Dnb3DgGO.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const PAGE_SIZE = 25;
const actionTone = {
  allow: "bg-success/10 text-emerald-700",
  review: "bg-warning/10 text-amber-700",
  block: "bg-danger/10 text-red-600",
  tag: "bg-brand/10 text-brand"
};
function ClickLog() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ search: "", classification: "", action: "", type: "", min_risk: "" });
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const res = await analyticsApi.events(current.id, { ...f, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(res.results);
      setTotal(res.count);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setPage(0);
  }, [JSON.stringify(f)]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [current == null ? void 0 : current.id, JSON.stringify(f), page]);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "click-log", children: [
      "A live list of ",
      /* @__PURE__ */ jsx("b", { children: "every visit" }),
      ", newest first. Use the filters to find things like all blocked bots, or all visits from one country."
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Click Log" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Every classified event, newest first." }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx("input", { value: f.search, onChange: set("search"), placeholder: "Search IP, URL, visitor…", className: "w-56 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand" }),
      /* @__PURE__ */ jsxs("select", { value: f.classification, onChange: set("classification"), className: "rounded-xl border border-line bg-white px-3 py-2 text-sm", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All classes" }),
        /* @__PURE__ */ jsx("option", { value: "human", children: "Human" }),
        /* @__PURE__ */ jsx("option", { value: "suspicious", children: "Suspicious" }),
        /* @__PURE__ */ jsx("option", { value: "bot", children: "Bot" }),
        /* @__PURE__ */ jsx("option", { value: "fraud", children: "Fraud" })
      ] }),
      /* @__PURE__ */ jsxs("select", { value: f.action, onChange: set("action"), className: "rounded-xl border border-line bg-white px-3 py-2 text-sm", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All actions" }),
        /* @__PURE__ */ jsx("option", { value: "allow", children: "Allow" }),
        /* @__PURE__ */ jsx("option", { value: "review", children: "Review" }),
        /* @__PURE__ */ jsx("option", { value: "block", children: "Block" }),
        /* @__PURE__ */ jsx("option", { value: "tag", children: "Tag" })
      ] }),
      /* @__PURE__ */ jsxs("select", { value: f.type, onChange: set("type"), className: "rounded-xl border border-line bg-white px-3 py-2 text-sm", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All types" }),
        /* @__PURE__ */ jsx("option", { value: "pageview", children: "Pageview" }),
        /* @__PURE__ */ jsx("option", { value: "event", children: "Event" }),
        /* @__PURE__ */ jsx("option", { value: "conversion", children: "Conversion" })
      ] }),
      /* @__PURE__ */ jsx("input", { value: f.min_risk, onChange: set("min_risk"), type: "number", placeholder: "min risk", className: "w-24 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-5", children: /* @__PURE__ */ jsx(NoData, { msg: "No events match." }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-5 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Time" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Type" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Country" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Device" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Risk" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Class" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Action" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((e) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 whitespace-nowrap text-fg-muted", children: new Date(e.created_at).toLocaleString() }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: e.type }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: e.country || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: e.device || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-mono font-bold", children: e.risk_score ?? "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(ClassBadge, { value: e.classification }) }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${actionTone[e.action] || "bg-bg-mute"}`, children: [
            e.action,
            e.tag ? `:${e.tag}` : ""
          ] }) })
        ] }, e.id)) })
      ] }) }) }),
      /* @__PURE__ */ jsx(Pager, { page, pageSize: PAGE_SIZE, total, onPage: setPage })
    ] })
  ] });
}
export {
  ClickLog as default
};

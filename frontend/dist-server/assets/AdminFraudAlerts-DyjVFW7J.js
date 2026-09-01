import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { n as adminApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const classTone = {
  bot: "bg-danger/10 text-red-600",
  fraud: "bg-danger/20 text-red-700"
};
function AdminFraudAlerts() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    adminApi.fraudAlerts().then(setRows);
  }, []);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Fraud alerts" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
      "The ",
      rows.length,
      " most recent bot/fraud visits across all workspaces."
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "When" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Workspace" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Site" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "IP" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Ctry" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Class" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Risk" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Action" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Signals" })
      ] }) }),
      /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-line", children: [
        rows.length === 0 && /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: 9, className: "px-4 py-10 text-center text-fg-muted", children: "No bot or fraud traffic recorded yet." }) }),
        rows.map((e) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 whitespace-nowrap text-fg-muted", children: new Date(e.created_at).toLocaleString() }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold", children: e.organization }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: e.website }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-mono text-xs", children: e.ip || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: e.country || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${classTone[e.classification] || "bg-bg-mute"}`, children: e.classification }) }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 tabular-nums font-semibold", children: e.risk_score ?? "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: e.action }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-xs text-fg-muted", children: (e.signals || []).join(", ") })
        ] }, e.id))
      ] })
    ] }) }) })
  ] });
}
export {
  AdminFraudAlerts as default
};

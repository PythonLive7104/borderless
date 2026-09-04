import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Q as adminApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const statusTone = {
  trialing: "bg-brand/10 text-brand",
  active: "bg-success/10 text-emerald-700",
  canceled: "bg-danger/10 text-red-600"
};
function AdminOrgs() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    adminApi.organizations().then(setRows);
  }, []);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Organizations" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
      rows.length,
      " workspaces."
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Workspace" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Owner" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Plan" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Status" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Members" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Sites" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Created" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((o) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold", children: o.name }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: o.owner }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: o.plan }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[o.status] || "bg-bg-mute"}`, children: o.status }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: o.members }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: o.websites }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: new Date(o.created_at).toLocaleDateString() })
      ] }, o.id)) })
    ] }) }) })
  ] });
}
export {
  AdminOrgs as default
};

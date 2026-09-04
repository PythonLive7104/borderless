import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { S as adminApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function AdminUsers() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    adminApi.users().then(setRows);
  }, []);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Users" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
      rows.length,
      " most recent accounts."
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Email" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Name" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Verified" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Staff" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Workspaces" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Joined" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((u) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold", children: u.email }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: u.name || "—" }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: u.is_verified ? "✓" : "—" }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: u.is_staff ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand", children: "Staff" }) : "—" }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: u.orgs }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: new Date(u.date_joined).toLocaleDateString() })
      ] }, u.id)) })
    ] }) }) })
  ] });
}
export {
  AdminUsers as default
};

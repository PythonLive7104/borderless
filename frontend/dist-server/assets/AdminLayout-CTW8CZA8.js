import { jsxs, jsx } from "react/jsx-runtime";
import { NavLink, Link, Outlet } from "react-router-dom";
import { u as useAuth } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react";
const LINKS = [
  { to: "/admin", label: "Overview", end: true },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/organizations", label: "Organizations" },
  { to: "/admin/subscriptions", label: "Subscriptions" },
  { to: "/admin/fraud-alerts", label: "Fraud alerts" }
];
function AdminLayout() {
  const { user, logout } = useAuth();
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-bg-soft", children: [
    /* @__PURE__ */ jsx("header", { className: "bg-navy-900 text-white", children: /* @__PURE__ */ jsxs("div", { className: "mx-auto flex h-16 max-w-6xl items-center justify-between px-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-6", children: [
        /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2 font-extrabold", children: [
          "TrackAudit ",
          /* @__PURE__ */ jsx("span", { className: "rounded-md bg-white/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wide", children: "Admin" })
        ] }),
        /* @__PURE__ */ jsx("nav", { className: "hidden gap-1 sm:flex", children: LINKS.map((l) => /* @__PURE__ */ jsx(
          NavLink,
          {
            to: l.to,
            end: l.end,
            className: ({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? "bg-white/15 text-white" : "text-slate-300 hover:text-white"}`,
            children: l.label
          },
          l.to
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
        /* @__PURE__ */ jsx(Link, { to: "/dashboard", className: "text-slate-300 hover:text-white", children: "← Back to app" }),
        /* @__PURE__ */ jsx("span", { className: "hidden text-slate-400 sm:block", children: user == null ? void 0 : user.email }),
        /* @__PURE__ */ jsx("button", { onClick: logout, className: "rounded-lg border border-white/25 px-3 py-1.5 font-semibold hover:bg-white/10", children: "Sign out" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("main", { className: "mx-auto max-w-6xl px-5 py-8", children: /* @__PURE__ */ jsx(Outlet, {}) })
  ] });
}
export {
  AdminLayout as default
};

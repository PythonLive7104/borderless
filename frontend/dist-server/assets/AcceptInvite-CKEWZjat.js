import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { A as AuthLayout } from "./AuthLayout-DnASkzII.js";
import { u as useAuth, B as Button, o as orgApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState("idle");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!loading && !user) nav(`/login?next=/accept-invite?token=${token}`);
  }, [loading, user, token, nav]);
  async function accept() {
    var _a;
    setState("working");
    setMsg("");
    try {
      const r = await orgApi.acceptInvite(token);
      setMsg((r == null ? void 0 : r.organization) ? `You've joined ${r.organization}.` : "Invitation accepted.");
      setState("ok");
    } catch (e) {
      setMsg(((_a = e.data) == null ? void 0 : _a.detail) || "This invitation is invalid or has expired.");
      setState("fail");
    }
  }
  return /* @__PURE__ */ jsx(
    AuthLayout,
    {
      title: "Team invitation",
      subtitle: "Join a TrackAudit workspace.",
      footer: /* @__PURE__ */ jsx(Link, { to: "/dashboard", className: "font-semibold text-brand", children: "Go to dashboard" }),
      children: state === "ok" ? /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-success/25 bg-success/5 p-5 text-sm text-emerald-700", children: [
        msg,
        /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(Button, { to: "/dashboard", className: "w-full", children: "Open dashboard" }) })
      ] }) : state === "fail" ? /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-danger/25 bg-danger/5 p-5 text-sm text-red-600", children: msg }) : /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-fg-muted", children: [
          "You're signed in as ",
          /* @__PURE__ */ jsx("b", { children: user == null ? void 0 : user.email }),
          ". Accept the invitation to join the workspace."
        ] }),
        /* @__PURE__ */ jsx(Button, { onClick: accept, className: "w-full", children: state === "working" ? "Joining…" : "Accept invitation" })
      ] })
    }
  );
}
export {
  AcceptInvite as default
};

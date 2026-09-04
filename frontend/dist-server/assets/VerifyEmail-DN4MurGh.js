import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { A as AuthLayout } from "./AuthLayout-DnASkzII.js";
import { a as authApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState(token ? "working" : "fail");
  useEffect(() => {
    if (!token) return;
    authApi.verifyEmail(token).then(() => setState("ok")).catch(() => setState("fail"));
  }, [token]);
  const map = {
    working: { t: "Verifying your email…", s: "One moment while we confirm your link." },
    ok: { t: "Email verified 🎉", s: "Your email is confirmed. You can now sign in." },
    fail: { t: "Verification failed", s: "This link is invalid or has expired. Request a new one from your dashboard." }
  }[state];
  return /* @__PURE__ */ jsx(
    AuthLayout,
    {
      title: map.t,
      subtitle: map.s,
      footer: /* @__PURE__ */ jsx(Link, { to: "/login", className: "font-semibold text-brand", children: "Go to sign in" }),
      children: /* @__PURE__ */ jsxs("div", { className: "flex justify-center py-4", children: [
        state === "working" && /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }),
        state === "ok" && /* @__PURE__ */ jsx("div", { className: "grid h-14 w-14 place-items-center rounded-full bg-success/10 text-success", children: /* @__PURE__ */ jsx("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5" }) }) }),
        state === "fail" && /* @__PURE__ */ jsx("div", { className: "grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger", children: /* @__PURE__ */ jsx("svg", { width: "28", height: "28", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })
      ] })
    }
  );
}
export {
  VerifyEmail as default
};

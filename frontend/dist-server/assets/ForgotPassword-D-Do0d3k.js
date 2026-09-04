import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Link } from "react-router-dom";
import { A as AuthLayout } from "./AuthLayout-DnASkzII.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { B as Button, a as authApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
    } catch {
    } finally {
      setBusy(false);
      setSent(true);
    }
  }
  return /* @__PURE__ */ jsx(
    AuthLayout,
    {
      title: "Reset your password",
      subtitle: "We'll email you a secure reset link.",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Remembered it? ",
        /* @__PURE__ */ jsx(Link, { to: "/login", className: "font-semibold text-brand", children: "Back to sign in" })
      ] }),
      children: sent ? /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-success/25 bg-success/5 p-5 text-sm text-emerald-700", children: [
        "If an account exists for ",
        /* @__PURE__ */ jsx("b", { children: email }),
        ", a reset link is on its way. Check your inbox."
      ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
        /* @__PURE__ */ jsx(Field, { label: "Work email", type: "email", value: email, onChange: setEmail, placeholder: "you@company.com", autoComplete: "email" }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: busy ? "Sending…" : "Send reset link" })
      ] })
    }
  );
}
export {
  ForgotPassword as default
};

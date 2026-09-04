import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { A as AuthLayout } from "./AuthLayout-DnASkzII.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { B as Button, a as authApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function ResetPassword() {
  const { token = "" } = useParams();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    var _a;
    e.preventDefault();
    setErr("");
    if (password !== confirm) return setErr("Passwords do not match.");
    if (password.length < 8) return setErr("Password must be at least 8 characters.");
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      nav("/login");
    } catch (e2) {
      setErr(((_a = e2.data) == null ? void 0 : _a.detail) || "This reset link is invalid or has expired.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsx(
    AuthLayout,
    {
      title: "Set a new password",
      subtitle: "Choose a strong password you don't use elsewhere.",
      footer: /* @__PURE__ */ jsx(Link, { to: "/login", className: "font-semibold text-brand", children: "Back to sign in" }),
      children: /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
        /* @__PURE__ */ jsx(Field, { label: "New password", type: "password", value: password, onChange: setPassword, placeholder: "At least 8 characters", autoComplete: "new-password" }),
        /* @__PURE__ */ jsx(Field, { label: "Confirm password", type: "password", value: confirm, onChange: setConfirm, placeholder: "Re-enter password", autoComplete: "new-password" }),
        err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: busy ? "Updating…" : "Update password" })
      ] })
    }
  );
}
export {
  ResetPassword as default
};

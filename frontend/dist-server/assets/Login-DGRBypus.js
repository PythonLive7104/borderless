import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { A as AuthLayout } from "./AuthLayout-DnASkzII.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { u as useAuth, B as Button } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email, password);
      nav("/dashboard");
    } catch (e2) {
      setErr(e2.status === 401 ? "Invalid email or password." : e2.message);
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsx(
    AuthLayout,
    {
      title: "Welcome back",
      subtitle: "Sign in to your TryNoBot workspace.",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Don't have an account? ",
        /* @__PURE__ */ jsx(Link, { to: "/signup", className: "font-semibold text-brand", children: "Create one" })
      ] }),
      children: /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
        /* @__PURE__ */ jsx(Field, { label: "Work email", type: "email", value: email, onChange: setEmail, placeholder: "you@company.com", autoComplete: "email" }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Field, { label: "Password", type: "password", value: password, onChange: setPassword, placeholder: "••••••••", autoComplete: "current-password" }),
          /* @__PURE__ */ jsx("div", { className: "mt-1.5 text-right", children: /* @__PURE__ */ jsx(Link, { to: "/forgot-password", className: "text-xs font-medium text-brand hover:underline", children: "Forgot password?" }) })
        ] }),
        err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: busy ? "Signing in…" : "Sign in" })
      ] })
    }
  );
}
export {
  Login as default
};

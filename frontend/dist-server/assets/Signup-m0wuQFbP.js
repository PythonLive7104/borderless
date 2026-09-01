import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { A as AuthLayout } from "./AuthLayout-DnASkzII.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { u as useAuth, B as Button } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function Signup() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", password: "", confirm: "" });
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF({ ...f, [k]: v });
  async function submit(e) {
    var _a, _b;
    e.preventDefault();
    setErr("");
    if (f.password !== f.confirm) return setErr("Passwords do not match.");
    if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
    if (!terms) return setErr("Please accept the terms to continue.");
    setBusy(true);
    try {
      await register({ first_name: f.first_name, last_name: f.last_name, email: f.email, password: f.password });
      nav("/dashboard");
    } catch (e2) {
      const d = e2.data;
      setErr(((_a = d == null ? void 0 : d.email) == null ? void 0 : _a[0]) || ((_b = d == null ? void 0 : d.password) == null ? void 0 : _b[0]) || e2.message || "Could not create account.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsx(
    AuthLayout,
    {
      title: "Create your account",
      subtitle: "Start protecting your traffic in minutes.",
      footer: /* @__PURE__ */ jsxs(Fragment, { children: [
        "Already have an account? ",
        /* @__PURE__ */ jsx(Link, { to: "/login", className: "font-semibold text-brand", children: "Sign in" })
      ] }),
      children: /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsx(Field, { label: "First name", value: f.first_name, onChange: set("first_name"), placeholder: "Jane", autoComplete: "given-name" }),
          /* @__PURE__ */ jsx(Field, { label: "Last name", value: f.last_name, onChange: set("last_name"), placeholder: "Marketer", autoComplete: "family-name" })
        ] }),
        /* @__PURE__ */ jsx(Field, { label: "Work email", type: "email", value: f.email, onChange: set("email"), placeholder: "you@company.com", autoComplete: "email" }),
        /* @__PURE__ */ jsx(Field, { label: "Password", type: "password", value: f.password, onChange: set("password"), placeholder: "At least 8 characters", autoComplete: "new-password" }),
        /* @__PURE__ */ jsx(Field, { label: "Confirm password", type: "password", value: f.confirm, onChange: set("confirm"), placeholder: "Re-enter password", autoComplete: "new-password" }),
        /* @__PURE__ */ jsxs("label", { className: "flex items-start gap-2.5 text-sm text-fg-muted", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: terms, onChange: (e) => setTerms(e.target.checked), className: "mt-0.5 h-4 w-4 accent-brand" }),
          /* @__PURE__ */ jsxs("span", { children: [
            "I agree to the ",
            /* @__PURE__ */ jsx(Link, { to: "/terms", className: "text-brand hover:underline", children: "Terms" }),
            " and ",
            /* @__PURE__ */ jsx(Link, { to: "/privacy", className: "text-brand hover:underline", children: "Privacy Policy" }),
            "."
          ] })
        ] }),
        err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: busy ? "Creating account…" : "Create account" })
      ] })
    }
  );
}
export {
  Signup as default
};

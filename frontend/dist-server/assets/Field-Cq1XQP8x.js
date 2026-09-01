import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
function Field({ label, type = "text", value, onChange, placeholder, required = true, autoComplete }) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const inputType = isPassword && show ? "text" : type;
  return /* @__PURE__ */ jsxs("label", { className: "block", children: [
    /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "relative", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          type: inputType,
          value,
          required,
          placeholder,
          autoComplete,
          onChange: (e) => onChange(e.target.value),
          className: `w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 ${isPassword ? "pr-16" : ""}`
        }
      ),
      isPassword && /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setShow((s) => !s),
          tabIndex: -1,
          className: "absolute inset-y-0 right-0 flex items-center px-3 text-xs font-semibold text-fg-muted hover:text-brand",
          children: show ? "Hide" : "Show"
        }
      )
    ] })
  ] });
}
export {
  Field as F
};

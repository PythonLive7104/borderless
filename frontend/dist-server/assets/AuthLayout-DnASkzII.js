import { jsxs, jsx } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { L as Logo, b as BRAND } from "../entry-server.js";
function AuthLayout({ title, subtitle, children, footer }) {
  return /* @__PURE__ */ jsxs("div", { className: "grid min-h-screen lg:grid-cols-2", children: [
    /* @__PURE__ */ jsxs("div", { className: "hero-band relative hidden overflow-hidden lg:block", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "relative flex h-full flex-col justify-between p-12", children: [
        /* @__PURE__ */ jsx(Logo, { light: true }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("h2", { className: "max-w-md text-3xl font-extrabold leading-tight text-white", children: [
            "See every visitor. Score every click. ",
            /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "Protect every campaign." })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-sm text-slate-300", children: "Real-time traffic intelligence, fraud detection and campaign protection for serious media buyers." }),
          /* @__PURE__ */ jsx("div", { className: "mt-8 flex gap-6 text-slate-300", children: [["120M+", "visitors analyzed"], ["<8ms", "avg decision"], ["92.7%", "median quality"]].map(([v, k]) => /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("div", { className: "text-2xl font-extrabold text-white", children: v }),
            /* @__PURE__ */ jsx("div", { className: "text-xs", children: k })
          ] }, k)) })
        ] }),
        /* @__PURE__ */ jsxs("p", { className: "text-xs text-slate-400", children: [
          "© ",
          (/* @__PURE__ */ new Date()).getFullYear(),
          " ",
          BRAND.name
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col bg-bg", children: [
      /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between p-6 lg:hidden", children: /* @__PURE__ */ jsx(Logo, {}) }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-1 items-center justify-center px-6 py-10", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-sm", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: title }),
        /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-sm text-fg-muted", children: subtitle }),
        /* @__PURE__ */ jsx("div", { className: "mt-7", children }),
        footer && /* @__PURE__ */ jsx("div", { className: "mt-6 text-center text-sm text-fg-muted", children: footer }),
        /* @__PURE__ */ jsx("p", { className: "mt-8 text-center text-xs text-fg-dim", children: /* @__PURE__ */ jsx(Link, { to: "/", className: "hover:text-brand", children: "← Back to home" }) })
      ] }) })
    ] })
  ] });
}
export {
  AuthLayout as A
};

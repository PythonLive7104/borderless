import { jsxs, jsx } from "react/jsx-runtime";
const SIZES = { md: "max-w-md", lg: "max-w-lg", xl: "max-w-2xl" };
function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  return /* @__PURE__ */ jsxs("div", { className: "fixed inset-0 z-50 grid place-items-center p-4", children: [
    /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-navy-950/50 backdrop-blur-sm", onClick: onClose }),
    /* @__PURE__ */ jsxs("div", { className: `relative flex max-h-[90vh] w-full ${SIZES[size]} flex-col rounded-2xl border border-line bg-white shadow-xl`, children: [
      /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 items-center justify-between border-b border-line px-6 py-4", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: title }),
        /* @__PURE__ */ jsx("button", { onClick: onClose, className: "rounded-lg p-1.5 text-fg-dim hover:bg-bg-mute", children: /* @__PURE__ */ jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "overflow-y-auto px-6 py-5", children })
    ] })
  ] });
}
export {
  Modal as M
};

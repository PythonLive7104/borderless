import { jsxs, jsx } from "react/jsx-runtime";
import { useState } from "react";
function PageNote({ id, children }) {
  const key = `bl_note_${id}`;
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== "0";
    } catch {
      return true;
    }
  });
  function set(v) {
    try {
      localStorage.setItem(key, v ? "1" : "0");
    } catch {
    }
    setOpen(v);
  }
  const Info = () => /* @__PURE__ */ jsxs("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.4", children: [
    /* @__PURE__ */ jsx("path", { d: "M12 16v-5M12 8h.01" }),
    /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" })
  ] });
  if (!open) {
    return /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => set(true),
        className: "mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10",
        children: [
          /* @__PURE__ */ jsx(Info, {}),
          " Show tip"
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs("div", { className: "mb-5 flex items-start gap-3 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm", children: [
    /* @__PURE__ */ jsx("span", { className: "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand text-white", children: /* @__PURE__ */ jsx(Info, {}) }),
    /* @__PURE__ */ jsx("p", { className: "flex-1 leading-relaxed text-fg", children }),
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => set(false),
        "aria-label": "Hide tip",
        className: "shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-fg-dim hover:bg-white hover:text-fg",
        children: "Hide"
      }
    )
  ] });
}
export {
  PageNote as P
};

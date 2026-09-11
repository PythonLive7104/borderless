import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
function HelpVideo({
  id,
  title,
  minutes
}) {
  const [open, setOpen] = useState(false);
  return /* @__PURE__ */ jsx("div", { className: "mb-4 rounded-xl border border-line bg-bg-mute/40 p-3.5", children: !open ? /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: () => setOpen(true),
      className: "flex w-full items-center gap-3 text-left",
      children: [
        /* @__PURE__ */ jsx("span", { className: "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", className: "h-4 w-4 translate-x-[1px]", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M8 5v14l11-7z" }) }) }),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("span", { className: "block text-sm font-semibold", children: title }),
          /* @__PURE__ */ jsxs("span", { className: "block text-xs text-fg-muted", children: [
            "Watch the walkthrough",
            minutes ? ` — ${minutes}` : ""
          ] })
        ] })
      ]
    }
  ) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between", children: [
      /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold", children: title }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          onClick: () => setOpen(false),
          className: "text-xs font-semibold text-fg-muted hover:text-fg",
          children: "Hide video"
        }
      )
    ] }),
    /* @__PURE__ */ jsx("div", { className: "relative w-full overflow-hidden rounded-lg", style: { paddingTop: "56.25%" }, children: /* @__PURE__ */ jsx(
      "iframe",
      {
        src: `https://www.loom.com/embed/${id}`,
        title,
        allowFullScreen: true,
        className: "absolute inset-0 h-full w-full border-0"
      }
    ) })
  ] }) });
}
export {
  HelpVideo as H
};

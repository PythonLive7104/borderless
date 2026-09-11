import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState } from "react";
function HelpVideo({
  id,
  title,
  minutes
}) {
  const [open, setOpen] = useState(false);
  return /* @__PURE__ */ jsx("div", { className: "mb-5", children: !open ? /* @__PURE__ */ jsxs(
    "button",
    {
      type: "button",
      onClick: () => setOpen(true),
      className: "group flex w-full items-center gap-4 rounded-xl border border-brand/30 bg-brand/5 p-5 text-left transition hover:border-brand/60 hover:bg-brand/10 sm:gap-5 sm:p-6",
      children: [
        /* @__PURE__ */ jsx("span", { className: "cta-glow grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-white transition group-hover:scale-105 sm:h-16 sm:w-16", children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", className: "h-6 w-6 translate-x-[2px] sm:h-7 sm:w-7", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ jsx("path", { d: "M8 5v14l11-7z" }) }) }),
        /* @__PURE__ */ jsxs("span", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("span", { className: "mb-1 inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white", children: "Watch first" }),
          /* @__PURE__ */ jsx("span", { className: "block text-base font-bold leading-snug sm:text-lg", children: title }),
          /* @__PURE__ */ jsxs("span", { className: "block text-sm text-fg-muted", children: [
            "A short walkthrough",
            minutes ? ` — ${minutes}` : "",
            ". Tap to play here."
          ] })
        ] })
      ]
    }
  ) : /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-2 flex items-center justify-between rounded-t-xl", children: [
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

import { jsxs, jsx } from "react/jsx-runtime";
function Pager({ page, pageSize, total, onPage }) {
  if (total <= pageSize) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-medium transition enabled:hover:border-brand enabled:hover:text-brand disabled:opacity-40";
  return /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center justify-between gap-3", children: [
    /* @__PURE__ */ jsxs("span", { className: "text-sm text-fg-muted tabular-nums", children: [
      from.toLocaleString(),
      "–",
      to.toLocaleString(),
      " of ",
      total.toLocaleString()
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("button", { className: btn, disabled: page === 0, onClick: () => onPage(page - 1), children: "Previous" }),
      /* @__PURE__ */ jsxs("span", { className: "text-sm text-fg-dim tabular-nums", children: [
        "Page ",
        page + 1,
        " of ",
        pages
      ] }),
      /* @__PURE__ */ jsx("button", { className: btn, disabled: page + 1 >= pages, onClick: () => onPage(page + 1), children: "Next" })
    ] })
  ] });
}
export {
  Pager as P
};

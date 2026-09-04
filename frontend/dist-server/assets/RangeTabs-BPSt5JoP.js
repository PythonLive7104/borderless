import { jsx } from "react/jsx-runtime";
const RANGES = [["today", "Today"], ["7d", "7d"], ["30d", "30d"], ["90d", "90d"]];
function RangeTabs({ value, onChange }) {
  return /* @__PURE__ */ jsx("div", { className: "inline-flex rounded-xl border border-line bg-white p-0.5", children: RANGES.map(([v, l]) => /* @__PURE__ */ jsx(
    "button",
    {
      onClick: () => onChange(v),
      className: `rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === v ? "bg-brand text-white" : "text-fg-muted hover:text-fg"}`,
      children: l
    },
    v
  )) });
}
export {
  RangeTabs as R
};

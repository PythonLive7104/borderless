import { jsx } from "react/jsx-runtime";
const map = {
  human: "bg-success/10 text-emerald-700",
  suspicious: "bg-warning/10 text-amber-700",
  bot: "bg-orange-100 text-orange-700",
  fraud: "bg-danger/10 text-red-600"
};
function ClassBadge({ value }) {
  return /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${map[value] || "bg-bg-mute text-fg-muted"}`, children: value || "—" });
}
export {
  ClassBadge as C
};

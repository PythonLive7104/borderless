import { jsxs, jsx } from "react/jsx-runtime";
const map = {
  active: { label: "Protected", cls: "bg-success/10 text-emerald-700", dot: "bg-success" },
  waiting: { label: "Waiting for first visitor", cls: "bg-brand/10 text-brand", dot: "bg-brand" },
  idle: { label: "No recent traffic", cls: "bg-warning/10 text-amber-700", dot: "bg-warning" },
  error: { label: "Error", cls: "bg-danger/10 text-red-600", dot: "bg-danger" }
};
function StatusBadge({ status }) {
  const s = map[status] ?? map.waiting;
  return /* @__PURE__ */ jsxs("span", { className: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`, children: [
    /* @__PURE__ */ jsx("span", { className: `h-1.5 w-1.5 rounded-full ${s.dot}` }),
    " ",
    s.label
  ] });
}
export {
  StatusBadge as S
};

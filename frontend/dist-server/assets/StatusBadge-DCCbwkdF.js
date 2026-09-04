import { jsxs, jsx } from "react/jsx-runtime";
const map = {
  active: { label: "Active", cls: "bg-success/10 text-emerald-700", dot: "bg-success" },
  detected: { label: "Detected", cls: "bg-brand/10 text-brand", dot: "bg-brand" },
  not_installed: { label: "Not installed", cls: "bg-bg-mute text-fg-muted", dot: "bg-fg-dim" },
  error: { label: "Error", cls: "bg-danger/10 text-red-600", dot: "bg-danger" }
};
function StatusBadge({ status }) {
  const s = map[status];
  return /* @__PURE__ */ jsxs("span", { className: `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`, children: [
    /* @__PURE__ */ jsx("span", { className: `h-1.5 w-1.5 rounded-full ${s.dot}` }),
    " ",
    s.label
  ] });
}
export {
  StatusBadge as S
};

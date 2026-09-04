import { jsxs, jsx } from "react/jsx-runtime";
function StatCard({ label, value, sub, tone }) {
  const bar = { brand: "bg-brand", green: "bg-success", amber: "bg-warning", red: "bg-danger" };
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft relative overflow-hidden p-5", children: [
    tone && /* @__PURE__ */ jsx("span", { className: `absolute left-0 top-0 h-full w-1 ${bar[tone]}` }),
    /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: label }),
    /* @__PURE__ */ jsx("div", { className: "mt-2 text-2xl font-extrabold tracking-tight", children: value }),
    sub && /* @__PURE__ */ jsx("div", { className: "mt-1 text-xs text-fg-dim", children: sub })
  ] });
}
export {
  StatCard as S
};

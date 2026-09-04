import { jsx } from "react/jsx-runtime";
function NoData({ msg = "No data for this range yet." }) {
  return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16 text-sm text-fg-muted", children: msg });
}
export {
  NoData as N
};

import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { x as websiteApi } from "../entry-server.js";
function WebsitePicker({ orgId, value, onChange, onMulti }) {
  const [sites, setSites] = useState([]);
  useEffect(() => {
    let alive = true;
    websiteApi.list(orgId).then((r) => {
      if (alive) {
        setSites(r.results);
        onMulti == null ? void 0 : onMulti(r.results.length > 1);
      }
    }).catch(() => {
    });
    return () => {
      alive = false;
    };
  }, [orgId]);
  if (sites.length < 2) return null;
  return /* @__PURE__ */ jsxs(
    "select",
    {
      value,
      onChange: (e) => onChange(e.target.value),
      "aria-label": "Filter by website",
      className: "rounded-xl border border-line bg-white px-3 py-2 text-sm",
      children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All websites" }),
        sites.map((s) => /* @__PURE__ */ jsx("option", { value: s.id, children: s.name || s.domain }, s.id))
      ]
    }
  );
}
export {
  WebsitePicker as W
};

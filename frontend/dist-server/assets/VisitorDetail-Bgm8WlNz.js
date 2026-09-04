import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { useParams, Link } from "react-router-dom";
import { x as analyticsApi } from "../entry-server.js";
import { C as ClassBadge } from "./ClassBadge-B1OvS151.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function VisitorDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  useEffect(() => {
    analyticsApi.visitor(Number(id)).then(setData);
  }, [id]);
  if (!data) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  const v = data.visitor;
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(PageNote, { id: "visitor-detail", children: "Everything we know about one visitor and every action they took on your site." }),
    /* @__PURE__ */ jsx(Link, { to: "/dashboard/visitors", className: "text-sm text-fg-muted hover:text-brand", children: "← Visitors" }),
    /* @__PURE__ */ jsx("h1", { className: "mt-3 font-mono text-2xl font-extrabold tracking-tight", children: v.visitor_id.slice(0, 20) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-5 lg:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6 lg:col-span-1", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Profile" }),
        /* @__PURE__ */ jsx("dl", { className: "mt-4 space-y-3 text-sm", children: [
          ["IP", v.ip || "—"],
          ["Country", v.country || "—"],
          ["Device", v.device || "—"],
          ["Browser", v.browser || "—"],
          ["OS", v.os || "—"],
          ["Fingerprint", v.fingerprint || "—"],
          ["Sessions", String(data.sessions)],
          ["Events", String(v.events)],
          ["Max risk", v.max_risk ?? "—"],
          ["First seen", new Date(v.first_seen).toLocaleString()],
          ["Last seen", new Date(v.last_seen).toLocaleString()]
        ].map(([k, val]) => /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-3", children: [
          /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: k }),
          /* @__PURE__ */ jsx("dd", { className: "text-right capitalize", children: val })
        ] }, k)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6 lg:col-span-2", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Event timeline" }),
        /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-2", children: data.events.map((e) => {
          var _a;
          return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-xl border border-line px-4 py-2.5 text-sm", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: "rounded-md bg-bg-mute px-2 py-0.5 text-xs font-semibold capitalize", children: e.type }),
              /* @__PURE__ */ jsx("span", { className: "truncate text-fg-muted", style: { maxWidth: 220 }, children: e.url || "—" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              e.ja3 && /* @__PURE__ */ jsx("span", { title: `TLS/JA3: ${e.ja3}`, className: "hidden rounded bg-bg-mute px-1.5 py-0.5 font-mono text-[10px] text-fg-dim md:inline", children: "JA3" }),
              (_a = e.fp_signals) == null ? void 0 : _a.slice(0, 2).map((s) => /* @__PURE__ */ jsx("span", { className: "hidden rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-600 sm:inline", children: s }, s)),
              /* @__PURE__ */ jsx(ClassBadge, { value: e.classification }),
              /* @__PURE__ */ jsxs("span", { className: "font-mono text-xs text-fg-dim", children: [
                "risk ",
                e.risk_score ?? "—"
              ] }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: new Date(e.created_at).toLocaleTimeString() })
            ] })
          ] }, e.id);
        }) })
      ] })
    ] })
  ] });
}
export {
  VisitorDetail as default
};

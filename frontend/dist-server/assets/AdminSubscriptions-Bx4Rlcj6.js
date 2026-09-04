import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { d as billingApi, Q as adminApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
const statusTone = {
  trialing: "bg-brand/10 text-brand",
  active: "bg-success/10 text-emerald-700",
  canceled: "bg-danger/10 text-red-600"
};
function AdminSubscriptions() {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  async function load() {
    setRows(await adminApi.subscriptions());
  }
  useEffect(() => {
    load();
    billingApi.plans().then(setPlans);
  }, []);
  const mrr = rows.filter((r) => r.status === "active").reduce((a, r) => a + r.price, 0);
  async function grant(orgId, slug) {
    setBusy(orgId);
    setNote(null);
    try {
      const res = await adminApi.grantPlan(orgId, slug);
      await load();
      setNote({ id: orgId, text: res.detail });
    } catch {
      setNote({ id: orgId, text: "Failed to grant plan." });
    } finally {
      setBusy(null);
    }
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Subscriptions" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
      rows.length,
      " subscriptions · ",
      /* @__PURE__ */ jsxs("b", { children: [
        "$",
        mrr.toLocaleString(),
        "/mo"
      ] }),
      " from active plans. Use ",
      /* @__PURE__ */ jsx("b", { children: "Grant plan" }),
      " to put any workspace on any plan instantly (no payment)."
    ] }),
    /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Workspace" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Owner" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Plan" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Price" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Status" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Access" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Trial ends" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Grant plan" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((s) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold", children: s.organization }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: s.owner }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: s.plan }),
        /* @__PURE__ */ jsxs("td", { className: "px-4 py-3 tabular-nums", children: [
          "$",
          s.price
        ] }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusTone[s.status] || "bg-bg-mute"}`, children: s.status }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: s.locked ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600", children: "locked" }) : /* @__PURE__ */ jsx("span", { className: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700", children: "active" }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: s.trial_end ? new Date(s.trial_end).toLocaleDateString() : "—" }),
        /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxs(
              "select",
              {
                className: "rounded-lg border border-line bg-bg px-2 py-1 text-xs",
                disabled: busy === s.organization_id,
                defaultValue: "",
                onChange: (e) => {
                  const v = e.target.value;
                  if (v) grant(s.organization_id, v);
                  e.target.value = "";
                },
                children: [
                  /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Set plan…" }),
                  plans.map((p) => /* @__PURE__ */ jsxs("option", { value: p.slug, children: [
                    p.name,
                    " — $",
                    p.price,
                    "/mo"
                  ] }, p.slug))
                ]
              }
            ),
            busy === s.organization_id && /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "saving…" })
          ] }),
          (note == null ? void 0 : note.id) === s.organization_id && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-emerald-700", children: note.text })
        ] })
      ] }, s.id)) })
    ] }) }) })
  ] });
}
export {
  AdminSubscriptions as default
};

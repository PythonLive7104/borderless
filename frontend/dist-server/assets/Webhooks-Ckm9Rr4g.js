import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { c as useWorkspace, B as Button, l as webhookApi } from "../entry-server.js";
import { M as Modal } from "./Modal-Ci-VAi9_.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function Webhooks() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [sel, setSel] = useState([]);
  const [err, setErr] = useState("");
  const [deliv, setDeliv] = useState(null);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [w, e] = await Promise.all([webhookApi.list(current.id), webhookApi.events()]);
      setRows(w.results);
      setEvents(e.events);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  const toggle = (ev) => setSel((s) => s.includes(ev) ? s.filter((x) => x !== ev) : [...s, ev]);
  async function create(e) {
    var _a, _b, _c, _d, _e;
    e.preventDefault();
    setErr("");
    try {
      await webhookApi.create({ organization: current.id, url, events: sel });
      setOpen(false);
      setUrl("");
      setSel([]);
      load();
    } catch (e2) {
      setErr(((_b = (_a = e2.data) == null ? void 0 : _a.url) == null ? void 0 : _b[0]) || ((_d = (_c = e2.data) == null ? void 0 : _c.events) == null ? void 0 : _d[0]) || ((_e = e2.data) == null ? void 0 : _e.detail) || e2.message);
    }
  }
  async function test(id) {
    await webhookApi.test(id);
    alert("Test delivery sent — check the deliveries log.");
  }
  async function showDeliveries(id) {
    setDeliv({ id, rows: await webhookApi.deliveries(id) });
  }
  async function remove(id) {
    if (!confirm("Delete this webhook?")) return;
    await webhookApi.remove(id);
    load();
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "webhooks", children: [
      "A webhook lets TrackAudit ",
      /* @__PURE__ */ jsx("b", { children: "notify your systems automatically" }),
      " when something happens — like a bot being caught or a sale being made. Enter a web address to send notifications to, and pick which events you care about."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Webhooks" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Get notified when events happen. Deliveries are signed and retried." })
      ] }),
      canManage && /* @__PURE__ */ jsx(Button, { onClick: () => setOpen(true), children: "+ Add webhook" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rows.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-10 text-center", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "No webhooks" }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-sm text-sm text-fg-muted", children: "Add a webhook to receive event notifications." })
    ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 space-y-3", children: rows.map((w) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [
        /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsx("div", { className: "truncate font-mono text-sm font-semibold", children: w.url }),
          /* @__PURE__ */ jsx("div", { className: "mt-1 flex flex-wrap gap-1.5", children: w.events.map((e) => /* @__PURE__ */ jsx("span", { className: "rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand", children: e }, e)) })
        ] }),
        canManage && /* @__PURE__ */ jsxs("div", { className: "flex gap-2 text-sm", children: [
          /* @__PURE__ */ jsx("button", { onClick: () => showDeliveries(w.id), className: "rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-brand/40", children: "Deliveries" }),
          /* @__PURE__ */ jsx("button", { onClick: () => test(w.id), className: "rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-brand/40", children: "Test" }),
          /* @__PURE__ */ jsx("button", { onClick: () => remove(w.id), className: "rounded-lg border border-danger/30 px-3 py-1.5 font-semibold text-red-600 hover:bg-danger/5", children: "Delete" })
        ] })
      ] }),
      (deliv == null ? void 0 : deliv.id) === w.id && /* @__PURE__ */ jsxs("div", { className: "mt-4 border-t border-line pt-3", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "Recent deliveries" }),
        deliv.rows.length === 0 ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-fg-muted", children: "None yet." }) : /* @__PURE__ */ jsx("div", { className: "mt-2 space-y-1", children: deliv.rows.map((d) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-xs", children: [
          /* @__PURE__ */ jsx("span", { children: d.event }),
          /* @__PURE__ */ jsxs("span", { className: d.success ? "text-emerald-700" : "text-red-600", children: [
            d.success ? "✓" : "✗",
            " ",
            d.status_code ?? "—",
            " · ",
            d.attempts,
            " attempt",
            d.attempts > 1 ? "s" : "",
            " · ",
            new Date(d.created_at).toLocaleTimeString()
          ] })
        ] }, d.id)) })
      ] })
    ] }, w.id)) }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: "Add webhook", children: /* @__PURE__ */ jsxs("form", { onSubmit: create, className: "space-y-4", children: [
      /* @__PURE__ */ jsx(Field, { label: "Endpoint URL", value: url, onChange: setUrl, placeholder: "https://yourapp.com/webhooks/borderless" }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("span", { className: "mb-2 block text-sm font-semibold", children: "Events" }),
        /* @__PURE__ */ jsx("div", { className: "space-y-2", children: events.map((ev) => /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2.5 text-sm", children: [
          /* @__PURE__ */ jsx("input", { type: "checkbox", checked: sel.includes(ev), onChange: () => toggle(ev), className: "h-4 w-4 accent-brand" }),
          /* @__PURE__ */ jsx("code", { className: "text-xs", children: ev })
        ] }, ev)) })
      ] }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: "Create webhook" })
    ] }) })
  ] });
}
export {
  Webhooks as default
};

import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { c as useWorkspace, B as Button, k as keysApi } from "../entry-server.js";
import { M as Modal } from "./Modal-Ci-VAi9_.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
import "react-router-dom";
function ApiKeys() {
  const { current } = useWorkspace();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      setKeys((await keysApi.list(current.id)).results);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  async function create(e) {
    e.preventDefault();
    const res = await keysApi.create(current.id, name || "API key");
    setCreated(res.key);
    setName("");
    load();
  }
  async function revoke(id) {
    if (!confirm("Revoke this key? Apps using it will stop working.")) return;
    await keysApi.revoke(id);
    load();
  }
  function copy() {
    var _a;
    (_a = navigator.clipboard) == null ? void 0 : _a.writeText(created);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "api-keys", children: [
      "API keys let your own systems talk to TrackAudit securely — for example, to record a sale from your server. Create a key, copy it ",
      /* @__PURE__ */ jsx("b", { children: "once" }),
      " (we never show it again), and keep it secret like a password."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "API Keys" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Authenticate server-side requests to the TrackAudit API." })
      ] }),
      canManage && /* @__PURE__ */ jsx(Button, { onClick: () => {
        setCreated(null);
        setOpen(true);
      }, children: "+ Create key" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : keys.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-10 text-center", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "No API keys" }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-sm text-sm text-fg-muted", children: "Create a key to start using the REST API." })
    ] }) : /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Name" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Key" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Last used" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Status" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: keys.map((k) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-semibold", children: k.name }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsxs("code", { className: "rounded bg-bg-mute px-2 py-0.5", children: [
          k.prefix,
          "••••••"
        ] }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: k.last_used ? new Date(k.last_used).toLocaleString() : "Never" }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: k.revoked ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600", children: "Revoked" }) : /* @__PURE__ */ jsx("span", { className: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700", children: "Active" }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-right", children: canManage && !k.revoked && /* @__PURE__ */ jsx("button", { onClick: () => revoke(k.id), className: "text-sm text-red-500 hover:underline", children: "Revoke" }) })
      ] }, k.id)) })
    ] }) }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: created ? "Copy your API key" : "Create API key", children: created ? /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
      /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-amber-700", children: "Copy this now — for your security, it won't be shown again." }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-line bg-bg-soft p-3", children: [
        /* @__PURE__ */ jsx("code", { className: "flex-1 break-all text-xs", children: created }),
        /* @__PURE__ */ jsx("button", { onClick: copy, className: "rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white", children: copied ? "Copied ✓" : "Copy" })
      ] }),
      /* @__PURE__ */ jsx(Button, { onClick: () => setOpen(false), className: "w-full", children: "Done" })
    ] }) : /* @__PURE__ */ jsxs("form", { onSubmit: create, className: "space-y-4", children: [
      /* @__PURE__ */ jsx(Field, { label: "Key name", value: name, onChange: setName, placeholder: "Production server" }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: "Create key" })
    ] }) })
  ] });
}
export {
  ApiKeys as default
};

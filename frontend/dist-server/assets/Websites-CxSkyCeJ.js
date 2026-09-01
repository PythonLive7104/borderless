import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, B as Button, w as websiteApi } from "../entry-server.js";
import { M as Modal } from "./Modal-Ci-VAi9_.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import { S as StatusBadge } from "./StatusBadge-DCCbwkdF.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function Websites() {
  const { current } = useWorkspace();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", domain: "", url: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      setSites((await websiteApi.list(current.id)).results);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  async function create(e) {
    var _a;
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await websiteApi.create({ organization: current.id, ...form });
      setOpen(false);
      setForm({ name: "", domain: "", url: "" });
      load();
    } catch (e2) {
      setErr(((_a = e2.data) == null ? void 0 : _a.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!confirm("Delete this website? Tracking will stop.")) return;
    await websiteApi.remove(id);
    load();
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "websites", children: [
      "Add every website you want to protect here. Each one gives you a small code snippet to paste into your site — once it's in, we start checking your visitors. ",
      /* @__PURE__ */ jsx("b", { children: "Add a website, then open it to get the snippet." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Websites" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          "Sites you're tracking in ",
          current == null ? void 0 : current.name,
          "."
        ] })
      ] }),
      canManage && /* @__PURE__ */ jsx(Button, { onClick: () => setOpen(true), children: "+ Add website" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "mt-8 grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : sites.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-10 text-center", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "No websites yet" }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-sm text-sm text-fg-muted", children: "Add your first website to get a tracking ID and installation snippet." }),
      canManage && /* @__PURE__ */ jsx(Button, { className: "mt-4", onClick: () => setOpen(true), children: "+ Add website" })
    ] }) : /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4 sm:grid-cols-2", children: sites.map((s) => /* @__PURE__ */ jsxs("div", { className: "card card-hover shadow-soft p-5", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(Link, { to: `/dashboard/websites/${s.id}`, className: "text-base font-bold hover:text-brand", children: s.name }),
          /* @__PURE__ */ jsx("div", { className: "text-sm text-fg-muted", children: s.domain })
        ] }),
        /* @__PURE__ */ jsx(StatusBadge, { status: s.status })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center justify-between", children: [
        /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-2 py-1 text-xs text-fg-muted", children: s.tracking_id }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(Link, { to: `/dashboard/websites/${s.id}`, className: "text-sm font-semibold text-brand hover:underline", children: "Install" }),
          canManage && /* @__PURE__ */ jsx("button", { onClick: () => remove(s.id), className: "text-sm text-red-500 hover:underline", children: "Delete" })
        ] })
      ] })
    ] }, s.id)) }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: "Add website", children: /* @__PURE__ */ jsxs("form", { onSubmit: create, className: "space-y-4", children: [
      /* @__PURE__ */ jsx(Field, { label: "Website name", value: form.name, onChange: (v) => setForm({ ...form, name: v }), placeholder: "Acme Store" }),
      /* @__PURE__ */ jsx(Field, { label: "Domain", value: form.domain, onChange: (v) => setForm({ ...form, domain: v }), placeholder: "acme.com" }),
      /* @__PURE__ */ jsx(Field, { label: "Full URL (optional)", value: form.url, onChange: (v) => setForm({ ...form, url: v }), placeholder: "https://acme.com", required: false }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: busy ? "Adding…" : "Add website" })
    ] }) })
  ] });
}
export {
  Websites as default
};

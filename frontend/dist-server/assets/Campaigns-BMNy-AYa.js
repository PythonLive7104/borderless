import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, B as Button, z as campaignApi, y as websiteApi, d as billingApi } from "../entry-server.js";
import { M as Modal } from "./Modal-CEHlixCW.js";
import { F as Field } from "./Field-Cq1XQP8x.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const SOURCES = ["facebook", "google", "tiktok", "bing", "native", "organic", "direct", "other"];
function Campaigns() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ website: "", name: "", destination_url: "", traffic_source: "facebook", utm_campaign: "", risk_threshold: "70" });
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  const [usage, setUsage] = useState(null);
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const [c, w] = await Promise.all([campaignApi.list(current.id), websiteApi.list(current.id)]);
      setRows(c.results);
      setSites(w.results);
    } finally {
      setLoading(false);
    }
    billingApi.usage(current.id).then(setUsage).catch(() => {
    });
  }
  useEffect(() => {
    load();
  }, [current == null ? void 0 : current.id]);
  async function create(e) {
    var _a, _b, _c;
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await campaignApi.create({
        website: Number(f.website),
        name: f.name,
        destination_url: f.destination_url,
        traffic_source: f.traffic_source,
        utm_campaign: f.utm_campaign,
        risk_threshold: Number(f.risk_threshold)
      });
      setOpen(false);
      setF({ website: "", name: "", destination_url: "", traffic_source: "facebook", utm_campaign: "", risk_threshold: "70" });
      load();
    } catch (e2) {
      setErr(((_b = (_a = e2.data) == null ? void 0 : _a.website) == null ? void 0 : _b[0]) || ((_c = e2.data) == null ? void 0 : _c.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  }
  function openModal() {
    setF((p) => {
      var _a;
      return { ...p, website: ((_a = sites[0]) == null ? void 0 : _a.id) ? String(sites[0].id) : "" };
    });
    setOpen(true);
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "campaigns", children: [
      "A ",
      /* @__PURE__ */ jsx("b", { children: "campaign" }),
      " is one ad effort, like “Summer Sale on Facebook”. Create one per ad so you can see which ads bring real customers and which bring bots. Tip: put the same ",
      /* @__PURE__ */ jsx("b", { children: "UTM campaign" }),
      " name you use in your ad links."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Campaigns" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          "Organize and monitor your traffic in ",
          current == null ? void 0 : current.name,
          ".",
          usage && /* @__PURE__ */ jsxs("span", { className: "ml-1 font-semibold text-fg", children: [
            usage.campaigns.used,
            usage.campaigns.limit ? ` of ${usage.campaigns.limit}` : "",
            " used",
            usage.campaigns.limit ? usage.on_trial ? " on your trial" : " on your plan" : "",
            "."
          ] })
        ] })
      ] }),
      canManage && /* @__PURE__ */ jsx(Button, { onClick: openModal, children: "+ New campaign" })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rows.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-10 text-center", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "No campaigns yet" }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-sm text-sm text-fg-muted", children: "Create your first campaign to start organizing and scoring traffic." }),
      canManage && sites.length > 0 && /* @__PURE__ */ jsx(Button, { className: "mt-4", onClick: openModal, children: "+ New campaign" }),
      canManage && sites.length === 0 && /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm text-amber-700", children: "Add a website first." })
    ] }) : /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-6 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Campaign" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Website" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Source" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Threshold" }),
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Status" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((c) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(Link, { to: `/dashboard/campaigns/${c.id}`, className: "font-semibold hover:text-brand", children: c.name }) }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: c.website_name }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: c.traffic_source }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: c.risk_threshold }),
        /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-success/10 text-emerald-700" : "bg-bg-mute text-fg-muted"}`, children: c.status }) })
      ] }, c.id)) })
    ] }) }) }),
    /* @__PURE__ */ jsx(Modal, { open, onClose: () => setOpen(false), title: "New campaign", children: /* @__PURE__ */ jsxs("form", { onSubmit: create, className: "space-y-4", children: [
      /* @__PURE__ */ jsxs("label", { className: "block", children: [
        /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Website" }),
        /* @__PURE__ */ jsx(
          "select",
          {
            value: f.website,
            onChange: (e) => setF({ ...f, website: e.target.value }),
            required: true,
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
            children: sites.map((s) => /* @__PURE__ */ jsxs("option", { value: s.id, children: [
              s.name,
              " (",
              s.domain,
              ")"
            ] }, s.id))
          }
        )
      ] }),
      /* @__PURE__ */ jsx(Field, { label: "Campaign name", value: f.name, onChange: (v) => setF({ ...f, name: v }), placeholder: "Summer Sale" }),
      /* @__PURE__ */ jsx(Field, { label: "Destination URL", value: f.destination_url, onChange: (v) => setF({ ...f, destination_url: v }), placeholder: "https://shop.com/summer", required: false }),
      /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsxs("label", { className: "block", children: [
          /* @__PURE__ */ jsx("span", { className: "mb-1.5 block text-sm font-semibold", children: "Traffic source" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: f.traffic_source,
              onChange: (e) => setF({ ...f, traffic_source: e.target.value }),
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm capitalize outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
              children: SOURCES.map((s) => /* @__PURE__ */ jsx("option", { value: s, children: s }, s))
            }
          )
        ] }),
        /* @__PURE__ */ jsx(Field, { label: "Risk threshold", type: "number", value: f.risk_threshold, onChange: (v) => setF({ ...f, risk_threshold: v }) })
      ] }),
      /* @__PURE__ */ jsx(Field, { label: "UTM campaign (for attribution)", value: f.utm_campaign, onChange: (v) => setF({ ...f, utm_campaign: v }), placeholder: "summer", required: false }),
      err && /* @__PURE__ */ jsx("div", { className: "rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: busy ? "Creating…" : "Create campaign" })
    ] }) })
  ] });
}
export {
  Campaigns as default
};

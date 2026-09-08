import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, A as useDialog, E as ipFilterApi, z as analyticsApi } from "../entry-server.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { W as WebsitePicker } from "./WebsitePicker-Bej3wDvm.js";
import { P as Pager } from "./Pager-Dnb3DgGO.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const PAGE_SIZE = 25;
const riskTone = (r) => r == null ? "text-fg-dim" : r >= 85 ? "text-red-600" : r >= 70 ? "text-orange-600" : r >= 40 ? "text-amber-600" : "text-emerald-600";
function Visitors() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState("");
  const [website, setWebsite] = useState("");
  const [busyIp, setBusyIp] = useState(null);
  const { confirm, notify } = useDialog();
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function setIpRule(v, kind) {
    var _a;
    if (!v.ip || !current) return;
    if (kind === "deny" && !await confirm({
      title: `Block ${v.ip}?`,
      message: "Every visit from this address is refused straight away, across every website in this workspace.",
      confirmLabel: "Block this IP"
    })) return;
    setBusyIp(v.ip);
    try {
      if (v.ip_rule) await ipFilterApi.remove(v.ip_rule.id);
      await ipFilterApi.create({
        organization: current.id,
        value: v.ip,
        kind,
        note: `Added from Visitors · ${v.country || "unknown"}`
      });
      notify(kind === "deny" ? `${v.ip} is now blocked.` : `${v.ip} is now always allowed.`);
      load();
    } catch (e) {
      notify(((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.detail) || "Could not update that IP rule.", "danger");
    } finally {
      setBusyIp(null);
    }
  }
  async function clearIpRule(v) {
    if (!v.ip_rule) return;
    setBusyIp(v.ip);
    try {
      await ipFilterApi.remove(v.ip_rule.id);
      notify(`${v.ip} follows the normal rules again.`);
      load();
    } finally {
      setBusyIp(null);
    }
  }
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  async function load() {
    if (!current) return;
    setLoading(true);
    try {
      const res = await analyticsApi.visitors(current.id, { search, device, website, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      setRows(res.results);
      setTotal(res.count);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setPage(0);
  }, [search, device, website]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [current == null ? void 0 : current.id, search, device, website, page]);
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "visitors", children: [
      "Everyone who visits your sites appears here with a ",
      /* @__PURE__ */ jsx("b", { children: "risk score" }),
      ". Low means likely a real person; high means likely a bot. Click any visitor to see everything they did."
    ] }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Visitors" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
      "Every visitor analyzed in ",
      current == null ? void 0 : current.name,
      "."
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          value: search,
          onChange: (e) => setSearch(e.target.value),
          placeholder: "Search visitor ID or IP…",
          className: "w-64 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand"
        }
      ),
      current && /* @__PURE__ */ jsx(WebsitePicker, { orgId: current.id, value: website, onChange: setWebsite }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: device,
          onChange: (e) => setDevice(e.target.value),
          className: "rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand",
          children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All devices" }),
            /* @__PURE__ */ jsx("option", { value: "mobile", children: "Mobile" }),
            /* @__PURE__ */ jsx("option", { value: "desktop", children: "Desktop" }),
            /* @__PURE__ */ jsx("option", { value: "tablet", children: "Tablet" })
          ]
        }
      )
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-16", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) }) : rows.length === 0 ? /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-5", children: /* @__PURE__ */ jsx(NoData, { msg: "No visitors match." }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "card shadow-soft mt-5 overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsx("thead", { className: "border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim", children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Visitor" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "IP" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Country" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Device" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Browser / OS" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Events" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Max risk" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Last seen" }),
          canManage && /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "IP rule" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((v) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: /* @__PURE__ */ jsx(Link, { to: `/dashboard/visitors/${v.id}`, className: "font-mono font-semibold hover:text-brand", children: v.visitor_id.slice(0, 14) }) }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 font-mono text-xs", children: v.ip || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: v.country || "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 capitalize", children: v.device || "—" }),
          /* @__PURE__ */ jsxs("td", { className: "px-4 py-3 text-fg-muted", children: [
            v.browser,
            " · ",
            v.os
          ] }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: v.events }),
          /* @__PURE__ */ jsx("td", { className: `px-4 py-3 font-bold ${riskTone(v.max_risk)}`, children: v.max_risk ?? "—" }),
          /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-fg-muted", children: new Date(v.last_seen).toLocaleString() }),
          canManage && /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: !v.ip ? /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "—" }) : busyIp === v.ip ? /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "saving…" }) : v.ip_rule ? /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-xs font-semibold ${v.ip_rule.kind === "deny" ? "bg-danger/10 text-red-600" : "bg-success/10 text-emerald-700"}`, children: v.ip_rule.kind === "deny" ? "Blocked" : "Always allowed" }),
            v.ip_rule.value !== v.ip && /* @__PURE__ */ jsxs("span", { className: "font-mono text-[11px] text-fg-dim", children: [
              "via ",
              v.ip_rule.value
            ] }),
            /* @__PURE__ */ jsx("button", { onClick: () => clearIpRule(v), className: "text-xs text-fg-dim hover:text-fg hover:underline", children: "Clear" })
          ] }) : /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("button", { onClick: () => setIpRule(v, "deny"), className: "text-xs font-semibold text-red-500 hover:underline", children: "Block" }),
            /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "·" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setIpRule(v, "allow"), className: "text-xs font-semibold text-emerald-600 hover:underline", children: "Allow" })
          ] }) })
        ] }, v.id)) })
      ] }) }) }),
      /* @__PURE__ */ jsx(Pager, { page, pageSize: PAGE_SIZE, total, onPage: setPage })
    ] })
  ] });
}
export {
  Visitors as default
};

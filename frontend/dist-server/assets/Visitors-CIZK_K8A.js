import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { c as useWorkspace, d as useDialog, A as analyticsApi, E as ipFilterApi } from "../entry-server.js";
import { N as NoData } from "./NoData-fWp_o2IY.js";
import { W as WebsitePicker } from "./WebsitePicker-BhUQYD8k.js";
import { P as Pager } from "./Pager-Dnb3DgGO.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function IpRuleToggle({ value, busy, onChange }) {
  const seg = (key, label, active) => {
    const on = value === key;
    return /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        disabled: busy,
        "aria-pressed": on,
        onClick: () => onChange(on ? null : key),
        className: `px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${on ? active : "text-fg-dim hover:bg-bg-mute hover:text-fg"}`,
        children: label
      },
      label
    );
  };
  return /* @__PURE__ */ jsxs(
    "span",
    {
      className: `inline-flex overflow-hidden rounded-full border border-line bg-white ${busy ? "opacity-60" : ""}`,
      role: "group",
      "aria-label": "IP rule",
      children: [
        seg("deny", "Block", "bg-danger text-white"),
        /* @__PURE__ */ jsx("span", { className: "w-px bg-line", "aria-hidden": "true" }),
        seg(null, "Auto", "bg-bg-mute text-fg"),
        /* @__PURE__ */ jsx("span", { className: "w-px bg-line", "aria-hidden": "true" }),
        seg("allow", "Allow", "bg-success text-white")
      ]
    }
  );
}
const PAGE_SIZE = 25;
function flag(cc) {
  if (!cc || cc.length !== 2 || !/^[a-zA-Z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 127462 + c.charCodeAt(0) - 65));
}
function riskMeta(r) {
  if (r == null) return { label: "—", cls: "bg-bg-mute text-fg-dim" };
  if (r >= 85) return { label: "Fraud", cls: "bg-danger/10 text-red-600" };
  if (r >= 70) return { label: "Bot", cls: "bg-orange-500/10 text-orange-600" };
  if (r >= 40) return { label: "Suspicious", cls: "bg-warning/10 text-amber-700" };
  return { label: "Clean", cls: "bg-success/10 text-emerald-700" };
}
const DEVICE_ICON = { mobile: "📱", desktop: "🖥️", tablet: "📟" };
function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function Visitors() {
  const { current } = useWorkspace();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [device, setDevice] = useState("");
  const [website, setWebsite] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busyIp, setBusyIp] = useState(null);
  const { confirm, notify } = useDialog();
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
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
  async function changeIpRule(v, next) {
    var _a;
    if (!v.ip || !current) return;
    if (next === "deny" && !await confirm({
      title: `Block ${v.ip}?`,
      message: "Every visit from this address is refused straight away, across every website in this workspace.",
      confirmLabel: "Block this IP"
    })) return;
    setBusyIp(v.ip);
    try {
      if (v.ip_rule) await ipFilterApi.remove(v.ip_rule.id);
      if (next) {
        await ipFilterApi.create({
          organization: current.id,
          value: v.ip,
          kind: next,
          note: `Added from Visitors · ${v.country || "unknown"}`
        });
      }
      notify(next === "deny" ? `${v.ip} is now blocked.` : next === "allow" ? `${v.ip} is now always allowed.` : `${v.ip} follows the normal rules again.`);
      load();
    } catch (e) {
      notify(((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.detail) || "Could not update that IP rule.", "danger");
    } finally {
      setBusyIp(null);
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
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Location" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Client" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-right", children: "Events" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Risk" }),
          /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "Last seen" }),
          canManage && /* @__PURE__ */ jsx("th", { className: "px-4 py-3", children: "IP rule" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { className: "divide-y divide-line", children: rows.map((v) => {
          var _a;
          return /* @__PURE__ */ jsxs("tr", { className: "hover:bg-bg-soft", children: [
            /* @__PURE__ */ jsxs("td", { className: "px-4 py-3", children: [
              /* @__PURE__ */ jsx(Link, { to: `/dashboard/visitors/${v.id}`, className: "block max-w-[200px] truncate font-mono text-[13px] font-semibold text-brand hover:underline", title: v.ip || v.visitor_id, children: v.ip || "unknown IP" }),
              /* @__PURE__ */ jsx("span", { className: "font-mono text-[11px] text-fg-dim", children: v.visitor_id.slice(0, 12) })
            ] }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 whitespace-nowrap", children: v.country ? /* @__PURE__ */ jsxs("span", { children: [
              flag(v.country),
              " ",
              v.country
            ] }) : /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "—" }) }),
            /* @__PURE__ */ jsxs("td", { className: "px-4 py-3 whitespace-nowrap text-fg-muted", children: [
              /* @__PURE__ */ jsx("span", { className: "mr-1", children: DEVICE_ICON[v.device] || "•" }),
              v.browser || "Other",
              " · ",
              v.os || "Other"
            ] }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 text-right tabular-nums", children: v.events }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: (() => {
              const m = riskMeta(v.max_risk);
              return /* @__PURE__ */ jsxs("span", { className: `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${m.cls}`, children: [
                v.max_risk ?? "—",
                /* @__PURE__ */ jsx("span", { className: "opacity-70", children: "·" }),
                m.label
              ] });
            })() }),
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 whitespace-nowrap text-fg-muted", title: new Date(v.last_seen).toLocaleString(), children: timeAgo(v.last_seen) }),
            canManage && /* @__PURE__ */ jsx("td", { className: "px-4 py-3", children: !v.ip ? /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "—" }) : /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx(
                IpRuleToggle,
                {
                  value: ((_a = v.ip_rule) == null ? void 0 : _a.kind) ?? null,
                  busy: busyIp === v.ip,
                  onChange: (next) => changeIpRule(v, next)
                }
              ),
              v.ip_rule && v.ip_rule.value !== v.ip && /* @__PURE__ */ jsxs("span", { className: "font-mono text-[11px] text-fg-dim", children: [
                "via ",
                v.ip_rule.value
              ] })
            ] }) })
          ] }, v.id);
        }) })
      ] }) }) }),
      /* @__PURE__ */ jsx(Pager, { page, pageSize: PAGE_SIZE, total, onPage: setPage })
    ] })
  ] });
}
export {
  Visitors as default
};

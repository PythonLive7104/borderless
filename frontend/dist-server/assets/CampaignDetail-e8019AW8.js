import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { A as useDialog, B as Button, D as variantApi, C as campaignApi, c as useWorkspace } from "../entry-server.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { C as ClassBadge } from "./ClassBadge-B1OvS151.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function CampaignVariants({ campaignId, canManage }) {
  const { confirm } = useDialog();
  const [variants, setVariants] = useState([]);
  const [stats, setStats] = useState(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [weight, setWeight] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function load() {
    const [v, s] = await Promise.all([
      variantApi.list(campaignId),
      campaignApi.variantStats(campaignId)
    ]);
    setVariants(v.results);
    setStats(s);
  }
  useEffect(() => {
    load();
  }, [campaignId]);
  const totalWeight = variants.filter((v) => v.active && v.weight > 0).reduce((a, v) => a + v.weight, 0) || 1;
  const statById = Object.fromEntries(((stats == null ? void 0 : stats.variants) || []).map((r) => [r.id, r]));
  async function add() {
    setErr("");
    if (!label.trim() || !url.trim()) {
      setErr("Give the variant a name and a destination URL.");
      return;
    }
    setBusy(true);
    try {
      await variantApi.create({ campaign: campaignId, label, destination_url: url, weight });
      setLabel("");
      setUrl("");
      setWeight(50);
      setAdding(false);
      await load();
    } catch (e) {
      setErr((e == null ? void 0 : e.message) || "Could not add the variant.");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(v) {
    await variantApi.update(v.id, { active: !v.active });
    await load();
  }
  async function setW(v, w) {
    await variantApi.update(v.id, { weight: Math.max(0, w) });
    await load();
  }
  async function del(v) {
    if (!await confirm({
      title: "Delete this variant?",
      message: `"${v.label}" and its traffic split will be removed.`,
      confirmLabel: "Delete variant"
    })) return;
    await variantApi.remove(v.id);
    await load();
  }
  return /* @__PURE__ */ jsxs("div", { className: "mt-6 card shadow-soft p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "A/B split testing" }),
      canManage && !adding && /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: () => setAdding(true), children: "+ Add variant" })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-fg-muted", children: "Send real visitors to different landing pages and compare which converts best. Each visitor is stuck to one variant, so results stay consistent. Bots and fraud are excluded from the test automatically." }),
    variants.length === 0 && !adding && /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-lg bg-bg-mute px-4 py-3 text-sm text-fg-muted", children: "No variants yet. Add two or more to start an A/B test — traffic is split by weight." }),
    variants.length > 0 && /* @__PURE__ */ jsx("div", { className: "mt-4 overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-line text-left text-xs uppercase tracking-wide text-fg-dim", children: [
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4", children: "Variant" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4", children: "Split" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4", children: "Visitors" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4", children: "Conversions" }),
        /* @__PURE__ */ jsx("th", { className: "py-2 pr-4", children: "CVR" }),
        canManage && /* @__PURE__ */ jsx("th", { className: "py-2" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: variants.map((v) => {
        const share = v.active && v.weight > 0 ? Math.round(v.weight / totalWeight * 100) : 0;
        const st = statById[v.id];
        return /* @__PURE__ */ jsxs("tr", { className: `border-b border-line/60 ${!v.active ? "opacity-50" : ""}`, children: [
          /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4", children: [
            /* @__PURE__ */ jsx("div", { className: "font-semibold", children: v.label }),
            /* @__PURE__ */ jsx(
              "a",
              {
                href: v.destination_url,
                target: "_blank",
                rel: "noreferrer",
                className: "text-xs text-brand hover:underline",
                children: v.destination_url
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("td", { className: "py-3 pr-4", children: [
            canManage ? /* @__PURE__ */ jsx(
              "input",
              {
                type: "number",
                min: 0,
                value: v.weight,
                onChange: (e) => setW(v, Number(e.target.value)),
                className: "w-16 rounded border border-line px-2 py-1"
              }
            ) : v.weight,
            /* @__PURE__ */ jsxs("span", { className: "ml-2 text-xs text-fg-muted", children: [
              share,
              "%"
            ] })
          ] }),
          /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: (st == null ? void 0 : st.visitors) ?? 0 }),
          /* @__PURE__ */ jsx("td", { className: "py-3 pr-4", children: (st == null ? void 0 : st.conversions) ?? 0 }),
          /* @__PURE__ */ jsx("td", { className: "py-3 pr-4 font-semibold", children: st ? `${(st.cvr * 100).toFixed(1)}%` : "0.0%" }),
          canManage && /* @__PURE__ */ jsxs("td", { className: "py-3 text-right", children: [
            /* @__PURE__ */ jsx("button", { onClick: () => toggle(v), className: "mr-3 text-xs text-fg-muted hover:text-brand", children: v.active ? "Pause" : "Resume" }),
            /* @__PURE__ */ jsx("button", { onClick: () => del(v), className: "text-xs text-red-600 hover:underline", children: "Delete" })
          ] })
        ] }, v.id);
      }) })
    ] }) }),
    adding && /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-lg border border-line p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid gap-3 sm:grid-cols-3", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            placeholder: "Variant name (e.g. Control)",
            value: label,
            onChange: (e) => setLabel(e.target.value),
            className: "rounded border border-line px-3 py-2 text-sm"
          }
        ),
        /* @__PURE__ */ jsx(
          "input",
          {
            placeholder: "https://your-page.com/a",
            value: url,
            onChange: (e) => setUrl(e.target.value),
            className: "rounded border border-line px-3 py-2 text-sm sm:col-span-2"
          }
        ),
        /* @__PURE__ */ jsxs("label", { className: "text-sm text-fg-muted", children: [
          "Weight",
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "number",
              min: 0,
              value: weight,
              onChange: (e) => setWeight(Number(e.target.value)),
              className: "ml-2 w-20 rounded border border-line px-2 py-1"
            }
          )
        ] })
      ] }),
      err && /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-red-600", children: err }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 flex gap-2", children: [
        /* @__PURE__ */ jsx(Button, { onClick: add, disabled: busy, children: busy ? "Adding…" : "Add variant" }),
        /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => {
              setAdding(false);
              setErr("");
            },
            className: "rounded-full px-4 py-2 text-sm text-fg-muted hover:text-fg",
            children: "Cancel"
          }
        )
      ] })
    ] })
  ] });
}
function CampaignDetail() {
  const { confirm } = useDialog();
  const { id } = useParams();
  const nav = useNavigate();
  const { current } = useWorkspace();
  const [c, setC] = useState(null);
  const [stats, setStats] = useState(null);
  const canManage = (current == null ? void 0 : current.role) === "owner" || (current == null ? void 0 : current.role) === "admin";
  async function load() {
    const [camp, st] = await Promise.all([campaignApi.get(Number(id)), campaignApi.stats(Number(id))]);
    setC(camp);
    setStats(st);
  }
  useEffect(() => {
    load();
  }, [id]);
  async function toggle() {
    if (!c) return;
    const updated = await campaignApi.update(c.id, { status: c.status === "active" ? "paused" : "active" });
    setC(updated);
  }
  async function remove() {
    if (!await confirm({
      title: "Delete this campaign?",
      message: "Its variants and click data go with it. This can't be undone.",
      confirmLabel: "Delete campaign"
    })) return;
    await campaignApi.remove(Number(id));
    nav("/dashboard/campaigns");
  }
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  async function scan() {
    setScanning(true);
    setScanMsg("");
    try {
      const r = await campaignApi.scanUrl(Number(id));
      if (!r.checked) {
        setScanMsg(r.detail || "URL scanning is not configured yet.");
      } else {
        setScanMsg(r.safe ? "Destination looks clean." : `Flagged: ${r.threats.join(", ")}`);
        await load();
      }
    } finally {
      setScanning(false);
    }
  }
  if (!c || !stats) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  const tiles = [
    ["Events", stats.events],
    ["Visitors", stats.visitors],
    ["Conversions", stats.conversions],
    ["Quality", `${(stats.quality * 100).toFixed(1)}%`],
    ["Flagged", stats.flagged]
  ];
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "campaign-detail", children: [
      "This shows how this campaign is doing. ",
      /* @__PURE__ */ jsx("b", { children: "Quality" }),
      " is the share of real visitors — if it's low, your ad may be attracting bots and wasting budget."
    ] }),
    /* @__PURE__ */ jsx(Link, { to: "/dashboard/campaigns", className: "text-sm text-fg-muted hover:text-brand", children: "← Campaigns" }),
    /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-center justify-between gap-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: c.name }),
        /* @__PURE__ */ jsxs("p", { className: "text-sm text-fg-muted capitalize", children: [
          c.traffic_source,
          " · ",
          c.website_name,
          /* @__PURE__ */ jsx("span", { className: `ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-success/10 text-emerald-700" : "bg-bg-mute text-fg-muted"}`, children: c.status })
        ] })
      ] }),
      canManage && /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: toggle, children: c.status === "active" ? "Pause" : "Activate" }),
        /* @__PURE__ */ jsx("button", { onClick: remove, className: "rounded-full border border-danger/30 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-danger/5", children: "Delete" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5", children: tiles.map(([k, v]) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-5", children: [
      /* @__PURE__ */ jsx("div", { className: "text-xs font-semibold uppercase tracking-wide text-fg-dim", children: k }),
      /* @__PURE__ */ jsx("div", { className: "mt-2 text-2xl font-extrabold", children: v })
    ] }, k)) }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-5 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Traffic classification" }),
        stats.events === 0 ? /* @__PURE__ */ jsxs("p", { className: "mt-4 text-sm text-fg-muted", children: [
          "No attributed traffic yet. Traffic is matched by UTM campaign ",
          /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1.5 py-0.5", children: c.utm_campaign || "—" }),
          "."
        ] }) : /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-3", children: Object.entries(stats.by_classification).map(([cls, n]) => {
          const pct = Math.round(n / stats.events * 100);
          return /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("div", { className: "mb-1 flex items-center justify-between text-sm", children: [
              /* @__PURE__ */ jsx(ClassBadge, { value: cls }),
              /* @__PURE__ */ jsxs("span", { className: "text-fg-muted", children: [
                n,
                " · ",
                pct,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "h-2 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: "h-full rounded-full bg-brand", style: { width: `${pct}%` } }) })
          ] }, cls);
        }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Configuration" }),
        /* @__PURE__ */ jsx("dl", { className: "mt-4 space-y-3 text-sm", children: [
          ["Destination", c.destination_url || "—"],
          ["Traffic source", c.traffic_source],
          ["UTM campaign", c.utm_campaign || "—"],
          ["Risk threshold", String(c.risk_threshold)],
          ["Country", c.country || "Any"],
          ["Created", new Date(c.created_at).toLocaleDateString()]
        ].map(([k, v]) => /* @__PURE__ */ jsxs("div", { className: "flex justify-between gap-4", children: [
          /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: k }),
          /* @__PURE__ */ jsx("dd", { className: "truncate text-right capitalize", children: v })
        ] }, k)) }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 border-t border-line pt-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
            /* @__PURE__ */ jsx("span", { className: "text-sm text-fg-muted", children: "Destination safety" }),
            c.url_safe === null ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-muted", children: "Not scanned" }) : c.url_safe ? /* @__PURE__ */ jsx("span", { className: "rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700", children: "Clean" }) : /* @__PURE__ */ jsx("span", { className: "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600", children: "Flagged" })
          ] }),
          c.url_threats && c.url_threats.length > 0 && /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-red-600", children: c.url_threats.join(", ") }),
          c.url_scanned_at && /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-fg-dim", children: [
            "Last checked ",
            new Date(c.url_scanned_at).toLocaleString()
          ] }),
          canManage && /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
            /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: scan, disabled: scanning, children: scanning ? "Checking…" : "Check destination safety" }),
            scanMsg && /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-fg-muted", children: scanMsg })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(CampaignVariants, { campaignId: c.id, canManage })
  ] });
}
export {
  CampaignDetail as default
};

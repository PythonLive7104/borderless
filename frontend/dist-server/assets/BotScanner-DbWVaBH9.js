import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { c as useWorkspace, x as websiteApi, B as Button, K as botCheckApi } from "../entry-server.js";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const gradeTone = {
  A: "bg-emerald-500",
  B: "bg-emerald-500",
  C: "bg-amber-500",
  D: "bg-orange-500",
  F: "bg-red-500"
};
const findTone = {
  good: { ring: "text-emerald-600", icon: "M20 6L9 17l-5-5" },
  warn: { ring: "text-amber-600", icon: "M12 9v4m0 4h.01" },
  bad: { ring: "text-red-600", icon: "M18 6L6 18M6 6l12 12" }
};
function BotScanner() {
  const { current } = useWorkspace();
  const [sites, setSites] = useState([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!current) return;
    websiteApi.list(current.id).then((r) => setSites(r.results)).catch(() => {
    });
  }, [current == null ? void 0 : current.id]);
  async function scan(target) {
    var _a;
    const t = (target ?? url).trim();
    if (!t) return;
    setUrl(t);
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      const r = await botCheckApi.run(t);
      if (!r.ok) setErr(r.error || "Something went wrong.");
      else setRes(r);
    } catch (e) {
      setErr(((_a = e == null ? void 0 : e.data) == null ? void 0 : _a.error) || "That check couldn't be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx(PageNote, { id: "bot-scanner", children: "Paste any website (or pick one of yours) to see how exposed it is to bots — HTTPS, firewall, bot protection, security headers and more. It reads only public information, so you can scan sites you don't own too." }),
    /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Bot exposure scanner" }),
    /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Check how well a site is protected against automated traffic." }),
    /* @__PURE__ */ jsxs("form", { onSubmit: (e) => {
      e.preventDefault();
      scan();
    }, className: "mt-6 flex flex-col gap-2 sm:flex-row", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          value: url,
          onChange: (e) => setUrl(e.target.value),
          placeholder: "yourwebsite.com",
          className: "flex-1 rounded-full border border-line bg-white px-5 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        }
      ),
      /* @__PURE__ */ jsx(Button, { type: "submit", disabled: busy, children: busy ? "Scanning…" : "Scan site" })
    ] }),
    sites.length > 0 && /* @__PURE__ */ jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [
      /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-fg-dim", children: "Your sites:" }),
      sites.map((s) => /* @__PURE__ */ jsx(
        "button",
        {
          onClick: () => scan(s.domain),
          className: "rounded-full border border-line bg-white px-3 py-1 text-xs text-fg-muted hover:border-brand/40 hover:text-brand",
          children: s.domain
        },
        s.id
      ))
    ] }),
    err && /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-lg bg-danger/5 px-4 py-2 text-sm text-red-600", children: err }),
    (res == null ? void 0 : res.ok) && /* @__PURE__ */ jsxs("div", { className: "mt-6 max-w-2xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft overflow-hidden", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-5 border-b border-line p-6", children: [
          /* @__PURE__ */ jsx("div", { className: `grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl font-black text-white ${gradeTone[res.grade]}`, children: res.grade }),
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxs("div", { className: "text-sm text-fg-muted", children: [
              "Scanned ",
              /* @__PURE__ */ jsx("span", { className: "font-mono text-fg", children: res.url })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-1 text-lg font-bold", children: res.summary }),
            /* @__PURE__ */ jsxs("div", { className: "mt-3", children: [
              /* @__PURE__ */ jsxs("div", { className: "mb-1 flex justify-between text-xs font-semibold text-fg-dim", children: [
                /* @__PURE__ */ jsx("span", { children: "Bot exposure" }),
                /* @__PURE__ */ jsxs("span", { children: [
                  res.exposure,
                  "%"
                ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "h-2 overflow-hidden rounded-full bg-bg-mute", children: /* @__PURE__ */ jsx("div", { className: `h-full rounded-full ${gradeTone[res.grade]}`, style: { width: `${res.exposure}%` } }) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx("ul", { className: "divide-y divide-line", children: res.findings.map((f, i) => {
          const t = findTone[f.status];
          return /* @__PURE__ */ jsxs("li", { className: "flex gap-3 p-4", children: [
            /* @__PURE__ */ jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", className: `mt-0.5 shrink-0 ${t.ring}`, children: /* @__PURE__ */ jsx("path", { d: t.icon, strokeLinecap: "round", strokeLinejoin: "round" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: f.label }),
              /* @__PURE__ */ jsx("div", { className: "text-sm text-fg-muted", children: f.detail })
            ] })
          ] }, i);
        }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "mt-4 rounded-xl bg-bg-soft p-4 text-sm text-fg-muted", children: [
        "Want TryNoBot to actually filter this traffic? ",
        /* @__PURE__ */ jsx(Link, { to: "/dashboard/websites", className: "font-semibold text-brand hover:underline", children: "Add the site & install the tracker →" })
      ] })
    ] })
  ] });
}
export {
  BotScanner as default
};

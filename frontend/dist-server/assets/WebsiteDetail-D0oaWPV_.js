import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { useParams, Link } from "react-router-dom";
import { B as Button, x as websiteApi } from "../entry-server.js";
import { S as StatusBadge } from "./StatusBadge-BjkD924O.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function SafeBrowsing({ site, onChecked }) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");
  async function check() {
    setChecking(true);
    setNote("");
    try {
      const r = await websiteApi.checkSafeBrowsing(site.id);
      setNote(r.message);
      onChecked();
    } catch {
      setNote("Couldn't run the check just now — try again shortly.");
    } finally {
      setChecking(false);
    }
  }
  const when = site.safe_browsing_checked_at ? new Date(site.safe_browsing_checked_at).toLocaleString() : null;
  const checkBtn = /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: check,
      disabled: checking,
      className: "mt-1 block text-xs font-semibold text-brand hover:underline disabled:opacity-60",
      children: checking ? "Checking…" : "Check now"
    }
  );
  if (site.safe_browsing_flagged) {
    const threats = (site.safe_browsing_threats || []).map((t) => t.replace(/_/g, " ").toLowerCase()).join(", ");
    return /* @__PURE__ */ jsxs("span", { className: "inline-block max-w-[16rem]", children: [
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-red-600", children: "⚠ Flagged by Google" }),
      threats && /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: threats }),
      /* @__PURE__ */ jsx(
        "a",
        {
          href: "https://search.google.com/search-console",
          target: "_blank",
          rel: "noopener noreferrer",
          className: "mt-0.5 block text-xs text-brand underline",
          children: "Request a review →"
        }
      ),
      checkBtn,
      note && /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: note })
    ] });
  }
  if (!when) {
    return /* @__PURE__ */ jsxs("span", { className: "inline-block", children: [
      /* @__PURE__ */ jsx("span", { className: "text-fg-muted", children: "Not checked yet" }),
      checkBtn,
      note && /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: note })
    ] });
  }
  return /* @__PURE__ */ jsxs("span", { className: "inline-block", children: [
    /* @__PURE__ */ jsx("span", { className: "font-semibold text-emerald-700", children: "✓ Clean" }),
    /* @__PURE__ */ jsxs("span", { className: "block text-xs text-fg-muted", children: [
      "checked ",
      when
    ] }),
    checkBtn,
    note && /* @__PURE__ */ jsx("span", { className: "block text-xs text-fg-muted", children: note })
  ] });
}
function WebsiteDetail() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  const [verifying, setVerifying] = useState(false);
  async function load() {
    setSite(await websiteApi.get(Number(id)));
  }
  useEffect(() => {
    load();
  }, [id]);
  function copy() {
    var _a;
    if (!site) return;
    (_a = navigator.clipboard) == null ? void 0 : _a.writeText(site.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  async function verify() {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const r = await websiteApi.verify(Number(id));
      setVerifyMsg({ ok: r.installed, text: r.message });
      load();
    } finally {
      setVerifying(false);
    }
  }
  if (!site) return /* @__PURE__ */ jsx("div", { className: "grid place-items-center py-20", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "website-detail", children: [
      "Copy the snippet below and paste it into your website (just before the ",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-white px-1", children: "</head>" }),
      " tag), then click ",
      /* @__PURE__ */ jsx("b", { children: "Verify installation" }),
      ". Not sure how? Send this page to whoever manages your site."
    ] }),
    /* @__PURE__ */ jsx(Link, { to: "/dashboard/websites", className: "text-sm text-fg-muted hover:text-brand", children: "← Websites" }),
    /* @__PURE__ */ jsxs("div", { className: "mt-3 flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: site.name }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-fg-muted", children: site.domain })
      ] }),
      /* @__PURE__ */ jsx(StatusBadge, { status: site.live_state })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-5 lg:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6 lg:col-span-2", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "Install tracking" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          "Paste this snippet before the closing ",
          /* @__PURE__ */ jsx("code", { children: "</head>" }),
          " tag on every page."
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 overflow-hidden rounded-xl border border-navy-800 bg-navy-900", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b border-white/10 px-4 py-2.5", children: [
            /* @__PURE__ */ jsx("span", { className: "text-xs text-slate-400", children: "tracking snippet" }),
            /* @__PURE__ */ jsx("button", { onClick: copy, className: "rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20", children: copied ? "Copied ✓" : "Copy" })
          ] }),
          /* @__PURE__ */ jsx("pre", { className: "overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-200", children: /* @__PURE__ */ jsx("code", { children: site.snippet }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "mt-4 flex items-center gap-3", children: [
          /* @__PURE__ */ jsx(Button, { onClick: verify, children: verifying ? "Checking…" : "Verify installation" }),
          verifyMsg && /* @__PURE__ */ jsx("span", { className: `text-sm ${verifyMsg.ok ? "text-emerald-700" : "text-amber-700"}`, children: verifyMsg.text })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
        /* @__PURE__ */ jsx("h2", { className: "text-sm font-bold uppercase tracking-wide text-fg-dim", children: "Details" }),
        /* @__PURE__ */ jsxs("dl", { className: "mt-3 space-y-3 text-sm", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Tracking ID" }),
            /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1.5 py-0.5", children: site.tracking_id }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Status" }),
            /* @__PURE__ */ jsx("dd", { children: /* @__PURE__ */ jsx(StatusBadge, { status: site.live_state }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Last event" }),
            /* @__PURE__ */ jsx("dd", { children: site.last_event_at ? new Date(site.last_event_at).toLocaleString() : "—" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Created" }),
            /* @__PURE__ */ jsx("dd", { children: new Date(site.created_at).toLocaleDateString() })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsx("dt", { className: "text-fg-muted", children: "Google Safe Browsing" }),
            /* @__PURE__ */ jsx("dd", { className: "text-right", children: /* @__PURE__ */ jsx(SafeBrowsing, { site, onChecked: load }) })
          ] })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-5 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand/5 p-5", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "font-bold", children: "Next: protect this traffic" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 max-w-xl text-sm text-fg-muted", children: "Detection alone won't turn bad visitors away. Set up Traffic Rules to redirect fraud & bots and flag suspicious visitors — one click applies our recommended protection." })
      ] }),
      /* @__PURE__ */ jsx(Button, { to: "/dashboard/traffic-rules", children: "Set up protection →" })
    ] })
  ] });
}
export {
  WebsiteDetail as default
};

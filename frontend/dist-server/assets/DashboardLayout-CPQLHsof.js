import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect, useMemo } from "react";
import { useLocation, Link, useNavigate, Outlet, NavLink } from "react-router-dom";
import { c as useWorkspace, d as billingApi, u as useAuth, B as Button, a as authApi, L as Logo, I as IHome, e as IGlobe, f as ITarget, g as IFilter, h as IShieldGold, i as ILink, j as IRadar, k as IUsers, l as IList, m as IChart, n as IFunnel, p as ISources, q as IPlug, r as IKey, s as IBolt, t as ICard, v as IGauge, w as IGear } from "../entry-server.js";
import { T as TourProvider } from "./TourContext-Bymw7lRR.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
const roleTone = {
  owner: "bg-brand/10 text-brand",
  admin: "bg-violet/10 text-violet",
  analyst: "bg-bg-mute text-fg-muted"
};
function WorkspaceSwitcher() {
  const { orgs, current, switchTo } = useWorkspace();
  const [open, setOpen] = useState(false);
  if (!current) return null;
  return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
    /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => setOpen(!open),
        className: "flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-brand/40",
        children: [
          /* @__PURE__ */ jsx("span", { className: "grid h-6 w-6 place-items-center rounded-md bg-gradient-to-tr from-brand to-violet text-xs font-bold text-white", children: current.name.charAt(0).toUpperCase() }),
          current.name,
          /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${roleTone[current.role]}`, children: current.role }),
          /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", className: "text-fg-dim", children: /* @__PURE__ */ jsx("path", { d: "M6 9l6 6 6-6" }) })
        ]
      }
    ),
    open && /* @__PURE__ */ jsx("div", { className: "absolute z-20 mt-2 w-60 rounded-xl border border-line bg-white p-1.5 shadow-soft", children: orgs.map((o) => /* @__PURE__ */ jsxs(
      "button",
      {
        onClick: () => {
          switchTo(o.id);
          setOpen(false);
        },
        className: `flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm hover:bg-bg-mute ${o.id === current.id ? "font-semibold" : ""}`,
        children: [
          /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("span", { className: "grid h-5 w-5 place-items-center rounded bg-gradient-to-tr from-brand to-violet text-[10px] font-bold text-white", children: o.name.charAt(0).toUpperCase() }),
            o.name
          ] }),
          /* @__PURE__ */ jsx("span", { className: "text-[10px] uppercase text-fg-dim", children: o.role })
        ]
      },
      o.id
    )) })
  ] });
}
const KB = [
  {
    q: "What is TryNoBot?",
    keywords: ["what", "borderless", "about", "do", "purpose", "product"],
    a: "TryNoBot is a traffic-intelligence platform. It scores every visitor to your site in real time, detects bots and fraud, and lets you automatically filter or redirect bad traffic so your ad budget reaches real people."
  },
  {
    q: "How do I install the tracker on my site?",
    keywords: ["install", "tracker", "snippet", "code", "setup", "add", "website", "embed", "script"],
    a: "Go to Websites → add your site → copy the tracking snippet shown and paste it into your site's HTML (before </body>). Once a visit is recorded, the site status turns Active. Use the Verify button to check installation."
  },
  {
    q: "What is a risk score?",
    keywords: ["risk", "score", "rating", "number", "0", "100"],
    a: "Every visit gets a 0–100 risk score from weighted signals (known bots, headless/automation fingerprints, datacenter/proxy IPs, bad JA3, abnormal request rate, and more). Higher means more suspicious."
  },
  {
    q: "What do the classifications mean?",
    keywords: ["classification", "human", "suspicious", "bot", "fraud", "label", "category"],
    a: "Scores map to labels: Human (clean), Suspicious (some risk), Bot (automated), and Fraud (high risk). You can build rules that act on either the score or the label."
  },
  {
    q: "How do traffic rules work?",
    keywords: ["rule", "rules", "filter", "condition", "action", "block", "allow"],
    a: "A rule is IF conditions match THEN take an action. Conditions can check risk, country, device, OS, browser, JA3, referrer, UTM and more. Actions: Allow, Redirect (send to a URL), Block, Flag for review, or Tag. Rules run by priority — first match wins."
  },
  {
    q: "What does each action mean?",
    keywords: ["action", "redirect", "review", "tag", "block", "allow", "mean"],
    a: "Allow = let them through. Redirect = actively send them to a URL you choose (e.g. bots to a safe/blank page) — this is how you stop bad traffic live, since it's the one action that changes what the visitor sees. Block = record the visit as blocked in your reports (the decision is made instantly, great for filtering analytics and protecting ad attribution). Flag for review = just mark it to inspect later. Tag = attach a custom label. Tip: to actively stop bots in real time, use Redirect."
  },
  {
    q: "How do I actually block bots (the Server-side Shield)?",
    keywords: ["shield", "block", "blocking", "server", "server-side", "stop", "bots", "firewall", "protect", "protection", "nginx", "cloudflare", "php", "django", "middleware", "decide", "guard", "inline"],
    a: "Two ways, from easiest to strongest. 1) NO CODE — add a Traffic Rule with the Redirect action, or use Traffic Rules → 'Recommended protection'. The snippet you already installed turns bad visitors away. 2) SERVER-SIDE SHIELD (Shield page) — the strongest option: it blocks bots BEFORE your page even loads. Your server or Cloudflare asks us for a verdict using a small snippet (ready-made for PHP, Python/Django, nginx, Cloudflare Worker and Node). It uses the same Traffic Rules you set and fails open, so your site never breaks if we're unreachable. Note: true 'block at the door' always needs that one snippet on your side — no dashboard toggle can block traffic to someone else's site. If you're not technical, the no-code redirect is all you need."
  },
  {
    q: "How do I block or allow specific IPs?",
    keywords: ["ip", "address", "blacklist", "whitelist", "allow", "deny", "cidr", "block"],
    a: "Traffic Rules → the 'IP allow / deny' tab. Add an exact IP (1.2.3.4) or a CIDR range (10.0.0.0/8). Allowed IPs always pass; blocked IPs are stopped outright — both beat the scored rules."
  },
  {
    q: "How do I restrict by country, device or OS?",
    keywords: ["country", "device", "os", "operating", "mobile", "desktop", "restrict", "geo"],
    a: "Create a Traffic Rule with a condition like Country is Russia, Device is Mobile, or OS is Android, then choose an action such as Block or Redirect. You can match several values with 'is any of'."
  },
  {
    q: "What is JA3 / TLS fingerprinting?",
    keywords: ["ja3", "tls", "fingerprint", "ssl"],
    a: "JA3 is a fingerprint of a client's TLS handshake — useful for spotting automation tools that fake a normal browser. TryNoBot scores known-bad JA3 hashes; in production it needs a TLS-terminating proxy (like Cloudflare) to supply the value."
  },
  {
    q: "What is A/B testing here?",
    keywords: ["a/b", "ab", "split", "test", "variant", "landing", "experiment"],
    a: "On a Campaign you can add landing-page variants with weights. Real human visitors are split (stickily) across them and TryNoBot reports the conversion rate per variant. Bots are excluded from the test."
  },
  {
    q: "How do conversions work?",
    keywords: ["conversion", "convert", "revenue", "sale", "postback", "track"],
    a: "Call the conversion function from your tracking snippet (or the public conversions API) when a visitor completes a goal. Conversions show under Conversions with revenue and attribution."
  },
  {
    q: "What are the plans and limits?",
    keywords: ["plan", "pricing", "billing", "price", "cost", "limit", "events", "upgrade", "subscription"],
    a: "Starter ($29, 50k events/mo, 30-day retention), Growth ($99, 500k, 90-day) and Business ($299, 2M, 365-day). Change plans on the Billing page. Payments run through Bachs (card, mobile money or crypto)."
  },
  {
    q: "How do I check my usage?",
    keywords: ["usage", "quota", "remaining", "events", "limit", "used"],
    a: "The Usage page shows events used this period against your plan limit, with alerts at 70%, 85% and 100%. Upgrade on Billing if you're close."
  },
  {
    q: "How do API keys work?",
    keywords: ["api", "key", "token", "developer", "authentication"],
    a: "Create keys on the API Keys page. A key is shown once at creation — copy it then. Send it as a Bearer token to authenticate API calls like the conversions endpoint."
  },
  {
    q: "What are webhooks?",
    keywords: ["webhook", "event", "notify", "callback", "http"],
    a: "Webhooks POST events (traffic classified, high risk, conversion created) to a URL you provide, signed with an HMAC secret. Configure and view deliveries on the Webhooks page."
  },
  {
    q: "How do I invite my team?",
    keywords: ["team", "invite", "member", "colleague", "role", "user", "collaborator"],
    a: "On the Team page, invite people by email and pick a role: Owner, Admin (can manage) or Analyst (read-only). They'll get an invitation link."
  },
  {
    q: "How do I scan a destination URL for threats?",
    keywords: ["threat", "scan", "malware", "phishing", "safe", "browsing", "virustotal", "url"],
    a: "Open a Campaign and use 'Check destination safety'. When threat-scanning keys (Google Safe Browsing / VirusTotal) are configured, it flags URLs known for malware or phishing."
  },
  {
    q: "What is the Bot Scanner?",
    keywords: ["bot", "scanner", "exposure", "check", "scan", "site", "expose"],
    a: "The Bot Scanner (under Traffic) checks how exposed any website is to bots — HTTPS, firewall/CDN, bot protection, security headers and more — and gives it a grade from A to F. Paste any URL, or click one of your own registered sites. It reads only public info, so you can scan sites you don't own too. There's also a free public version at /bot-check for lead generation."
  },
  {
    q: "How is my data retained?",
    keywords: ["retention", "data", "delete", "keep", "history", "old"],
    a: "Traffic data is kept for your plan's retention window (30 / 90 / 365 days) and older data is purged automatically each day."
  },
  {
    q: "Where do I change my password or notifications?",
    keywords: ["password", "settings", "profile", "notification", "email", "account", "change"],
    a: "On the Settings page: Profile (name, language, timezone), Security (change password) and Notifications (which emails you receive). You can also replay the product tour from there."
  }
];
const __vite_import_meta_env__ = {};
const TAWK_SRC = (__vite_import_meta_env__ == null ? void 0 : __vite_import_meta_env__.VITE_TAWK_SRC) || "";
function openTawk() {
  var _a;
  const w = window;
  if (!TAWK_SRC) {
    window.open("mailto:support@trynobot.com?subject=Support%20request", "_blank");
    return;
  }
  if ((_a = w.Tawk_API) == null ? void 0 : _a.maximize) {
    w.Tawk_API.maximize();
    return;
  }
  w.Tawk_API = w.Tawk_API || {};
  w.Tawk_LoadStart = /* @__PURE__ */ new Date();
  const s = document.createElement("script");
  s.async = true;
  s.src = TAWK_SRC;
  s.charset = "UTF-8";
  s.setAttribute("crossorigin", "*");
  s.onload = () => {
    const t = setInterval(() => {
      var _a2;
      if ((_a2 = w.Tawk_API) == null ? void 0 : _a2.maximize) {
        w.Tawk_API.maximize();
        clearInterval(t);
      }
    }, 300);
    setTimeout(() => clearInterval(t), 8e3);
  };
  document.body.appendChild(s);
}
const STOP = /* @__PURE__ */ new Set(["the", "a", "an", "is", "are", "do", "does", "how", "what", "i", "to", "my", "of", "on", "in", "and", "can", "for", "me", "you", "it"]);
function tokenize(s) {
  return s.toLowerCase().replace(/[^a-z0-9/ ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}
function findAnswer(question) {
  const words = tokenize(question);
  if (words.length === 0) return null;
  let best = { score: 0, a: "" };
  for (const e of KB) {
    const hay = /* @__PURE__ */ new Set([...e.keywords, ...tokenize(e.q)]);
    let score = 0;
    for (const w of words) if (hay.has(w)) score += 1;
    if (score > best.score) best = { score, a: e.a };
  }
  return best.score >= 1 ? best.a : null;
}
const SUGGESTIONS = [
  "How do I install the tracker?",
  "How do I actually block bots?",
  "What do the actions mean?",
  "How do I block an IP?",
  "What are the plans?"
];
function HelpChat() {
  const [open, setOpen] = useState(false);
  const [tawkActive, setTawkActive] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([
    { from: "bot", text: "Hi! I'm the TryNoBot assistant. Ask me anything about using the app — or tap a suggestion below." }
  ]);
  const scroller = useRef(null);
  useEffect(() => {
    var _a;
    (_a = scroller.current) == null ? void 0 : _a.scrollTo(0, scroller.current.scrollHeight);
  }, [msgs, open]);
  function talkToHuman() {
    openTawk();
    setOpen(false);
    setTawkActive(true);
  }
  if (tawkActive) return null;
  function ask(text) {
    const q = text.trim();
    if (!q) return;
    const answer = findAnswer(q);
    setMsgs((m) => [
      ...m,
      { from: "user", text: q },
      answer ? { from: "bot", text: answer } : { from: "bot", text: "I don't have an answer for that one yet. You can connect with our support team for help.", human: true }
    ]);
    setInput("");
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        onClick: () => setOpen((o) => !o),
        "aria-label": "Help",
        className: "fixed bottom-5 right-5 z-[90] grid h-14 w-14 place-items-center rounded-full bg-brand text-white shadow-[0_12px_30px_-8px_rgba(37,99,235,.7)] transition hover:bg-brand-600",
        children: open ? /* @__PURE__ */ jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) : /* @__PURE__ */ jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" }) })
      }
    ),
    open && /* @__PURE__ */ jsxs("div", { className: "fixed bottom-24 right-5 z-[90] flex h-[30rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.35)]", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-line bg-bg-soft px-4 py-3", children: [
        /* @__PURE__ */ jsx("span", { className: "grid h-8 w-8 place-items-center rounded-full bg-brand/10 text-brand", children: "?" }),
        /* @__PURE__ */ jsxs("div", { className: "flex-1", children: [
          /* @__PURE__ */ jsx("div", { className: "text-sm font-bold", children: "Help & answers" }),
          /* @__PURE__ */ jsx("div", { className: "text-[11px] text-fg-dim", children: "Ask about anything in TryNoBot" })
        ] }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: talkToHuman,
            title: "Chat with a support agent",
            className: "flex items-center gap-1 rounded-full border border-brand/30 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand/5",
            children: [
              /* @__PURE__ */ jsx("span", { className: "inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" }),
              " Talk to a human"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { ref: scroller, className: "flex-1 space-y-3 overflow-y-auto px-4 py-4", children: [
        msgs.map((m, i) => /* @__PURE__ */ jsx("div", { className: `flex ${m.from === "user" ? "justify-end" : "justify-start"}`, children: /* @__PURE__ */ jsxs("div", { className: `max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "user" ? "bg-brand text-white" : "bg-bg-mute text-fg"}`, children: [
          m.text,
          m.human && /* @__PURE__ */ jsx("button", { onClick: talkToHuman, className: "mt-2 block w-full rounded-lg bg-brand px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-brand-600", children: "Chat with a human" })
        ] }) }, i)),
        msgs.length <= 1 && /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1.5 pt-1", children: SUGGESTIONS.map((s) => /* @__PURE__ */ jsx("button", { onClick: () => ask(s), className: "rounded-full border border-line bg-white px-2.5 py-1 text-xs text-fg-muted hover:border-brand/40 hover:text-brand", children: s }, s)) })
      ] }),
      /* @__PURE__ */ jsxs("form", { onSubmit: (e) => {
        e.preventDefault();
        ask(input);
      }, className: "flex items-center gap-2 border-t border-line p-3", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            value: input,
            onChange: (e) => setInput(e.target.value),
            placeholder: "Type your question…",
            className: "min-w-0 flex-1 rounded-full border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
          }
        ),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white hover:bg-brand-600", "aria-label": "Send", children: /* @__PURE__ */ jsx("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" }) }) })
      ] })
    ] })
  ] });
}
const BILLING_PATH = "/dashboard/billing";
function AccessGate({ children }) {
  const { current } = useWorkspace();
  const loc = useLocation();
  const [access, setAccess] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    if (!current) return;
    billingApi.subscription(current.id).then((s) => {
      if (alive) {
        setAccess(s.access);
        setLoaded(true);
      }
    }).catch(() => {
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [current == null ? void 0 : current.id, loc.pathname]);
  if (!loaded || !access) return /* @__PURE__ */ jsx(Fragment, { children });
  const onBilling = loc.pathname.startsWith(BILLING_PATH);
  if (access.locked && !onBilling) {
    const canceled = access.reason === "canceled";
    return /* @__PURE__ */ jsx("div", { className: "grid min-h-[60vh] place-items-center px-4", children: /* @__PURE__ */ jsxs("div", { className: "card shadow-soft max-w-md p-8 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl", children: "🔒" }),
      /* @__PURE__ */ jsx("h2", { className: "mt-4 text-xl font-extrabold tracking-tight", children: canceled ? "Subscription canceled" : "Your free trial has ended" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-fg-muted", children: canceled ? "Reactivate a plan to regain access to your workspace, traffic data and rules." : "Thanks for trying TryNoBot! Choose a plan to keep filtering traffic and unlock your dashboard again." }),
      /* @__PURE__ */ jsx(
        Link,
        {
          to: BILLING_PATH,
          className: "mt-6 inline-flex items-center justify-center rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600",
          children: canceled ? "Reactivate a plan" : "Choose a plan"
        }
      ),
      /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-fg-dim", children: "Your data is safe and returns the moment you subscribe." })
    ] }) });
  }
  const banner = access.reason === "trialing" && /* @__PURE__ */ jsxs("div", { className: "mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm", children: [
    /* @__PURE__ */ jsxs("span", { className: "text-amber-800", children: [
      /* @__PURE__ */ jsx("b", { children: access.days_left }),
      " day",
      access.days_left === 1 ? "" : "s",
      " left in your free trial."
    ] }),
    !onBilling && /* @__PURE__ */ jsx(Link, { to: BILLING_PATH, className: "font-semibold text-amber-900 underline hover:no-underline", children: "Upgrade now →" })
  ] });
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    banner,
    children
  ] });
}
const NAV$1 = [
  { label: "Dashboard", hint: "Traffic overview", group: "Go to", to: "/dashboard", keywords: "home overview control center" },
  { label: "Websites", hint: "Your tracked sites", group: "Go to", to: "/dashboard/websites", keywords: "site tracker snippet install" },
  { label: "Campaigns", hint: "Ad campaigns & A/B tests", group: "Go to", to: "/dashboard/campaigns", keywords: "ads split test variant" },
  { label: "Traffic Rules", hint: "Allow / block / redirect", group: "Go to", to: "/dashboard/traffic-rules", keywords: "rule filter ip block country device" },
  { label: "Bot Scanner", hint: "Scan a site's bot exposure", group: "Go to", to: "/dashboard/scanner", keywords: "scan exposure check" },
  { label: "Visitors", hint: "Every visit & its score", group: "Go to", to: "/dashboard/visitors", keywords: "visitor fingerprint" },
  { label: "Click Log", hint: "Raw event stream", group: "Go to", to: "/dashboard/click-log", keywords: "events clicks log" },
  { label: "Reports", hint: "Analytics reports", group: "Go to", to: "/dashboard/reports", keywords: "analytics charts export" },
  { label: "Conversions", hint: "Goals & revenue", group: "Go to", to: "/dashboard/conversions", keywords: "revenue sales goal" },
  { label: "Traffic Sources", hint: "Where traffic comes from", group: "Go to", to: "/dashboard/traffic-sources", keywords: "source utm referrer" },
  { label: "Integrations", hint: "Connect your stack", group: "Go to", to: "/dashboard/integrations", keywords: "connect api webhook" },
  { label: "API Keys", hint: "Manage API keys", group: "Go to", to: "/dashboard/api", keywords: "token developer key" },
  { label: "Webhooks", hint: "Event delivery", group: "Go to", to: "/dashboard/webhooks", keywords: "callback event http" },
  { label: "Team", hint: "Invite & roles", group: "Go to", to: "/dashboard/team", keywords: "invite member role colleague" },
  { label: "Billing", hint: "Plan & payment", group: "Go to", to: "/dashboard/billing", keywords: "plan subscription upgrade pay" },
  { label: "Usage", hint: "Quota this period", group: "Go to", to: "/dashboard/usage", keywords: "quota limit events" },
  { label: "Settings", hint: "Profile, security, notifications", group: "Go to", to: "/dashboard/settings", keywords: "profile password account language tour" }
];
const ACTIONS = [
  { label: "Add a website", hint: "Register a new site", group: "Actions", to: "/dashboard/websites", keywords: "new create install" },
  { label: "Create a campaign", hint: "Track an ad campaign", group: "Actions", to: "/dashboard/campaigns", keywords: "new ad" },
  { label: "New traffic rule", hint: "Block / redirect traffic", group: "Actions", to: "/dashboard/traffic-rules", keywords: "block filter" },
  { label: "Generate an API key", hint: "For the REST API", group: "Actions", to: "/dashboard/api", keywords: "token" },
  { label: "Scan a site for bots", hint: "Bot exposure check", group: "Actions", to: "/dashboard/scanner", keywords: "scan" },
  { label: "View billing", hint: "Manage your plan", group: "Actions", to: "/dashboard/billing", keywords: "upgrade pay" }
];
function CommandPalette() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const all = useMemo(() => {
    const base = [...NAV$1, ...ACTIONS];
    if (user == null ? void 0 : user.is_staff) base.push({ label: "Admin panel", hint: "Staff-only overview", group: "Go to", to: "/admin", keywords: "staff users organizations" });
    return base;
  }, [user == null ? void 0 : user.is_staff]);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((c) => (c.label + " " + c.hint + " " + (c.keywords || "")).toLowerCase().includes(term));
  }, [q, all]);
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => {
        var _a;
        return (_a = inputRef.current) == null ? void 0 : _a.focus();
      }, 20);
    }
  }, [open]);
  useEffect(() => {
    setActive(0);
  }, [q]);
  if (!open) return null;
  const go = (c) => {
    if (c) {
      nav(c.to);
      setOpen(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-[110] flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm", onClick: () => setOpen(false), children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)]", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 border-b border-line px-4", children: [
      /* @__PURE__ */ jsxs("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", className: "text-fg-dim", children: [
        /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "7" }),
        /* @__PURE__ */ jsx("path", { d: "M21 21l-4.3-4.3" })
      ] }),
      /* @__PURE__ */ jsx(
        "input",
        {
          ref: inputRef,
          value: q,
          onChange: (e) => setQ(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(results[active]);
            }
          },
          placeholder: "Search pages and actions…",
          className: "w-full bg-transparent py-3.5 text-sm outline-none"
        }
      ),
      /* @__PURE__ */ jsx("kbd", { className: "rounded border border-line px-1.5 py-0.5 text-[10px] text-fg-dim", children: "ESC" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "max-h-80 overflow-y-auto py-2", children: [
      results.length === 0 && /* @__PURE__ */ jsxs("div", { className: "px-4 py-6 text-center text-sm text-fg-muted", children: [
        'No matches for "',
        q,
        '"'
      ] }),
      results.map((c, i) => /* @__PURE__ */ jsxs(
        "button",
        {
          onMouseEnter: () => setActive(i),
          onClick: () => go(c),
          className: `flex w-full items-center justify-between px-4 py-2.5 text-left ${i === active ? "bg-brand/10" : ""}`,
          children: [
            /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-3", children: [
              /* @__PURE__ */ jsx("span", { className: `text-sm font-medium ${i === active ? "text-brand" : ""}`, children: c.label }),
              /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: c.hint })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-dim", children: c.group })
          ]
        },
        c.group + c.label
      ))
    ] })
  ] }) });
}
function VerifyEmailGate({ children }) {
  const { user, refreshUser, logout } = useAuth();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user || user.is_verified) return /* @__PURE__ */ jsx(Fragment, { children });
  async function resend() {
    setBusy(true);
    setMsg("");
    try {
      const r = await authApi.resendVerification();
      setMsg(r.detail || "Verification email sent.");
    } catch {
      setMsg("Couldn't send right now — please try again in a moment.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsx("div", { className: "grid min-h-screen place-items-center bg-bg-soft px-4", children: /* @__PURE__ */ jsxs("div", { className: "card shadow-soft w-full max-w-md p-8 text-center", children: [
    /* @__PURE__ */ jsx("div", { className: "mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-2xl", children: "✉️" }),
    /* @__PURE__ */ jsx("h1", { className: "mt-4 text-xl font-extrabold tracking-tight", children: "Confirm your email" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm text-fg-muted", children: [
      "We sent a confirmation link to ",
      /* @__PURE__ */ jsx("b", { className: "text-fg", children: user.email }),
      ". Click it to activate your account and start using the dashboard."
    ] }),
    msg && /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-lg bg-success/10 px-4 py-2 text-sm text-emerald-700", children: msg }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 flex flex-col gap-2", children: [
      /* @__PURE__ */ jsx(Button, { onClick: resend, disabled: busy, children: busy ? "Sending…" : "Resend the email" }),
      /* @__PURE__ */ jsx("button", { onClick: () => refreshUser(), className: "rounded-full px-4 py-2 text-sm font-semibold text-brand hover:underline", children: "I've confirmed — continue" })
    ] }),
    /* @__PURE__ */ jsx("button", { onClick: logout, className: "mt-4 text-xs text-fg-dim hover:text-fg-muted", children: "Sign out" }),
    /* @__PURE__ */ jsx("p", { className: "mt-4 text-xs text-fg-dim", children: "Wrong address or no email? Check spam, or resend above." })
  ] }) });
}
const NAV = [
  { title: "Overview", items: [
    { label: "Dashboard", to: "/dashboard", icon: IHome },
    { label: "Websites", to: "/dashboard/websites", icon: IGlobe }
  ] },
  { title: "Traffic", items: [
    { label: "Campaigns", to: "/dashboard/campaigns", icon: ITarget },
    { label: "Traffic Rules", to: "/dashboard/traffic-rules", icon: IFilter },
    { label: "Shield", to: "/dashboard/shield", icon: IShieldGold },
    { label: "Redirection", to: "/dashboard/links", icon: ILink },
    { label: "Bot Scanner", to: "/dashboard/scanner", icon: IRadar },
    { label: "Visitors", to: "/dashboard/visitors", icon: IUsers },
    { label: "Click Log", to: "/dashboard/click-log", icon: IList }
  ] },
  { title: "Analytics", items: [
    { label: "Reports", to: "/dashboard/reports", icon: IChart },
    { label: "Conversions", to: "/dashboard/conversions", icon: IFunnel },
    { label: "Traffic Sources", to: "/dashboard/traffic-sources", icon: ISources }
  ] },
  { title: "Developer", items: [
    { label: "Integrations", to: "/dashboard/integrations", icon: IPlug },
    { label: "API Keys", to: "/dashboard/api", icon: IKey },
    { label: "Webhooks", to: "/dashboard/webhooks", icon: IBolt }
  ] },
  { title: "Settings", items: [
    { label: "Team", to: "/dashboard/team", icon: IUsers },
    { label: "Billing", to: "/dashboard/billing", icon: ICard },
    { label: "Usage", to: "/dashboard/usage", icon: IGauge },
    { label: "Settings", to: "/dashboard/settings", icon: IGear }
  ] }
];
function SidebarLink({ item, onNavigate }) {
  const Icon = item.icon;
  if (item.soon || !item.to) {
    return /* @__PURE__ */ jsxs("span", { className: "flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-dim/70", children: [
      Icon && /* @__PURE__ */ jsx(Icon, { width: 18, className: "shrink-0" }),
      /* @__PURE__ */ jsx("span", { className: "flex-1", children: item.label }),
      /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", children: "soon" })
    ] });
  }
  return /* @__PURE__ */ jsxs(
    NavLink,
    {
      to: item.to,
      end: item.to === "/dashboard",
      onClick: onNavigate,
      className: ({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-brand/10 text-brand" : "text-fg-muted hover:bg-bg-mute hover:text-fg"}`,
      children: [
        Icon && /* @__PURE__ */ jsx(Icon, { width: 18, className: "shrink-0" }),
        /* @__PURE__ */ jsx("span", { children: item.label })
      ]
    }
  );
}
function DashboardLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  return /* @__PURE__ */ jsx(TourProvider, { children: /* @__PURE__ */ jsx(VerifyEmailGate, { children: /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-bg-soft", children: [
    /* @__PURE__ */ jsxs("aside", { className: `fixed inset-y-0 left-0 z-40 w-60 border-r border-line bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`, children: [
      /* @__PURE__ */ jsx("div", { className: "flex h-16 items-center border-b border-line px-5", children: /* @__PURE__ */ jsx(Logo, {}) }),
      /* @__PURE__ */ jsx("nav", { className: "space-y-6 overflow-y-auto px-3 py-5", style: { maxHeight: "calc(100vh - 4rem)" }, children: NAV.map((g) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-fg-dim", children: g.title }),
        /* @__PURE__ */ jsx("div", { className: "space-y-0.5", children: g.items.map((it) => /* @__PURE__ */ jsx(SidebarLink, { item: it, onNavigate: () => setOpen(false) }, it.label)) })
      ] }, g.title)) })
    ] }),
    open && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-30 bg-black/20 lg:hidden", onClick: () => setOpen(false) }),
    /* @__PURE__ */ jsxs("div", { className: "lg:pl-60", children: [
      /* @__PURE__ */ jsx("header", { className: "sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-xl", children: /* @__PURE__ */ jsxs("div", { className: "flex h-16 items-center justify-between gap-3 px-5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
          /* @__PURE__ */ jsx("button", { className: "rounded-lg p-2 text-fg-muted hover:bg-bg-mute lg:hidden", onClick: () => setOpen(!open), children: /* @__PURE__ */ jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: /* @__PURE__ */ jsx("path", { d: "M4 7h16M4 12h16M4 17h16" }) }) }),
          /* @__PURE__ */ jsx(WorkspaceSwitcher, {}),
          /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })),
              className: "hidden items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-fg-dim hover:border-brand/40 hover:text-fg md:flex",
              title: "Search (Ctrl/Cmd + K)",
              children: [
                /* @__PURE__ */ jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
                  /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "7" }),
                  /* @__PURE__ */ jsx("path", { d: "M21 21l-4.3-4.3" })
                ] }),
                "Search ",
                /* @__PURE__ */ jsx("kbd", { className: "rounded border border-line px-1 py-0.5 text-[9px]", children: "⌘K" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
          (user == null ? void 0 : user.is_staff) && /* @__PURE__ */ jsx(Link, { to: "/admin", className: "rounded-lg bg-navy-900 px-3 py-1.5 font-semibold text-white hover:opacity-90", children: "Admin" }),
          /* @__PURE__ */ jsx("span", { className: "hidden text-fg-muted sm:block", children: user == null ? void 0 : user.email }),
          /* @__PURE__ */ jsx(Button, { variant: "outline", onClick: logout, children: "Sign out" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("main", { className: "mx-auto max-w-6xl px-5 py-8", children: /* @__PURE__ */ jsx(AccessGate, { children: /* @__PURE__ */ jsx(Outlet, {}) }) })
    ] }),
    /* @__PURE__ */ jsx(HelpChat, {}),
    /* @__PURE__ */ jsx(CommandPalette, {})
  ] }) }) });
}
export {
  DashboardLayout as default
};

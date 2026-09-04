var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsx, Fragment, jsxs } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server.mjs";
import { createContext, useContext, useState, useEffect, lazy, Suspense } from "react";
import { useLocation, Navigate, Link, NavLink, Outlet, useSearchParams, Routes, Route } from "react-router-dom";
const ACCESS = "bl_access";
const REFRESH = "bl_refresh";
const tokens = {
  get access() {
    return localStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH);
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  }
};
function errText(data, fallback = "Something went wrong. Please try again.") {
  if (data == null) return fallback;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data)) return typeof data[0] === "string" ? data[0] : fallback;
  for (const k of Object.keys(data)) {
    const v = data[k];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  }
  return fallback;
}
class ApiError extends Error {
  constructor(status, data) {
    super(errText(data, "Request failed"));
    __publicField(this, "status");
    __publicField(this, "data");
    this.status = status;
    this.data = data;
  }
}
async function raw(path, opts = {}) {
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (opts.auth !== false && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  return fetch(`/api${path}`, { ...opts, headers });
}
let refreshInFlight = null;
function refreshAccess() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const r = await raw("/auth/token/refresh/", {
          method: "POST",
          auth: false,
          body: JSON.stringify({ refresh: tokens.refresh })
        });
        if (r.ok) {
          const { access } = await r.json();
          tokens.set({ access });
          return true;
        }
        if (r.status === 401) tokens.clear();
        return false;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}
async function request(path, opts = {}) {
  let res = await raw(path, opts);
  if (res.status === 401 && tokens.refresh && opts.auth !== false) {
    if (await refreshAccess()) {
      res = await raw(path, opts);
    }
  }
  const text = await res.text();
  const data = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  })() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
const http = {
  get: (p) => request(p),
  post: (p, body, auth = true) => request(p, { method: "POST", body: body ? JSON.stringify(body) : void 0, auth }),
  patch: (p, body) => request(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: (p) => request(p, { method: "DELETE" })
};
const authApi = {
  login: (email, password) => http.post("/auth/token/", { email, password }, false),
  register: (payload) => http.post("/auth/register/", payload, false),
  me: () => http.get("/auth/me/"),
  forgotPassword: (email) => http.post("/auth/password/forgot/", { email }, false),
  resetPassword: (token, password) => http.post("/auth/password/reset/", { token, password }, false),
  verifyEmail: (token) => http.post("/auth/email/verify/", { token }, false),
  resendVerification: () => http.post("/auth/email/resend/", {}),
  updateProfile: (patch) => http.patch("/auth/me/", patch),
  changePassword: (current_password, new_password) => http.post("/auth/password/change/", { current_password, new_password })
};
const orgApi = {
  list: () => http.get("/organizations/"),
  create: (name) => http.post("/organizations/", { name }),
  members: (orgId) => http.get(`/organizations/${orgId}/members/`),
  invite: (orgId, email, role) => http.post(`/organizations/${orgId}/invitations/`, { email, role }),
  changeRole: (orgId, memberId, role) => http.patch(`/organizations/${orgId}/members/${memberId}/`, { role }),
  removeMember: (orgId, memberId) => http.del(`/organizations/${orgId}/members/${memberId}/`),
  acceptInvite: (token) => http.post("/organizations/invitations/accept/", { token }),
  invitations: (orgId) => http.get(`/organizations/${orgId}/invitations/`)
};
const websiteApi = {
  list: (orgId) => http.get(`/websites/?organization=${orgId}`),
  get: (id) => http.get(`/websites/${id}/`),
  create: (payload) => http.post("/websites/", payload),
  update: (id, payload) => http.patch(`/websites/${id}/`, payload),
  remove: (id) => http.del(`/websites/${id}/`),
  verify: (id) => http.post(`/websites/${id}/verify/`),
  verifyShield: (id) => http.post(`/websites/${id}/verify-shield/`)
};
const linkApi = {
  list: (orgId) => http.get(`/links/?organization=${orgId}`),
  create: (p) => http.post("/links/", p),
  update: (id, p) => http.patch(`/links/${id}/`, p),
  remove: (id) => http.del(`/links/${id}/`)
};
const campaignApi = {
  list: (orgId) => http.get(`/campaigns/?organization=${orgId}`),
  get: (id) => http.get(`/campaigns/${id}/`),
  create: (p) => http.post("/campaigns/", p),
  update: (id, p) => http.patch(`/campaigns/${id}/`, p),
  remove: (id) => http.del(`/campaigns/${id}/`),
  stats: (id) => http.get(`/campaigns/${id}/stats/`),
  variantStats: (id) => http.get(`/campaigns/${id}/variant-stats/`),
  scanUrl: (id) => http.post(`/campaigns/${id}/scan-url/`, {})
};
const variantApi = {
  list: (campaignId) => http.get(`/campaigns/variants/?campaign=${campaignId}`),
  create: (p) => http.post("/campaigns/variants/", p),
  update: (id, p) => http.patch(`/campaigns/variants/${id}/`, p),
  remove: (id) => http.del(`/campaigns/variants/${id}/`)
};
const RULE_FIELDS = [
  ["risk_score", "Risk score"],
  ["requests_per_min", "Requests per minute"],
  ["classification", "Classification"],
  ["country", "Country"],
  ["device", "Device"],
  ["browser", "Browser"],
  ["os", "OS"],
  ["is_bot", "Bot detected"],
  ["is_proxy", "Proxy/Datacenter"],
  ["utm_source", "UTM source"],
  ["utm_medium", "UTM medium"],
  ["utm_campaign", "UTM campaign"],
  ["referrer", "Referrer"],
  ["ja3", "TLS/JA3 hash"],
  ["path", "URL path"]
];
const RULE_OPS = [
  ["eq", "is"],
  ["ne", "is not"],
  ["gt", "is more than"],
  ["gte", "is at least"],
  ["lt", "is less than"],
  ["lte", "is at most"],
  ["contains", "contains"],
  ["in", "is any of"]
];
const FIELD_VALUE_OPTIONS = {
  device: [["mobile", "Mobile"], ["desktop", "Desktop"], ["tablet", "Tablet"]],
  os: [["windows", "Windows"], ["macos", "macOS"], ["ios", "iOS"], ["android", "Android"], ["linux", "Linux"]],
  browser: [["chrome", "Chrome"], ["safari", "Safari"], ["firefox", "Firefox"], ["edge", "Edge"], ["opera", "Opera"]],
  classification: [["human", "Human"], ["suspicious", "Suspicious"], ["bot", "Bot"], ["fraud", "Fraud"]],
  is_bot: [["1", "Yes"], ["0", "No"]],
  is_proxy: [["1", "Yes"], ["0", "No"]]
};
const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NL", "Netherlands"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["IN", "India"],
  ["NG", "Nigeria"],
  ["ZA", "South Africa"],
  ["RU", "Russia"],
  ["UA", "Ukraine"],
  ["CN", "China"],
  ["JP", "Japan"],
  ["KR", "South Korea"],
  ["ID", "Indonesia"],
  ["PH", "Philippines"],
  ["TR", "Turkey"],
  ["PL", "Poland"],
  ["SE", "Sweden"]
];
const ipFilterApi = {
  list: (orgId) => http.get(`/rules/ip-filters/?organization=${orgId}`),
  create: (p) => http.post("/rules/ip-filters/", p),
  update: (id, p) => http.patch(`/rules/ip-filters/${id}/`, p),
  remove: (id) => http.del(`/rules/ip-filters/${id}/`)
};
const ruleApi = {
  list: (orgId) => http.get(`/rules/?organization=${orgId}`),
  create: (p) => http.post("/rules/", p),
  update: (id, p) => http.patch(`/rules/${id}/`, p),
  remove: (id) => http.del(`/rules/${id}/`)
};
const qs = (o) => Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
const analyticsApi = {
  overview: (orgId, range = "7d") => http.get(`/analytics/overview/?${qs({ organization: orgId, range })}`),
  visitors: (orgId, params = {}) => http.get(`/analytics/visitors/?${qs({ organization: orgId, ...params })}`),
  visitor: (id) => http.get(`/analytics/visitors/${id}/`),
  events: (orgId, params = {}) => http.get(`/analytics/events/?${qs({ organization: orgId, ...params })}`),
  sources: (orgId, range = "7d") => http.get(`/analytics/sources/?${qs({ organization: orgId, range })}`),
  report: (orgId, dimension, range = "7d") => http.get(`/analytics/report/?${qs({ organization: orgId, dimension, range })}`)
};
async function downloadReportCsv(orgId, dimension, range) {
  const res = await fetch(`/api/analytics/report/?${qs({ organization: orgId, dimension, range, export: "csv" })}`, {
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${dimension}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
const conversionsApi = {
  get: (orgId, range = "7d") => http.get(`/analytics/conversions/?${qs({ organization: orgId, range })}`)
};
const keysApi = {
  list: (orgId) => http.get(`/integrations/keys/?organization=${orgId}`),
  create: (orgId, name) => http.post("/integrations/keys/", { organization: orgId, name }),
  revoke: (id) => http.del(`/integrations/keys/${id}/`)
};
const webhookApi = {
  list: (orgId) => http.get(`/integrations/webhooks/?organization=${orgId}`),
  create: (p) => http.post("/integrations/webhooks/", p),
  update: (id, p) => http.patch(`/integrations/webhooks/${id}/`, p),
  remove: (id) => http.del(`/integrations/webhooks/${id}/`),
  test: (id) => http.post(`/integrations/webhooks/${id}/test/`),
  deliveries: (id) => http.get(`/integrations/webhooks/${id}/deliveries/`),
  events: () => http.get("/integrations/events/")
};
const billingApi = {
  plans: () => http.get("/billing/plans/"),
  subscription: (orgId) => http.get(`/billing/subscription/?organization=${orgId}`),
  changePlan: (orgId, plan) => http.post("/billing/subscription/change/", { organization: orgId, plan }),
  checkout: (orgId, plan) => http.post("/billing/checkout/", { organization: orgId, plan }),
  cancel: (orgId) => http.post("/billing/subscription/cancel/", { organization: orgId }),
  usage: (orgId) => http.get(`/billing/usage/?organization=${orgId}`)
};
const adminApi = {
  overview: () => http.get("/admin/overview/"),
  users: () => http.get("/admin/users/"),
  organizations: () => http.get("/admin/organizations/"),
  subscriptions: () => http.get("/admin/subscriptions/"),
  fraudAlerts: () => http.get("/admin/fraud-alerts/"),
  grantPlan: (organization, plan) => http.post("/admin/grant-plan/", { organization, plan })
};
const botCheckApi = {
  run: (url) => http.post("/v1/bot-check/", { url }, false)
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Ctx$1 = createContext(null);
const useAuth = () => useContext(Ctx$1);
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  async function refreshUser() {
    if (!tokens.access) {
      setUser(null);
      return;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        setUser(await authApi.me());
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          setUser(null);
          tokens.clear();
          return;
        }
        if (attempt < 2) {
          await sleep(600 * (attempt + 1));
          continue;
        }
        setUser(null);
        return;
      }
    }
  }
  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);
  async function login(email, password) {
    const t = await authApi.login(email, password);
    tokens.set(t);
    await refreshUser();
  }
  async function register(p) {
    await authApi.register(p);
    await login(p.email, p.password);
  }
  function logout() {
    tokens.clear();
    setUser(null);
  }
  return /* @__PURE__ */ jsx(Ctx$1.Provider, { value: { user, loading, login, register, logout, refreshUser }, children });
}
const KEY = "bl_org";
const Ctx = createContext(null);
const useWorkspace = () => useContext(Ctx);
function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [currentId, setCurrentId] = useState(() => {
    try {
      return Number(localStorage.getItem(KEY)) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  async function reload() {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await orgApi.list();
      const list = Array.isArray(res) ? res : res.results;
      setOrgs(list);
      setCurrentId((prev) => {
        var _a;
        return list.find((o) => o.id === prev) ? prev : ((_a = list[0]) == null ? void 0 : _a.id) ?? null;
      });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, [user]);
  useEffect(() => {
    if (currentId) localStorage.setItem(KEY, String(currentId));
  }, [currentId]);
  const current = orgs.find((o) => o.id === currentId) ?? null;
  return /* @__PURE__ */ jsx(Ctx.Provider, { value: { orgs, current, loading, switchTo: setCurrentId, reload }, children });
}
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "grid min-h-screen place-items-center bg-bg", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  }
  if (!user) return /* @__PURE__ */ jsx(Navigate, { to: "/login", state: { from: loc.pathname }, replace: true });
  return /* @__PURE__ */ jsx(Fragment, { children });
}
function RequireStaff({ children }) {
  const { user, loading } = useAuth();
  if (loading) return /* @__PURE__ */ jsx("div", { className: "grid min-h-screen place-items-center bg-bg", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
  if (!user) return /* @__PURE__ */ jsx(Navigate, { to: "/login", replace: true });
  if (!user.is_staff) return /* @__PURE__ */ jsx(Navigate, { to: "/dashboard", replace: true });
  return /* @__PURE__ */ jsx(Fragment, { children });
}
const BRAND$1 = {
  name: "TryNoBot",
  tagline: "See every visitor. Score every click. Protect every campaign.",
  subtitle: "Analyze, score and protect incoming traffic with real-time visitor intelligence, fraud detection and campaign analytics."
};
const NAV_LINKS = [
  { label: "Features", to: "/features" },
  { label: "Fraud Detection", to: "/fraud-detection" },
  { label: "Analytics", to: "/analytics" },
  { label: "Integrations", to: "/integrations" },
  { label: "Bot Check", to: "/bot-check" },
  { label: "Pricing", to: "/pricing" },
  { label: "Docs", to: "/docs" }
];
const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Traffic Intelligence", to: "/traffic-intelligence" },
      { label: "Fraud Detection", to: "/fraud-detection" },
      { label: "Analytics", to: "/analytics" },
      { label: "Bot Check", to: "/bot-check" },
      { label: "Pricing", to: "/pricing" }
    ]
  },
  {
    title: "Developers",
    links: [
      { label: "API", to: "/api" },
      { label: "Documentation", to: "/docs" },
      { label: "Integrations", to: "/integrations" },
      { label: "Status", to: "/status" }
    ]
  },
  {
    title: "Company",
    links: [
      { label: "Contact", to: "/contact" },
      { label: "FAQ", to: "/faq" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      // Discoverable abuse reporting: a complainant who can't find this goes
      // to our registrar instead, and the whole short domain gets suspended.
      { label: "Report abuse", to: "/report" }
    ]
  }
];
function Logo({ light = false, className = "" }) {
  return /* @__PURE__ */ jsxs(Link, { to: "/", className: `inline-flex items-center gap-2.5 ${className}`, children: [
    /* @__PURE__ */ jsx("span", { className: "grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-brand to-violet shadow-[0_8px_20px_-8px_rgba(37,99,235,.8)]", children: /* @__PURE__ */ jsxs("svg", { width: "21", height: "21", viewBox: "0 0 24 24", fill: "none", children: [
      /* @__PURE__ */ jsx(
        "path",
        {
          d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z",
          fill: "white",
          fillOpacity: "0.15",
          stroke: "white",
          strokeWidth: "1.7",
          strokeLinejoin: "round"
        }
      ),
      /* @__PURE__ */ jsx(
        "polyline",
        {
          points: "6.5,12 9,12 11,8.5 13,15.5 15,12 17.5,12",
          fill: "none",
          stroke: "white",
          strokeWidth: "1.9",
          strokeLinecap: "round",
          strokeLinejoin: "round"
        }
      )
    ] }) }),
    /* @__PURE__ */ jsx("span", { className: `text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-fg"}`, children: BRAND$1.name })
  ] });
}
const styles = {
  primary: "bg-brand text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,.7)] hover:bg-brand-600",
  outline: "border border-line bg-white text-fg hover:border-brand/50 hover:text-brand",
  ghost: "text-fg-muted hover:text-fg hover:bg-bg-mute",
  light: "bg-white/10 text-white border border-white/25 hover:bg-white/20 backdrop-blur"
};
function Button({
  children,
  to,
  href,
  variant = "primary",
  className = "",
  onClick,
  type,
  size = "md",
  disabled = false
}) {
  const pad = size === "lg" ? "px-7 py-3.5 text-[15px]" : "px-5 py-2.5 text-sm";
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition ${pad} ${styles[variant]} ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`;
  if (to) return /* @__PURE__ */ jsx(Link, { to, className: cls, children });
  if (href) return /* @__PURE__ */ jsx("a", { href, className: cls, children });
  return /* @__PURE__ */ jsx("button", { type: type ?? "button", onClick, disabled, className: cls, children });
}
function Navbar() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return /* @__PURE__ */ jsxs("header", { className: "sticky top-0 z-50 border-b border-line bg-white/85 backdrop-blur-xl", children: [
    /* @__PURE__ */ jsxs("div", { className: "container-page flex h-16 items-center justify-between", children: [
      /* @__PURE__ */ jsx(Logo, {}),
      /* @__PURE__ */ jsx("nav", { className: "absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex", children: NAV_LINKS.map((l) => /* @__PURE__ */ jsx(
        NavLink,
        {
          to: l.to,
          className: ({ isActive }) => `rounded-full px-3.5 py-2 text-sm font-medium transition ${isActive ? "text-brand" : "text-fg-muted hover:text-fg"}`,
          children: l.label
        },
        l.to
      )) }),
      /* @__PURE__ */ jsx("div", { className: "hidden items-center gap-2 lg:flex", children: user ? /* @__PURE__ */ jsx(Button, { to: "/dashboard", children: "Go to dashboard" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { to: "/login", variant: "ghost", children: "Sign in" }),
        /* @__PURE__ */ jsx(Button, { to: "/signup", children: "Start Free" })
      ] }) }),
      /* @__PURE__ */ jsx("button", { className: "lg:hidden rounded-lg p-2 text-fg-muted hover:bg-bg-mute", onClick: () => setOpen(!open), "aria-label": "Menu", children: /* @__PURE__ */ jsx("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", children: /* @__PURE__ */ jsx("path", { d: "M4 7h16M4 12h16M4 17h16" }) }) })
    ] }),
    open && /* @__PURE__ */ jsx("div", { className: "border-t border-line lg:hidden", children: /* @__PURE__ */ jsxs("div", { className: "container-page flex flex-col gap-1 py-3", children: [
      NAV_LINKS.map((l) => /* @__PURE__ */ jsx(Link, { to: l.to, onClick: () => setOpen(false), className: "rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-bg-mute hover:text-fg", children: l.label }, l.to)),
      /* @__PURE__ */ jsx("div", { className: "mt-2 flex gap-2", children: user ? /* @__PURE__ */ jsx(Button, { to: "/dashboard", className: "flex-1", children: "Go to dashboard" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx(Button, { to: "/login", variant: "outline", className: "flex-1", children: "Sign in" }),
        /* @__PURE__ */ jsx(Button, { to: "/signup", className: "flex-1", children: "Start Free" })
      ] }) })
    ] }) })
  ] });
}
function Footer() {
  return /* @__PURE__ */ jsxs("footer", { className: "border-t border-line bg-bg-soft", children: [
    /* @__PURE__ */ jsxs("div", { className: "container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(Logo, {}),
        /* @__PURE__ */ jsx("p", { className: "mt-4 max-w-xs text-sm leading-relaxed text-fg-muted", children: BRAND$1.tagline })
      ] }),
      FOOTER_COLS.map((col) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h4", { className: "text-sm font-bold text-fg", children: col.title }),
        /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-2", children: col.links.map((l) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, { to: l.to, className: "text-sm text-fg-muted hover:text-brand", children: l.label }) }, l.to)) })
      ] }, col.title))
    ] }),
    /* @__PURE__ */ jsx("div", { className: "border-t border-line", children: /* @__PURE__ */ jsxs("div", { className: "container-page flex flex-col items-center justify-between gap-3 py-6 text-sm text-fg-dim sm:flex-row", children: [
      /* @__PURE__ */ jsxs("span", { children: [
        "© ",
        (/* @__PURE__ */ new Date()).getFullYear(),
        " ",
        BRAND$1.name,
        ". All rights reserved."
      ] }),
      /* @__PURE__ */ jsx("span", { children: "Built for performance marketers, media buyers & agencies." })
    ] }) })
  ] });
}
function MarketingLayout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-screen flex-col bg-bg", children: [
    /* @__PURE__ */ jsx(Navbar, {}),
    /* @__PURE__ */ jsx("main", { className: "flex-1", children: /* @__PURE__ */ jsx(Outlet, {}) }),
    /* @__PURE__ */ jsx(Footer, {})
  ] });
}
const BRAND = "TryNoBot";
function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
function useSeo(title, description) {
  useEffect(() => {
    const full = `${title} · ${BRAND}`;
    document.title = full;
    setMeta("name", "description", description);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", "website");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", full);
    setMeta("name", "twitter:description", description);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = window.location.origin + window.location.pathname;
  }, [title, description]);
}
function useReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal:not(.is-in)"));
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
function SectionHead({ eyebrow, title, sub, center = true }) {
  return /* @__PURE__ */ jsxs("div", { className: `${center ? "mx-auto text-center" : ""} max-w-2xl`, children: [
    eyebrow && /* @__PURE__ */ jsx("div", { className: "mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand", children: eyebrow }),
    /* @__PURE__ */ jsx("h2", { className: "text-3xl font-extrabold tracking-tight text-fg sm:text-[2.5rem] sm:leading-[1.1]", children: title }),
    sub && /* @__PURE__ */ jsx("p", { className: "mt-4 text-base leading-relaxed text-fg-muted", children: sub })
  ] });
}
function Section({ children, className = "" }) {
  return /* @__PURE__ */ jsx("section", { className: `container-page py-20 sm:py-24 ${className}`, children });
}
const PLATFORMS = ["Google Ads", "Meta", "TikTok", "Microsoft Ads", "X Ads", "Yandex", "Taboola", "Outbrain"];
function LogoStrip({ title = "Works across every major traffic source" }) {
  return /* @__PURE__ */ jsxs("div", { className: "container-page py-12", children: [
    /* @__PURE__ */ jsx("p", { className: "text-center text-xs font-semibold uppercase tracking-[0.2em] text-fg-dim", children: title }),
    /* @__PURE__ */ jsx("div", { className: "mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5", children: PLATFORMS.map((p) => /* @__PURE__ */ jsx("span", { className: "text-lg font-bold tracking-tight text-fg-dim/80 grayscale transition hover:text-fg", children: p }, p)) })
  ] });
}
const bars = [38, 52, 44, 61, 55, 72, 66, 80, 74, 88, 83, 95];
function DashboardPreview() {
  return /* @__PURE__ */ jsx("div", { className: "rounded-2xl border border-white/10 bg-navy-800/70 p-3 shadow-2xl backdrop-blur", children: /* @__PURE__ */ jsxs("div", { className: "rounded-xl bg-white p-4 text-fg shadow-soft", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("div", { className: "text-[11px] font-semibold uppercase tracking-wider text-fg-dim", children: "Live overview" }),
        /* @__PURE__ */ jsx("div", { className: "text-sm font-bold", children: "Traffic quality — last 24h" })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700", children: [
        /* @__PURE__ */ jsx("span", { className: "h-1.5 w-1.5 animate-pulse rounded-full bg-success" }),
        " Live"
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 grid grid-cols-3 gap-2", children: [
      { k: "Visitors", v: "48,201", d: "+12.4%", tone: "text-emerald-600" },
      { k: "Quality", v: "92.7%", d: "+3.1%", tone: "text-emerald-600" },
      { k: "Fraud blocked", v: "1,842", d: "+8.0%", tone: "text-brand" }
    ].map((s2) => /* @__PURE__ */ jsxs("div", { className: "rounded-lg border border-line bg-bg-soft p-2.5", children: [
      /* @__PURE__ */ jsx("div", { className: "text-[10px] font-medium text-fg-dim", children: s2.k }),
      /* @__PURE__ */ jsx("div", { className: "text-base font-extrabold leading-tight", children: s2.v }),
      /* @__PURE__ */ jsx("div", { className: `text-[10px] font-semibold ${s2.tone}`, children: s2.d })
    ] }, s2.k)) }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 flex h-24 items-end gap-1.5 rounded-lg border border-line bg-bg-soft px-3 pb-3 pt-2", children: bars.map((h, i) => /* @__PURE__ */ jsx("div", { className: "flex-1 rounded-t bg-gradient-to-t from-brand/40 to-brand", style: { height: `${h}%` } }, i)) }),
    /* @__PURE__ */ jsx("div", { className: "mt-3 space-y-1.5", children: [
      { c: "US · Chrome · Desktop", s: 12, t: "Human", cls: "bg-success/10 text-emerald-700" },
      { c: "DE · Headless · Datacenter", s: 88, t: "Bot", cls: "bg-danger/10 text-red-600" },
      { c: "BR · Safari · Mobile", s: 47, t: "Suspicious", cls: "bg-warning/10 text-amber-700" }
    ].map((r) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-[11px]", children: [
      /* @__PURE__ */ jsx("span", { className: "text-fg-muted", children: r.c }),
      /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("span", { className: "font-mono font-bold", children: r.s }),
        /* @__PURE__ */ jsx("span", { className: `rounded-full px-2 py-0.5 font-semibold ${r.cls}`, children: r.t })
      ] })
    ] }, r.c)) })
  ] }) });
}
function HeroCarousel({ slides, interval = 5500 }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (n) => setI((n + slides.length) % slides.length);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [paused, slides.length, interval]);
  const s2 = slides[i];
  return /* @__PURE__ */ jsxs("div", { className: "relative", onMouseEnter: () => setPaused(true), onMouseLeave: () => setPaused(false), children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        "aria-label": "Previous",
        onClick: () => go(i - 1),
        className: "absolute -left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-2 text-white/70 backdrop-blur transition hover:bg-white/15 hover:text-white sm:block lg:-left-10",
        children: /* @__PURE__ */ jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M15 6l-6 6 6 6" }) })
      }
    ),
    /* @__PURE__ */ jsx(
      "button",
      {
        "aria-label": "Next",
        onClick: () => go(i + 1),
        className: "absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-2 text-white/70 backdrop-blur transition hover:bg-white/15 hover:text-white sm:block lg:-right-10",
        children: /* @__PURE__ */ jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M9 6l6 6-6 6" }) })
      }
    ),
    /* @__PURE__ */ jsxs("div", { className: "fade-up min-h-[220px]", children: [
      /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur", children: [
        /* @__PURE__ */ jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-cyan" }),
        " ",
        s2.badge
      ] }),
      /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]", children: s2.title }),
      /* @__PURE__ */ jsx("p", { className: "mt-6 max-w-xl text-lg leading-relaxed text-slate-300", children: s2.subtitle })
    ] }, i),
    /* @__PURE__ */ jsx("div", { className: "mt-7 flex gap-2", children: slides.map((_, n) => /* @__PURE__ */ jsx(
      "button",
      {
        "aria-label": `Slide ${n + 1}`,
        onClick: () => go(n),
        className: `h-1.5 rounded-full transition-all ${n === i ? "w-8 bg-white" : "w-4 bg-white/30 hover:bg-white/50"}`
      },
      n
    )) })
  ] });
}
const s = (p) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  ...p
});
const IShield = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" }),
  /* @__PURE__ */ jsx("path", { d: "M9 12l2 2 4-4" })
] });
const IRadar = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "4.5" }),
  /* @__PURE__ */ jsx("path", { d: "M12 12l6-3" })
] });
const IGauge = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M12 13l4-3" }),
  /* @__PURE__ */ jsx("path", { d: "M4 15a8 8 0 1 1 16 0" }),
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "13", r: "1.4" })
] });
const IChart = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M4 20V4" }),
  /* @__PURE__ */ jsx("path", { d: "M4 20h16" }),
  /* @__PURE__ */ jsx("path", { d: "M8 16v-4M12 16V8M16 16v-7" })
] });
const ITarget = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "8" }),
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" }),
  /* @__PURE__ */ jsx("path", { d: "M12 2v3M12 19v3M2 12h3M19 12h3" })
] });
const IBolt = (p) => /* @__PURE__ */ jsx("svg", { ...s(p), children: /* @__PURE__ */ jsx("path", { d: "M13 2L4 14h6l-1 8 9-12h-6z" }) });
const IPlug = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M9 2v6M15 2v6" }),
  /* @__PURE__ */ jsx("path", { d: "M7 8h10v3a5 5 0 0 1-10 0z" }),
  /* @__PURE__ */ jsx("path", { d: "M12 16v6" })
] });
const ICheck = (p) => /* @__PURE__ */ jsx("svg", { ...s(p), children: /* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5" }) });
const IArrow = (p) => /* @__PURE__ */ jsx("svg", { ...s(p), children: /* @__PURE__ */ jsx("path", { d: "M5 12h14M13 6l6 6-6 6" }) });
const IGlobe = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "9" }),
  /* @__PURE__ */ jsx("path", { d: "M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" })
] });
const ICode = (p) => /* @__PURE__ */ jsx("svg", { ...s(p), children: /* @__PURE__ */ jsx("path", { d: "M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12" }) });
const IServer = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("rect", { x: "4", y: "4", width: "16", height: "7", rx: "1.5" }),
  /* @__PURE__ */ jsx("rect", { x: "4", y: "13", width: "16", height: "7", rx: "1.5" }),
  /* @__PURE__ */ jsx("path", { d: "M7.5 7.5h.01M7.5 16.5h.01" })
] });
const IShieldGold = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z", fill: "#f59e0b", stroke: "#d97706" }),
  /* @__PURE__ */ jsx("path", { d: "M9 12l2 2 4-4", stroke: "#fff" })
] });
const IHome = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M3 11l9-8 9 8" }),
  /* @__PURE__ */ jsx("path", { d: "M5 10v10h14V10" })
] });
const IFilter = (p) => /* @__PURE__ */ jsx("svg", { ...s(p), children: /* @__PURE__ */ jsx("path", { d: "M4 6h16M7 12h10M10 18h4" }) });
const ILink = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M9 15l6-6" }),
  /* @__PURE__ */ jsx("path", { d: "M11 6l1-1a4 4 0 0 1 6 6l-1 1" }),
  /* @__PURE__ */ jsx("path", { d: "M13 18l-1 1a4 4 0 0 1-6-6l1-1" })
] });
const IUsers = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "9", cy: "8", r: "3" }),
  /* @__PURE__ */ jsx("path", { d: "M3 20a6 6 0 0 1 12 0" }),
  /* @__PURE__ */ jsx("path", { d: "M16 5.5a3 3 0 0 1 0 5.5" }),
  /* @__PURE__ */ jsx("path", { d: "M18.5 20a6 6 0 0 0-3-5" })
] });
const IList = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("path", { d: "M8 6h13M8 12h13M8 18h13" }),
  /* @__PURE__ */ jsx("circle", { cx: "4", cy: "6", r: "1" }),
  /* @__PURE__ */ jsx("circle", { cx: "4", cy: "12", r: "1" }),
  /* @__PURE__ */ jsx("circle", { cx: "4", cy: "18", r: "1" })
] });
const IKey = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "8", cy: "15", r: "4" }),
  /* @__PURE__ */ jsx("path", { d: "M10.8 12.2L20 3" }),
  /* @__PURE__ */ jsx("path", { d: "M16 5l2 2" })
] });
const ICard = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("rect", { x: "3", y: "6", width: "18", height: "12", rx: "2" }),
  /* @__PURE__ */ jsx("path", { d: "M3 10h18" })
] });
const IGear = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" }),
  /* @__PURE__ */ jsx("path", { d: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" })
] });
const IFunnel = (p) => /* @__PURE__ */ jsx("svg", { ...s(p), children: /* @__PURE__ */ jsx("path", { d: "M3 5h18l-7 8v6l-4-2v-4z" }) });
const ISources = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("circle", { cx: "6", cy: "12", r: "2.5" }),
  /* @__PURE__ */ jsx("circle", { cx: "18", cy: "6", r: "2.5" }),
  /* @__PURE__ */ jsx("circle", { cx: "18", cy: "18", r: "2.5" }),
  /* @__PURE__ */ jsx("path", { d: "M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" })
] });
const ILock = (p) => /* @__PURE__ */ jsxs("svg", { ...s(p), children: [
  /* @__PURE__ */ jsx("rect", { x: "5", y: "11", width: "14", height: "9", rx: "2" }),
  /* @__PURE__ */ jsx("path", { d: "M8 11V8a4 4 0 0 1 8 0v3" }),
  /* @__PURE__ */ jsx("path", { d: "M12 15v2" })
] });
const FEATURES = [
  { icon: IRadar, title: "Traffic Intelligence", desc: "See every visitor and session with rich device, network and geo signals in real time." },
  { icon: IShield, title: "Fraud Detection", desc: "Catch bots, datacenter IPs, proxies and automation before they burn your budget." },
  { icon: IGauge, title: "Risk Scoring", desc: "Every click gets a transparent 0–100 score with the exact signals that drove it." },
  { icon: IChart, title: "Campaign Analytics", desc: "Break down quality, sources, geos and devices with fast, filterable reports." },
  { icon: ITarget, title: "Conversion Tracking", desc: "Attribute conversions and revenue back to campaigns and traffic quality." },
  { icon: IBolt, title: "Real-Time Monitoring", desc: "A live traffic feed with instant classification and rule actions as clicks land." },
  { icon: IServer, title: "Server-Side Shield", desc: "Block bots before your page even loads — enforce your rules at your server or edge with a drop-in snippet for PHP, Django, nginx, Cloudflare or Node." },
  { icon: ILock, title: "Folder Guard", desc: "Lock down sensitive pages like /admin, /wp-login or /downloads so bots and fraud can't reach them at all." },
  { icon: ILink, title: "Link Shortener", desc: "Branded short links that score every click — real people reach your page, bots hit a decoy, a 404 or your site's own Traffic Rules." }
];
const STEPS = [
  ["Connect your website", "Add a site and get a unique tracking ID in seconds."],
  ["Install tracking", "Drop one async script tag — it never blocks page load."],
  ["Analyze traffic", "We extract 40+ signals from every visit and session."],
  ["Score visitors", "Each visitor is scored and classified in milliseconds."],
  ["Protect campaigns", "Apply rules: allow, review, block or tag automatically."],
  ["Measure conversions", "Tie revenue back to the traffic that actually converts."]
];
const METRICS = [
  ["120M+", "Visitors analyzed"],
  ["3.4B", "Signals processed"],
  ["<8ms", "Avg processing time"],
  ["92.7%", "Median traffic quality"]
];
const SLIDES = [
  {
    badge: "Real-time traffic intelligence",
    title: /* @__PURE__ */ jsxs(Fragment, { children: [
      "See every visitor.",
      /* @__PURE__ */ jsx("br", {}),
      "Score every click.",
      /* @__PURE__ */ jsx("br", {}),
      /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "Protect every campaign." })
    ] }),
    subtitle: BRAND$1.subtitle
  },
  {
    badge: "Fraud detection",
    title: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Stop paying",
      /* @__PURE__ */ jsx("br", {}),
      "for ",
      /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "bot traffic." })
    ] }),
    subtitle: "Detect datacenter IPs, proxies, VPNs and automation before they drain your ad budget — with transparent, explainable scoring."
  },
  {
    badge: "Explainable risk scoring",
    title: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Know your traffic",
      /* @__PURE__ */ jsx("br", {}),
      "quality ",
      /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "in real time." })
    ] }),
    subtitle: "Every visit is scored 0–100 and classified as Human, Suspicious, Bot or Fraud, with the exact signals that drove the decision."
  },
  {
    badge: "Conversion tracking",
    title: /* @__PURE__ */ jsxs(Fragment, { children: [
      "Measure what",
      /* @__PURE__ */ jsx("br", {}),
      "actually ",
      /* @__PURE__ */ jsx("span", { className: "text-gradient", children: "converts." })
    ] }),
    subtitle: "Attribute conversions and revenue back to campaigns, sources and traffic quality — and double down on what works."
  }
];
function Landing() {
  useSeo("Real-time traffic intelligence & bot detection", "Score every visitor, block bots and fraud, and protect your ad campaigns in real time with TryNoBot.");
  useReveal();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx(HeroCarousel, { slides: SLIDES }),
          /* @__PURE__ */ jsxs("div", { className: "mt-8 flex flex-wrap gap-3", children: [
            /* @__PURE__ */ jsxs(Button, { to: "/signup", size: "lg", children: [
              "Start Free ",
              /* @__PURE__ */ jsx(IArrow, { width: 18 })
            ] }),
            /* @__PURE__ */ jsx(Button, { href: "#demo", variant: "light", size: "lg", children: "View Demo" })
          ] }),
          /* @__PURE__ */ jsx("p", { className: "mt-4 text-sm text-slate-400", children: "No credit card required · 7-day trial · Cancel anytime" })
        ] }),
        /* @__PURE__ */ jsx("div", { id: "demo", className: "fade-up lg:pl-4", children: /* @__PURE__ */ jsx(DashboardPreview, {}) })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "border-b border-line bg-white", children: /* @__PURE__ */ jsx(LogoStrip, {}) }),
    /* @__PURE__ */ jsx(Section, { className: "!py-16", children: /* @__PURE__ */ jsx("div", { className: "grid grid-cols-2 gap-4 lg:grid-cols-4", children: METRICS.map(([v, k], i) => /* @__PURE__ */ jsxs("div", { className: "card card-hover shadow-soft reveal group px-6 py-7 text-center", style: { transitionDelay: `${i * 60}ms` }, children: [
      /* @__PURE__ */ jsx("div", { className: "text-3xl font-extrabold tracking-tight text-fg transition-colors group-hover:text-brand", children: v }),
      /* @__PURE__ */ jsx("div", { className: "mt-1 text-sm text-fg-muted", children: k })
    ] }, k)) }) }),
    /* @__PURE__ */ jsxs(Section, { className: "bg-bg-soft rounded-none", children: [
      /* @__PURE__ */ jsx(
        SectionHead,
        {
          eyebrow: "Platform",
          title: "Everything you need to trust your traffic",
          sub: "One platform to analyze, score, protect and measure the traffic hitting your campaigns."
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: FEATURES.map((f, i) => /* @__PURE__ */ jsxs("div", { className: "feature-card card card-hover shadow-soft reveal group relative overflow-hidden p-6", style: { transitionDelay: `${i * 60}ms` }, children: [
        /* @__PURE__ */ jsx("span", { className: "feature-glow", "aria-hidden": "true" }),
        /* @__PURE__ */ jsx("div", { className: "relative grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand transition-all duration-300 group-hover:scale-110 group-hover:bg-brand group-hover:text-white group-hover:shadow-lg group-hover:shadow-brand/30", children: /* @__PURE__ */ jsx(f.icon, { width: 22 }) }),
        /* @__PURE__ */ jsx("h3", { className: "relative mt-4 text-lg font-bold transition-colors group-hover:text-brand", children: f.title }),
        /* @__PURE__ */ jsx("p", { className: "relative mt-2 text-sm leading-relaxed text-fg-muted", children: f.desc })
      ] }, f.title)) })
    ] }),
    /* @__PURE__ */ jsxs(Section, { children: [
      /* @__PURE__ */ jsx(
        SectionHead,
        {
          eyebrow: "How it works",
          title: "From first click to measured conversion",
          sub: "Go live in minutes. No infrastructure to run, no data pipelines to build."
        }
      ),
      /* @__PURE__ */ jsx("div", { className: "mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: STEPS.map(([t, d], i) => /* @__PURE__ */ jsxs("div", { className: "card card-hover shadow-soft reveal group relative p-6", style: { transitionDelay: `${i * 60}ms` }, children: [
        /* @__PURE__ */ jsx("div", { className: "absolute right-5 top-5 text-4xl font-black text-line transition-colors group-hover:text-brand/30", children: String(i + 1).padStart(2, "0") }),
        /* @__PURE__ */ jsxs("div", { className: "text-sm font-bold text-brand", children: [
          "Step ",
          i + 1
        ] }),
        /* @__PURE__ */ jsx("h3", { className: "mt-2 text-lg font-bold", children: t }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-relaxed text-fg-muted", children: d })
      ] }, t)) })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsxs("div", { className: "hero-band relative overflow-hidden rounded-3xl px-8 py-16 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-60" }),
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx("h2", { className: "mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl", children: "Start understanding your traffic today." }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-slate-300", children: "Join marketers and agencies protecting their budgets with real-time traffic intelligence." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 flex justify-center gap-3", children: [
          /* @__PURE__ */ jsxs(Button, { to: "/signup", size: "lg", children: [
            "Create an account ",
            /* @__PURE__ */ jsx(IArrow, { width: 18 })
          ] }),
          /* @__PURE__ */ jsx(Button, { to: "/pricing", variant: "light", size: "lg", children: "View pricing" })
        ] })
      ] })
    ] }) })
  ] });
}
function Badge({ children, tone = "brand" }) {
  const tones = {
    brand: "border-brand/20 bg-brand/8 text-brand",
    cyan: "border-cyan/25 bg-cyan/10 text-cyan-700",
    green: "border-success/25 bg-success/10 text-emerald-700",
    light: "border-white/25 bg-white/10 text-white backdrop-blur"
  };
  return /* @__PURE__ */ jsx("span", { className: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`, children });
}
const COINS = [
  { s: "₿", n: "Bitcoin", bg: "#f7931a" },
  { s: "Ξ", n: "Ethereum", bg: "#627eea" },
  { s: "₮", n: "Tether", bg: "#26a17b" },
  { s: "$", n: "USDC", bg: "#2775ca" },
  { s: "◈", n: "TON", bg: "#0098ea" }
];
function CryptoIcons() {
  return /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center gap-3", children: COINS.map((c) => /* @__PURE__ */ jsx(
    "span",
    {
      title: c.n,
      className: "grid h-11 w-11 place-items-center rounded-full text-lg font-bold text-white shadow-soft ring-4 ring-white",
      style: { background: c.bg },
      children: c.s
    },
    c.n
  )) });
}
const BASE = [
  "Smart redirects with bot detection on every click",
  "Full anti-bot engine included",
  "Smart shortlinks + custom domain redirects",
  "IP allow / deny rules",
  "Domain health + ownership checks"
];
const PLUS_ADD = [
  "More redirects & domains",
  "Priority support"
];
const PRO_ADD = [
  "Highest redirect & domain limits",
  "Dedicated support"
];
const PLANS = [
  {
    name: "Basic",
    price: 25,
    tag: "Smart redirects with bot detection, for solo buyers",
    cta: "Get Basic",
    redirects: "2",
    domains: "5",
    access: "7 days of access",
    groups: [{ items: BASE }]
  },
  {
    name: "Plus",
    price: 40,
    tag: "More links & domains for growing campaigns",
    cta: "Get Plus",
    highlight: true,
    redirects: "5",
    domains: "10",
    access: "7 days of access",
    groups: [{ items: BASE }, { label: "Everything in Basic, plus:", items: PLUS_ADD, added: true }]
  },
  {
    name: "Pro",
    price: 70,
    tag: "Top limits & dedicated support for agencies",
    cta: "Get Pro",
    ribbon: "TOP VALUE",
    redirects: "10",
    domains: "20",
    access: "7 days of access",
    groups: [
      { items: BASE },
      { label: "Everything in Plus, plus:", items: PRO_ADD, added: true }
    ]
  }
];
const FAQ = [
  ["How do I pay?", "We accept major cryptocurrencies (BTC, ETH, USDT, USDC, TON) as well as cards. Crypto keeps billing private and borderless."],
  ["What are redirects and domains?", "'Redirects' are the smart short links you create — each click is bot-scored and routed. 'Domains' are the websites you protect. Each tier includes a set number of both."],
  ["How does weekly billing work?", "Every plan gives 7 days of access. Renew when it runs out. Any days you have left are added on top of whatever you buy next, so renewing early or switching tier never loses you time."],
  ["Can I change plans later?", "Yes — upgrade or downgrade anytime. Your unused days carry over to the new tier."]
];
function Cart() {
  return /* @__PURE__ */ jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ jsx("circle", { cx: "9", cy: "20", r: "1.4" }),
    /* @__PURE__ */ jsx("circle", { cx: "18", cy: "20", r: "1.4" }),
    /* @__PURE__ */ jsx("path", { d: "M2 3h3l2.4 12.3a1 1 0 0 0 1 .8h8.5a1 1 0 0 0 1-.8L21 7H6" })
  ] });
}
function FeatureItem({ label, added }) {
  return /* @__PURE__ */ jsxs("li", { className: "flex items-start gap-2.5 text-sm", children: [
    /* @__PURE__ */ jsx("span", { className: `mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${added ? "bg-brand text-white" : "bg-brand/10 text-brand"}`, children: /* @__PURE__ */ jsx(ICheck, { width: 12 }) }),
    /* @__PURE__ */ jsx("span", { className: added ? "font-medium text-brand" : "text-fg-muted", children: label })
  ] });
}
function PlusDivider() {
  return /* @__PURE__ */ jsxs("div", { className: "my-5 flex items-center gap-3", children: [
    /* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-line" }),
    /* @__PURE__ */ jsx("span", { className: "grid h-7 w-7 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand", children: /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" }) }) }),
    /* @__PURE__ */ jsx("span", { className: "h-px flex-1 bg-line" })
  ] });
}
function Pricing() {
  useSeo("Pricing", "Simple weekly plans for smart redirects with real-time bot and fraud detection. Pay by card, mobile money or crypto.");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "Simple, weekly pricing" }),
        /* @__PURE__ */ jsx("h1", { className: "mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "Tariffs & payment" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-slate-300", children: "7 days of access on every plan — renew when it runs out, and unused days roll over. Pay with crypto or card." })
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "border-b border-line bg-white", children: /* @__PURE__ */ jsxs("div", { className: "container-page py-10 text-center", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm font-semibold text-fg-muted", children: "We accept cryptocurrency to keep your billing private" }),
      /* @__PURE__ */ jsx("div", { className: "mt-5", children: /* @__PURE__ */ jsx(CryptoIcons, {}) })
    ] }) }),
    /* @__PURE__ */ jsxs(Section, { className: "!pt-20", children: [
      /* @__PURE__ */ jsx("div", { className: "grid items-stretch gap-6 lg:grid-cols-3", children: PLANS.map((p) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: `card relative flex flex-col p-7 ${p.ribbon ? "overflow-hidden" : ""} ${p.highlight ? "ring-2 ring-brand shadow-[0_24px_60px_-24px_rgba(37,99,235,.5)]" : "shadow-soft"}`,
          children: [
            p.ribbon && /* @__PURE__ */ jsx("div", { className: "pointer-events-none absolute -right-12 top-6 z-10 rotate-45 bg-warning px-14 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow", children: p.ribbon }),
            p.highlight && /* @__PURE__ */ jsx("span", { className: "absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,.7)]", children: "Most popular" }),
            /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: p.name }),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: p.tag }),
            /* @__PURE__ */ jsxs("div", { className: "mt-5 flex items-end gap-1", children: [
              /* @__PURE__ */ jsxs("span", { className: "text-4xl font-extrabold tracking-tight", children: [
                "$",
                p.price
              ] }),
              /* @__PURE__ */ jsx("span", { className: "pb-1 text-sm text-fg-dim", children: "/week" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "mt-0.5 text-xs text-fg-dim", children: p.access }),
            /* @__PURE__ */ jsx("div", { className: "mt-6 text-xs font-bold uppercase tracking-wider text-fg-dim", children: "Key features" }),
            /* @__PURE__ */ jsx("div", { className: "mt-3", children: p.groups.map((g, gi) => /* @__PURE__ */ jsxs("div", { children: [
              gi > 0 && /* @__PURE__ */ jsx(PlusDivider, {}),
              g.label && /* @__PURE__ */ jsx("div", { className: "mb-3 text-xs font-semibold text-fg-muted", children: g.label }),
              /* @__PURE__ */ jsx("ul", { className: "space-y-3", children: g.items.map((f) => /* @__PURE__ */ jsx(FeatureItem, { label: f, added: g.added }, f)) })
            ] }, gi)) }),
            /* @__PURE__ */ jsx("div", { className: "mt-6 flex-1" }),
            /* @__PURE__ */ jsxs("div", { className: "border-t border-line pt-5 text-sm", children: [
              /* @__PURE__ */ jsxs("div", { className: "flex justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "Redirects" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold", children: p.redirects })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-1 flex justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "Domains" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold", children: p.domains })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "mt-1 flex justify-between", children: [
                /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: "Access" }),
                /* @__PURE__ */ jsx("span", { className: "font-semibold", children: "Weekly" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs(Button, { to: "/signup", variant: p.highlight ? "primary" : "outline", className: "mt-5 w-full", children: [
              /* @__PURE__ */ jsx(Cart, {}),
              " ",
              p.cta
            ] })
          ]
        },
        p.name
      )) }),
      /* @__PURE__ */ jsx("p", { className: "mt-8 text-center text-sm text-fg-dim", children: "All plans include SSL, GDPR-friendly data controls, and CSV export. Prices in USD, payable in crypto or card." })
    ] }),
    /* @__PURE__ */ jsxs(Section, { className: "bg-bg-soft rounded-none", children: [
      /* @__PURE__ */ jsx(SectionHead, { eyebrow: "FAQ", title: "Questions, answered" }),
      /* @__PURE__ */ jsx("div", { className: "mx-auto mt-12 max-w-3xl divide-y divide-line", children: FAQ.map(([q, a]) => /* @__PURE__ */ jsxs("div", { className: "py-6", children: [
        /* @__PURE__ */ jsx("h3", { className: "font-bold", children: q }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-relaxed text-fg-muted", children: a })
      ] }, q)) })
    ] })
  ] });
}
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
function BotCheck() {
  useSeo("Free bot exposure check", "Scan any website in 10 seconds and see how exposed it is to bots — free, no signup.");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  async function scan(e) {
    var _a;
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      const r = await botCheckApi.run(url.trim());
      if (!r.ok) setErr(r.error || "Something went wrong.");
      else setRes(r);
    } catch (e2) {
      setErr(((_a = e2 == null ? void 0 : e2.data) == null ? void 0 : _a.error) || "That check couldn't be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { className: "container-page py-14", children: [
    /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-2xl text-center", children: [
      /* @__PURE__ */ jsx("span", { className: "inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand", children: "Free bot exposure check" }),
      /* @__PURE__ */ jsxs("h1", { className: "mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl", children: [
        "How many ",
        /* @__PURE__ */ jsx("span", { className: "text-brand", children: "bots" }),
        " can reach your site?"
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-fg-muted", children: "Run a free 10-second scan and see how exposed your site is to automated traffic — and how to close the gaps. We only read what's publicly visible; no signup needed." }),
      /* @__PURE__ */ jsxs("form", { onSubmit: scan, className: "mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row", children: [
        /* @__PURE__ */ jsx(
          "input",
          {
            value: url,
            onChange: (e) => setUrl(e.target.value),
            placeholder: "yourwebsite.com",
            className: "flex-1 rounded-full border border-line bg-white px-5 py-3.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          }
        ),
        /* @__PURE__ */ jsx(Button, { type: "submit", size: "lg", disabled: busy, children: busy ? "Scanning…" : "Scan my site" })
      ] }),
      err && /* @__PURE__ */ jsx("p", { className: "mt-4 rounded-lg bg-danger/5 px-4 py-2 text-sm text-red-600", children: err })
    ] }),
    (res == null ? void 0 : res.ok) && /* @__PURE__ */ jsxs("div", { className: "mx-auto mt-12 max-w-2xl", children: [
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
      /* @__PURE__ */ jsxs("div", { className: "mt-6 rounded-2xl bg-navy-900 p-7 text-center text-white", children: [
        /* @__PURE__ */ jsx("h3", { className: "text-xl font-bold", children: "Close these gaps with TryNoBot" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-2 max-w-md text-sm text-white/70", children: "TryNoBot scores every visitor in real time, blocks bots and fraud, and shows you exactly what's hitting your site — free to start." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-5 flex justify-center gap-2", children: [
          /* @__PURE__ */ jsx(Button, { to: "/signup", size: "lg", children: "Start free" }),
          /* @__PURE__ */ jsx(Button, { to: "/pricing", variant: "light", size: "lg", children: "View pricing" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mx-auto mt-10 max-w-2xl text-center text-xs text-fg-dim", children: "This check reads only publicly available information (response headers, homepage HTML and robots.txt). It does not log in, probe private endpoints, or store your site's content." })
  ] });
}
function FeaturePage({
  eyebrow,
  title,
  sub,
  blocks,
  bullets,
  ctaTitle = "Ready to see it on your own traffic?"
}) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: eyebrow }),
        /* @__PURE__ */ jsx("h1", { className: "mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: title }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-2xl text-slate-300", children: sub }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 flex justify-center gap-3", children: [
          /* @__PURE__ */ jsxs(Button, { to: "/signup", size: "lg", children: [
            "Start Free ",
            /* @__PURE__ */ jsx(IArrow, { width: 18 })
          ] }),
          /* @__PURE__ */ jsx(Button, { to: "/pricing", variant: "light", size: "lg", children: "View pricing" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsx("div", { className: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3", children: blocks.map((b) => /* @__PURE__ */ jsxs("div", { className: "card card-hover shadow-soft p-6", children: [
      /* @__PURE__ */ jsx("div", { className: "grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand", children: /* @__PURE__ */ jsx(b.icon, { width: 22 }) }),
      /* @__PURE__ */ jsx("h3", { className: "mt-4 text-lg font-bold", children: b.title }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-relaxed text-fg-muted", children: b.desc })
    ] }, b.title)) }) }),
    bullets && /* @__PURE__ */ jsxs(Section, { className: "bg-bg-soft rounded-none", children: [
      /* @__PURE__ */ jsx(SectionHead, { eyebrow: "What's included", title: "Built to be transparent and fast", center: false }),
      /* @__PURE__ */ jsx("div", { className: "mt-10 grid gap-4 sm:grid-cols-2", children: bullets.map((x) => /* @__PURE__ */ jsxs("div", { className: "flex items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-soft", children: [
        /* @__PURE__ */ jsx("span", { className: "mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand/10 text-brand", children: /* @__PURE__ */ jsx(ICheck, { width: 13 }) }),
        /* @__PURE__ */ jsx("span", { className: "text-sm text-fg", children: x })
      ] }, x)) })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsxs("div", { className: "hero-band relative overflow-hidden rounded-3xl px-8 py-14 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-60" }),
      /* @__PURE__ */ jsxs("div", { className: "relative", children: [
        /* @__PURE__ */ jsx("h2", { className: "mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl", children: ctaTitle }),
        /* @__PURE__ */ jsx("div", { className: "mt-8 flex justify-center gap-3", children: /* @__PURE__ */ jsxs(Button, { to: "/signup", size: "lg", children: [
          "Get started free ",
          /* @__PURE__ */ jsx(IArrow, { width: 18 })
        ] }) })
      ] })
    ] }) })
  ] });
}
function Features() {
  useSeo("Features", "Real-time scoring, JS + TLS/JA3 fingerprinting, traffic rules, IP allow/deny, A/B testing and more.");
  return /* @__PURE__ */ jsx(
    FeaturePage,
    {
      eyebrow: "Features",
      title: "One platform for traffic you can trust",
      sub: "Analyze, score, protect and measure every visitor — from first pageview to final conversion.",
      blocks: [
        { icon: IRadar, title: "Visitor & session intelligence", desc: "Rich signals for every visit: IP, ASN, geo, device, browser, OS, referrer and UTM data." },
        { icon: IShield, title: "Bot & fraud detection", desc: "Datacenter IPs, proxies, VPNs, headless browsers and automation caught in real time." },
        { icon: IGauge, title: "Explainable risk scores", desc: "A 0–100 score per visitor with the exact contributing signals — never a black box." },
        { icon: IBolt, title: "Traffic rules engine", desc: "Allow, review, block or tag traffic with a visual IF/THEN rule builder." },
        { icon: IServer, title: "Server-side shield", desc: "Block bots before your page loads — enforce rules at your server or edge with drop-in PHP, Django, nginx, Cloudflare or Node snippets." },
        { icon: ILock, title: "Folder Guard", desc: "Lock down sensitive paths like /admin, /wp-login or /downloads from bots and fraud." },
        { icon: IChart, title: "Analytics & reports", desc: "Filterable reports across campaigns, geos, devices and sources with CSV export." },
        { icon: ITarget, title: "Conversion attribution", desc: "Tie revenue back to campaigns and traffic quality to see what actually converts." }
      ],
      bullets: ["Async JavaScript tracker", "REST API & signed webhooks", "Team roles & workspaces", "70/85/100% usage alerts", "GDPR-friendly data controls", "Configurable data retention"]
    }
  );
}
function FraudDetection() {
  useSeo("Fraud detection", "Detect and block bots, click fraud, proxies and VPNs before they waste your ad budget.");
  return /* @__PURE__ */ jsx(
    FeaturePage,
    {
      eyebrow: "Fraud Detection",
      title: "Stop paying for traffic that never converts",
      sub: "Detect bots, click fraud and automated abuse with transparent, explainable scoring — no deception, just defense.",
      blocks: [
        { icon: IShield, title: "Bot & automation", desc: "Headless browsers, known bot user-agents and scripted traffic flagged instantly." },
        { icon: IGlobe, title: "Datacenter & proxy", desc: "Datacenter IPs, proxies and VPNs identified via IP/ASN reputation." },
        { icon: IRadar, title: "Behavioral anomalies", desc: "Abnormal request frequency and repeated suspicious activity surfaced automatically." },
        { icon: IGauge, title: "Risk ranges", desc: "0–39 low · 40–69 medium · 70–84 high · 85–100 critical, each fully explained." },
        { icon: IBolt, title: "Automatic actions", desc: "Route risky traffic to block, review or tag with your own rule thresholds." },
        { icon: ITarget, title: "Signal transparency", desc: "Every score lists the signals behind it so you can trust — and tune — decisions." }
      ],
      bullets: ["Datacenter IP detection", "Proxy & VPN signals", "Headless-browser indicators", "Known bot fingerprints", "Abnormal request-rate detection", "IP / ASN reputation"]
    }
  );
}
function Analytics() {
  useSeo("Traffic analytics", "See traffic quality, sources, conversions and fraud across all your campaigns in one dashboard.");
  return /* @__PURE__ */ jsx(
    FeaturePage,
    {
      eyebrow: "Analytics",
      title: "Reports that tell you what to do next",
      sub: "Fast, filterable analytics across campaigns, sources, geos and devices — with conversions and revenue built in.",
      blocks: [
        { icon: IChart, title: "Traffic & quality reports", desc: "Volume and quality trends over any date range, exportable to CSV." },
        { icon: IGlobe, title: "Geo & device reports", desc: "See where quality traffic and conversions actually come from." },
        { icon: ITarget, title: "Conversion reports", desc: "Conversion rate, revenue and revenue-per-visitor by campaign and source." },
        { icon: IRadar, title: "Source comparison", desc: "Rank traffic sources by quality, suspicious rate and ROI side by side." },
        { icon: IGauge, title: "Risk distribution", desc: "Understand how your traffic spreads across the risk spectrum." },
        { icon: IBolt, title: "Real-time dashboards", desc: "Live overview cards and charts that update as traffic arrives." }
      ],
      bullets: ["Today / 7 / 30-day & custom ranges", "Filter by campaign, geo, device, source", "Classification breakdowns", "Revenue & conversion metrics", "CSV export (PDF later)", "Saved default date ranges"]
    }
  );
}
function TrafficIntelligence() {
  return /* @__PURE__ */ jsx(
    FeaturePage,
    {
      eyebrow: "Traffic Intelligence",
      title: "Understand every visitor in real time",
      sub: "See where traffic comes from, how it behaves, and whether it's worth paying for — the moment it lands.",
      blocks: [
        { icon: IRadar, title: "40+ signals per visit", desc: "Network, device, browser and behavioral signals extracted on every request." },
        { icon: IGlobe, title: "Geo & network context", desc: "Country, region, city, ASN and ISP resolution to spot anomalies fast." },
        { icon: IGauge, title: "Live classification", desc: "Human, Suspicious, Bot or Fraud — decided in single-digit milliseconds." },
        { icon: IChart, title: "Source breakdowns", desc: "Compare quality across Google, Meta, TikTok, organic, direct and referral." },
        { icon: IBolt, title: "Live traffic feed", desc: "Watch visitors, scores and actions stream in as clicks happen." },
        { icon: ITarget, title: "Quality trends", desc: "Track traffic quality over time and catch degradation before it costs you." }
      ]
    }
  );
}
function Integrations() {
  return /* @__PURE__ */ jsx(
    FeaturePage,
    {
      eyebrow: "Integrations",
      title: "Drop-in tracking, developer-friendly APIs",
      sub: "Install one script or call the REST API. Get signed webhooks for every important event.",
      blocks: [
        { icon: ICode, title: "JavaScript tracker", desc: "A lightweight async snippet — pageviews, events and conversions, no page-load impact." },
        { icon: IPlug, title: "REST API", desc: "Manage websites, campaigns, visitors, rules and conversions programmatically." },
        { icon: IBolt, title: "Webhooks", desc: "Signed, retried deliveries for visitor.created, traffic.classified, risk.high and more." },
        { icon: IShield, title: "Server-side ingestion", desc: "Send events from your backend for tamper-resistant conversion tracking." },
        { icon: IGlobe, title: "Coming soon", desc: "Native Google Ads, Meta Ads, TikTok Ads, GA4, Shopify and WordPress connectors." },
        { icon: IChart, title: "Data export", desc: "Export raw and aggregated data to CSV for your own warehouse and BI tools." }
      ]
    }
  );
}
const ENDPOINTS = [
  ["POST", "/api/v1/conversions", "Record a conversion with revenue"],
  ["GET", "/api/v1/visitors", "List analyzed visitors"],
  ["GET", "/api/v1/traffic", "Query classified traffic events"],
  ["GET", "/api/v1/campaigns", "List campaigns"],
  ["POST", "/api/v1/traffic-rules", "Create a traffic rule"],
  ["GET", "/api/v1/reports", "Pull analytics reports"]
];
const SAMPLE = `POST /api/v1/conversions
Authorization: Bearer tq_live_••••••••

{
  "visitor_id": "visitor_123",
  "campaign_id": "campaign_123",
  "event": "purchase",
  "revenue": 49.99,
  "currency": "USD"
}`;
function ApiPage() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "Developer API" }),
        /* @__PURE__ */ jsx("h1", { className: "mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "A clean REST API for traffic & conversions" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-2xl text-slate-300", children: "Manage everything programmatically. Authenticate with API keys, receive signed webhooks." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-8 flex justify-center gap-3", children: [
          /* @__PURE__ */ jsxs(Button, { to: "/signup", size: "lg", children: [
            "Get API key ",
            /* @__PURE__ */ jsx(IArrow, { width: 18 })
          ] }),
          /* @__PURE__ */ jsx(Button, { to: "/docs", variant: "light", size: "lg", children: "Read the docs" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsxs("div", { className: "grid gap-8 lg:grid-cols-2", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(
          SectionHead,
          {
            center: false,
            eyebrow: "Quickstart",
            title: "Track a conversion in one call",
            sub: "Every request is authenticated with a secret API key. Keys are shown once and stored hashed."
          }
        ),
        /* @__PURE__ */ jsxs("div", { className: "mt-6 overflow-hidden rounded-2xl border border-navy-800 bg-navy-900 shadow-soft", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5 border-b border-white/10 px-4 py-3", children: [
            /* @__PURE__ */ jsx("span", { className: "h-3 w-3 rounded-full bg-red-400/70" }),
            /* @__PURE__ */ jsx("span", { className: "h-3 w-3 rounded-full bg-amber-400/70" }),
            /* @__PURE__ */ jsx("span", { className: "h-3 w-3 rounded-full bg-emerald-400/70" }),
            /* @__PURE__ */ jsx("span", { className: "ml-3 text-xs text-slate-400", children: "conversions.sh" })
          ] }),
          /* @__PURE__ */ jsx("pre", { className: "overflow-x-auto p-5 text-[13px] leading-relaxed text-slate-200", children: /* @__PURE__ */ jsx("code", { children: SAMPLE }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx(SectionHead, { center: false, eyebrow: "Endpoints", title: "MVP surface", sub: "A focused set of endpoints to cover the full lifecycle." }),
        /* @__PURE__ */ jsx("div", { className: "mt-6 divide-y divide-line rounded-2xl border border-line bg-white shadow-soft", children: ENDPOINTS.map(([m, p, d]) => /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 px-4 py-3", children: [
          /* @__PURE__ */ jsx("span", { className: `w-14 shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-bold ${m === "GET" ? "bg-emerald-50 text-emerald-700" : "bg-brand/10 text-brand"}`, children: m }),
          /* @__PURE__ */ jsx("code", { className: "text-sm font-semibold text-fg", children: p }),
          /* @__PURE__ */ jsx("span", { className: "ml-auto hidden text-xs text-fg-dim sm:block", children: d })
        ] }, p)) })
      ] })
    ] }) })
  ] });
}
const GROUPS = [
  ["Getting started", ["Create your workspace", "Add a website", "Install the tracking script", "Verify installation"]],
  ["Tracking", ["JavaScript SDK reference", "Pageview & custom events", "Conversion events", "Server-side ingestion"]],
  ["Traffic engine", ["How risk scoring works", "Signals reference", "Classifications", "Traffic rules"]],
  ["Developers", ["Authentication & API keys", "REST API reference", "Webhooks & signatures", "Rate limits"]]
];
function Docs() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "Documentation" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "Everything you need to integrate" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-2xl text-slate-300", children: "Guides for installing tracking, understanding scores, and building on the API." })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsx("div", { className: "grid gap-5 sm:grid-cols-2", children: GROUPS.map(([title, items]) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-6", children: [
      /* @__PURE__ */ jsx("h3", { className: "text-lg font-bold", children: title }),
      /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-2", children: items.map((i) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(Link, { to: "/docs", className: "text-sm text-fg-muted hover:text-brand", children: i }) }, i)) })
    ] }, title)) }) })
  ] });
}
const QA = [
  ["What is TryNoBot?", "A traffic-intelligence platform that analyzes, scores and classifies your incoming traffic in real time so you can detect fraud, protect campaigns and measure conversions."],
  ["Do you deceive ad networks or hide content from reviewers?", "No. TryNoBot is built for legitimate traffic-quality, fraud detection and analytics. We don't provide ad-reviewer deception or platform-policy evasion."],
  ["How does risk scoring work?", "Each visitor is evaluated against weighted signals (datacenter IP, proxy, automation, abnormal request rate and more), normalized to a 0–100 score, and classified as Human, Suspicious, Bot or Fraud. Every score lists its contributing signals."],
  ["How do I install tracking?", "Add a website in your dashboard, copy the async script tag, and paste it before </head>. Installation is auto-detected once the first event arrives."],
  ["What data do you collect?", "Only the traffic signals needed to score visits. Sensitive fields can be masked in the UI, retention is configurable, and data deletion is supported."],
  ["Can I use the API and webhooks?", "Yes. Create API keys, call the REST endpoints, and subscribe to signed webhooks for events like traffic.classified and conversion.created."],
  ["Is there a free trial?", "Every plan includes a 7-day free trial with no credit card required."]
];
function Faq() {
  const [open, setOpen] = useState(0);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "FAQ" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "Frequently asked questions" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-3xl space-y-3", children: QA.map(([q, a], i) => /* @__PURE__ */ jsxs("div", { className: "card shadow-soft overflow-hidden", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          onClick: () => setOpen(open === i ? null : i),
          className: "flex w-full items-center justify-between gap-4 px-5 py-4 text-left",
          children: [
            /* @__PURE__ */ jsx("span", { className: "font-bold", children: q }),
            /* @__PURE__ */ jsx("span", { className: `shrink-0 text-brand transition ${open === i ? "rotate-45" : ""}`, children: /* @__PURE__ */ jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" }) }) })
          ]
        }
      ),
      open === i && /* @__PURE__ */ jsx("p", { className: "px-5 pb-5 text-sm leading-relaxed text-fg-muted", children: a })
    ] }, q)) }) })
  ] });
}
function Contact() {
  const [sent, setSent] = useState(false);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "Contact" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "Talk to our team" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-slate-300", children: "Questions about plans, onboarding or the API? We usually reply within one business day." })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsx("div", { className: "mx-auto max-w-xl", children: sent ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-8 text-center", children: [
      /* @__PURE__ */ jsx("div", { className: "mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success", children: /* @__PURE__ */ jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5" }) }) }),
      /* @__PURE__ */ jsx("h3", { className: "mt-4 text-lg font-bold", children: "Message sent" }),
      /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-fg-muted", children: "Thanks for reaching out — we'll get back to you shortly." })
    ] }) : /* @__PURE__ */ jsxs("form", { className: "card shadow-soft space-y-4 p-7", onSubmit: (e) => {
      e.preventDefault();
      setSent(true);
    }, children: [
      [["Full name", "text", "Jane Marketer"], ["Work email", "email", "jane@company.com"], ["Company", "text", "Acme Media"]].map(([l, t, ph]) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "mb-1.5 block text-sm font-semibold", children: l }),
        /* @__PURE__ */ jsx(
          "input",
          {
            required: true,
            type: t,
            placeholder: ph,
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          }
        )
      ] }, l)),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("label", { className: "mb-1.5 block text-sm font-semibold", children: "How can we help?" }),
        /* @__PURE__ */ jsx(
          "textarea",
          {
            required: true,
            rows: 4,
            placeholder: "Tell us about your traffic volume and goals…",
            className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          }
        )
      ] }),
      /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", children: "Send message" })
    ] }) }) })
  ] });
}
const SYSTEMS = [
  ["Traffic engine (Go)", "Operational"],
  ["Ingestion API", "Operational"],
  ["Dashboard & API (Django)", "Operational"],
  ["Webhooks delivery", "Operational"],
  ["Analytics pipeline", "Operational"]
];
function Status() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "System status" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "All systems operational" })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-2xl", children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-semibold text-emerald-700", children: [
        /* @__PURE__ */ jsx("span", { className: "h-2 w-2 rounded-full bg-success" }),
        " 99.98% uptime over the last 90 days"
      ] }),
      /* @__PURE__ */ jsx("div", { className: "divide-y divide-line rounded-2xl border border-line bg-white shadow-soft", children: SYSTEMS.map(([name, state]) => /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-5 py-4", children: [
        /* @__PURE__ */ jsx("span", { className: "text-sm font-semibold", children: name }),
        /* @__PURE__ */ jsxs("span", { className: "inline-flex items-center gap-2 text-sm text-emerald-700", children: [
          /* @__PURE__ */ jsx("span", { className: "h-2 w-2 rounded-full bg-success" }),
          " ",
          state
        ] })
      ] }, name)) })
    ] }) })
  ] });
}
const CONTENT = {
  terms: {
    title: "Terms of Service",
    intro: "These terms govern your use of the TryNoBot platform. This is placeholder MVP copy — replace with counsel-reviewed terms before launch.",
    sections: [
      ["Acceptable use", "TryNoBot may be used only for legitimate traffic-quality, fraud detection and analytics. Using it to deceive advertising networks or evade platform enforcement is prohibited."],
      ["Accounts", "You are responsible for safeguarding your credentials and API keys, and for all activity under your workspace."],
      ["Billing", "Paid plans are billed monthly. Usage limits and overage behavior are described on the pricing page."],
      ["Termination", "You may cancel anytime. We may suspend accounts that violate the acceptable-use policy."]
    ]
  },
  privacy: {
    title: "Privacy Policy",
    intro: "We take privacy seriously. This is placeholder MVP copy — replace with a counsel-reviewed policy before launch.",
    sections: [
      ["Data we collect", "We process traffic signals needed to score visits: network, device, geo and behavioral data. We minimize collection to what's required."],
      ["How we use data", "To classify traffic, detect fraud, and produce analytics for your workspace. We do not sell personal data."],
      ["Retention & deletion", "Retention is configurable per plan. You can request export or deletion of workspace data."],
      ["Your responsibilities", "As a customer deploying tracking, you are responsible for disclosing tracking to your visitors and honoring applicable data-protection laws."]
    ]
  }
};
function Legal({ kind }) {
  const c = CONTENT[kind];
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-14 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "Legal" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: c.title })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-3xl", children: [
      /* @__PURE__ */ jsx("p", { className: "text-sm text-fg-muted", children: c.intro }),
      /* @__PURE__ */ jsx("div", { className: "mt-8 space-y-8", children: c.sections.map(([h, b]) => /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: h }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm leading-relaxed text-fg-muted", children: b })
      ] }, h)) })
    ] }) })
  ] });
}
const REASONS = [
  ["phishing", "Phishing / fake login page"],
  ["malware", "Malware or harmful download"],
  ["spam", "Spam (unsolicited email or SMS)"],
  ["scam", "Scam or fraud"],
  ["other", "Something else"]
];
function ReportAbuse() {
  const [params] = useSearchParams();
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState("phishing");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  useEffect(() => {
    const u = params.get("url");
    if (u) setUrl(u);
  }, [params]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(await http.post("/v1/abuse/", { url, reason, details, email }, false));
    } catch (err) {
      setError(errText(err == null ? void 0 : err.data, "We couldn't file that report. Please email us instead."));
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("section", { className: "hero-band relative overflow-hidden", children: [
      /* @__PURE__ */ jsx("div", { className: "binary-grid absolute inset-0 opacity-70" }),
      /* @__PURE__ */ jsxs("div", { className: "container-page relative py-16 text-center", children: [
        /* @__PURE__ */ jsx(Badge, { tone: "light", children: "Abuse" }),
        /* @__PURE__ */ jsx("h1", { className: "mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl", children: "Report a short link" }),
        /* @__PURE__ */ jsx("p", { className: "mx-auto mt-4 max-w-xl text-slate-300", children: "Received a link from us that looks like phishing, malware or spam? Tell us here. We re-check the destination the moment you submit, disable it straight away if the threat is confirmed, and put everything else in front of a human." })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Section, { children: /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-xl", children: [
      result ? /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-8 text-center", children: [
        /* @__PURE__ */ jsx("div", { className: "mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success", children: /* @__PURE__ */ jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M20 6L9 17l-5-5" }) }) }),
        /* @__PURE__ */ jsx("h3", { className: "mt-4 text-lg font-bold", children: result.disabled ? "Link disabled" : "Report received" }),
        /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-fg-muted", children: result.disabled ? "We've confirmed the problem and the link no longer redirects anyone." : result.matched ? "Our automated scan couldn't confirm a threat, so a person is reviewing it now." : "We couldn't match that to one of our links, but we've logged it for review." }),
        /* @__PURE__ */ jsxs("p", { className: "mt-4 text-xs text-fg-muted", children: [
          "Reference #",
          result.id
        ] })
      ] }) : /* @__PURE__ */ jsxs("form", { className: "card shadow-soft space-y-4 p-7", onSubmit: submit, children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "mb-1.5 block text-sm font-semibold", children: "The link you received" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              required: true,
              value: url,
              onChange: (e) => setUrl(e.target.value),
              placeholder: "https://trynb.cc/aB3xK9",
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs text-fg-muted", children: "Paste the whole link. Don't visit it again to check." })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("label", { className: "mb-1.5 block text-sm font-semibold", children: "What's wrong with it?" }),
          /* @__PURE__ */ jsx(
            "select",
            {
              value: reason,
              onChange: (e) => setReason(e.target.value),
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20",
              children: REASONS.map(([v, l]) => /* @__PURE__ */ jsx("option", { value: v, children: l }, v))
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-1.5 block text-sm font-semibold", children: [
            "Anything else? ",
            /* @__PURE__ */ jsx("span", { className: "font-normal text-fg-muted", children: "(optional)" })
          ] }),
          /* @__PURE__ */ jsx(
            "textarea",
            {
              rows: 4,
              value: details,
              onChange: (e) => setDetails(e.target.value),
              placeholder: "Where you received it, what brand it impersonates, what the page asked for…",
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsxs("label", { className: "mb-1.5 block text-sm font-semibold", children: [
            "Your email ",
            /* @__PURE__ */ jsx("span", { className: "font-normal text-fg-muted", children: "(optional)" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              value: email,
              onChange: (e) => setEmail(e.target.value),
              placeholder: "you@company.com",
              className: "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            }
          ),
          /* @__PURE__ */ jsx("p", { className: "mt-1.5 text-xs text-fg-muted", children: "Leave it and we'll tell you what we did about this report." })
        ] }),
        error && /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-danger", children: error }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: busy, children: busy ? "Checking the link…" : "Report this link" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-6 text-center text-xs text-fg-muted", children: "Security teams and researchers: reports sent here are actioned automatically and reach our abuse team directly." })
    ] }) })
  ] });
}
const Login = lazy(() => import("./assets/Login-DGRBypus.js"));
const Signup = lazy(() => import("./assets/Signup-m0wuQFbP.js"));
const ForgotPassword = lazy(() => import("./assets/ForgotPassword-D-Do0d3k.js"));
const ResetPassword = lazy(() => import("./assets/ResetPassword-P5R-zEp1.js"));
const VerifyEmail = lazy(() => import("./assets/VerifyEmail-DN4MurGh.js"));
const AcceptInvite = lazy(() => import("./assets/AcceptInvite-C6w8l0i-.js"));
const DashboardLayout = lazy(() => import("./assets/DashboardLayout-BvdFpFbJ.js"));
const Overview = lazy(() => import("./assets/Overview-DStCz6du.js"));
const Websites = lazy(() => import("./assets/Websites-B5z4yjqn.js"));
const WebsiteDetail = lazy(() => import("./assets/WebsiteDetail-C-t6Ji6i.js"));
const Campaigns = lazy(() => import("./assets/Campaigns-BMNy-AYa.js"));
const CampaignDetail = lazy(() => import("./assets/CampaignDetail-B_aaSU2-.js"));
const TrafficRules = lazy(() => import("./assets/TrafficRules-CG8Jc1A0.js"));
const Shield = lazy(() => import("./assets/Shield-DtLeBreS.js"));
const Links = lazy(() => import("./assets/Links-BrlvZpnZ.js"));
const BotScanner = lazy(() => import("./assets/BotScanner-DiCJQKpT.js"));
const Visitors = lazy(() => import("./assets/Visitors-VEcRqY-5.js"));
const VisitorDetail = lazy(() => import("./assets/VisitorDetail-CPPQkGaU.js"));
const ClickLog = lazy(() => import("./assets/ClickLog-C_nX-TAV.js"));
const TrafficSources = lazy(() => import("./assets/TrafficSources-y-tyDvXq.js"));
const Conversions = lazy(() => import("./assets/Conversions-Co1i5was.js"));
const DashIntegrations = lazy(() => import("./assets/Integrations-BgJX3oDQ.js"));
const ApiKeys = lazy(() => import("./assets/ApiKeys-BgRTYRFB.js"));
const Webhooks = lazy(() => import("./assets/Webhooks-DFybJpm9.js"));
const Billing = lazy(() => import("./assets/Billing-Cdss7Sgd.js"));
const UsagePage = lazy(() => import("./assets/UsagePage-2hTZs7r8.js"));
const Team = lazy(() => import("./assets/Team-CwYl61NG.js"));
const Settings = lazy(() => import("./assets/Settings-A9nqqFl4.js"));
const Reports = lazy(() => import("./assets/Reports-Bg-CpY8O.js"));
const AdminLayout = lazy(() => import("./assets/AdminLayout-Dx7o6sg9.js"));
const AdminOverview = lazy(() => import("./assets/AdminOverview-DeiGjSa1.js"));
const AdminUsers = lazy(() => import("./assets/AdminUsers-DSj4p2x1.js"));
const AdminOrgs = lazy(() => import("./assets/AdminOrgs-CHo9p4V4.js"));
const AdminSubscriptions = lazy(() => import("./assets/AdminSubscriptions-CG6YY1bb.js"));
const AdminFraudAlerts = lazy(() => import("./assets/AdminFraudAlerts-Btykmn1h.js"));
const spinner = /* @__PURE__ */ jsx("div", { className: "grid min-h-screen place-items-center", children: /* @__PURE__ */ jsx("div", { className: "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" }) });
function AppRoutes() {
  return /* @__PURE__ */ jsx(Suspense, { fallback: spinner, children: /* @__PURE__ */ jsxs(Routes, { children: [
    /* @__PURE__ */ jsxs(Route, { element: /* @__PURE__ */ jsx(MarketingLayout, {}), children: [
      /* @__PURE__ */ jsx(Route, { path: "/", element: /* @__PURE__ */ jsx(Landing, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/features", element: /* @__PURE__ */ jsx(Features, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/traffic-intelligence", element: /* @__PURE__ */ jsx(TrafficIntelligence, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/fraud-detection", element: /* @__PURE__ */ jsx(FraudDetection, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/analytics", element: /* @__PURE__ */ jsx(Analytics, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/integrations", element: /* @__PURE__ */ jsx(Integrations, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/api", element: /* @__PURE__ */ jsx(ApiPage, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/pricing", element: /* @__PURE__ */ jsx(Pricing, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/bot-check", element: /* @__PURE__ */ jsx(BotCheck, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/docs", element: /* @__PURE__ */ jsx(Docs, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/faq", element: /* @__PURE__ */ jsx(Faq, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/contact", element: /* @__PURE__ */ jsx(Contact, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/status", element: /* @__PURE__ */ jsx(Status, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/report", element: /* @__PURE__ */ jsx(ReportAbuse, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/abuse", element: /* @__PURE__ */ jsx(ReportAbuse, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/terms", element: /* @__PURE__ */ jsx(Legal, { kind: "terms" }) }),
      /* @__PURE__ */ jsx(Route, { path: "/privacy", element: /* @__PURE__ */ jsx(Legal, { kind: "privacy" }) })
    ] }),
    /* @__PURE__ */ jsx(Route, { path: "/login", element: /* @__PURE__ */ jsx(Login, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/signup", element: /* @__PURE__ */ jsx(Signup, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/forgot-password", element: /* @__PURE__ */ jsx(ForgotPassword, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/reset-password/:token", element: /* @__PURE__ */ jsx(ResetPassword, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/verify-email", element: /* @__PURE__ */ jsx(VerifyEmail, {}) }),
    /* @__PURE__ */ jsx(Route, { path: "/accept-invite", element: /* @__PURE__ */ jsx(AcceptInvite, {}) }),
    /* @__PURE__ */ jsxs(Route, { path: "/dashboard", element: /* @__PURE__ */ jsx(RequireAuth, { children: /* @__PURE__ */ jsx(DashboardLayout, {}) }), children: [
      /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(Overview, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "websites", element: /* @__PURE__ */ jsx(Websites, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "websites/:id", element: /* @__PURE__ */ jsx(WebsiteDetail, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "campaigns", element: /* @__PURE__ */ jsx(Campaigns, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "campaigns/:id", element: /* @__PURE__ */ jsx(CampaignDetail, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "traffic-rules", element: /* @__PURE__ */ jsx(TrafficRules, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "shield", element: /* @__PURE__ */ jsx(Shield, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "links", element: /* @__PURE__ */ jsx(Links, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "scanner", element: /* @__PURE__ */ jsx(BotScanner, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "visitors", element: /* @__PURE__ */ jsx(Visitors, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "visitors/:id", element: /* @__PURE__ */ jsx(VisitorDetail, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "click-log", element: /* @__PURE__ */ jsx(ClickLog, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "traffic-sources", element: /* @__PURE__ */ jsx(TrafficSources, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "conversions", element: /* @__PURE__ */ jsx(Conversions, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "integrations", element: /* @__PURE__ */ jsx(DashIntegrations, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "api", element: /* @__PURE__ */ jsx(ApiKeys, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "webhooks", element: /* @__PURE__ */ jsx(Webhooks, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "billing", element: /* @__PURE__ */ jsx(Billing, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "usage", element: /* @__PURE__ */ jsx(UsagePage, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "team", element: /* @__PURE__ */ jsx(Team, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "settings", element: /* @__PURE__ */ jsx(Settings, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "reports", element: /* @__PURE__ */ jsx(Reports, {}) })
    ] }),
    /* @__PURE__ */ jsxs(Route, { path: "/admin", element: /* @__PURE__ */ jsx(RequireStaff, { children: /* @__PURE__ */ jsx(AdminLayout, {}) }), children: [
      /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(AdminOverview, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "users", element: /* @__PURE__ */ jsx(AdminUsers, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "organizations", element: /* @__PURE__ */ jsx(AdminOrgs, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "subscriptions", element: /* @__PURE__ */ jsx(AdminSubscriptions, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "fraud-alerts", element: /* @__PURE__ */ jsx(AdminFraudAlerts, {}) })
    ] }),
    /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(Landing, {}) })
  ] }) });
}
function render(url) {
  return renderToString(
    /* @__PURE__ */ jsx(AuthProvider, { children: /* @__PURE__ */ jsx(WorkspaceProvider, { children: /* @__PURE__ */ jsx(StaticRouter, { location: url, children: /* @__PURE__ */ jsx(AppRoutes, {}) }) }) })
  );
}
export {
  variantApi as A,
  Button as B,
  ipFilterApi as C,
  ruleApi as D,
  RULE_OPS as E,
  FIELD_VALUE_OPTIONS as F,
  COUNTRIES as G,
  linkApi as H,
  IHome as I,
  botCheckApi as J,
  conversionsApi as K,
  Logo as L,
  keysApi as M,
  webhookApi as N,
  downloadReportCsv as O,
  adminApi as P,
  RULE_FIELDS as R,
  authApi as a,
  BRAND$1 as b,
  useWorkspace as c,
  billingApi as d,
  IGlobe as e,
  ITarget as f,
  IFilter as g,
  IShieldGold as h,
  ILink as i,
  IRadar as j,
  IUsers as k,
  IList as l,
  IChart as m,
  IFunnel as n,
  orgApi as o,
  ISources as p,
  IPlug as q,
  IKey as r,
  render,
  IBolt as s,
  ICard as t,
  useAuth as u,
  IGauge as v,
  IGear as w,
  analyticsApi as x,
  websiteApi as y,
  campaignApi as z
};

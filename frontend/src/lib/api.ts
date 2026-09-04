// Typed API client for the Django DRF backend.
const ACCESS = "bl_access";
const REFRESH = "bl_refresh";

export const tokens = {
  get access() { return localStorage.getItem(ACCESS); },
  get refresh() { return localStorage.getItem(REFRESH); },
  set({ access, refresh }: { access?: string; refresh?: string }) {
    if (access) localStorage.setItem(ACCESS, access);
    if (refresh) localStorage.setItem(REFRESH, refresh);
  },
  clear() { localStorage.removeItem(ACCESS); localStorage.removeItem(REFRESH); },
};

// Pull a human message out of whatever shape DRF returned: a plain string,
// {detail: "..."}, a bare list ["..."] (ValidationError with a string), or
// field errors {field: ["..."]} / {non_field_errors: ["..."]}.
export function errText(data: any, fallback = "Something went wrong. Please try again."): string {
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

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, data: any) {
    super(errText(data, "Request failed"));
    this.status = status;
    this.data = data;
  }
}

async function raw(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as any) };
  if (opts.auth !== false && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  return fetch(`/api${path}`, { ...opts, headers });
}

// Single-flight refresh: many requests can 401 at once (e.g. on a hard
// refresh that fires several calls in parallel). We coalesce them into ONE
// refresh call and share its result, so we never stampede the endpoint.
let refreshInFlight: Promise<boolean> | null = null;
function refreshAccess(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const r = await raw("/auth/token/refresh/", {
          method: "POST", auth: false, body: JSON.stringify({ refresh: tokens.refresh }),
        });
        if (r.ok) {
          const { access } = await r.json();
          tokens.set({ access });
          return true;
        }
        // Only a definitive auth rejection means the session is truly gone.
        // A 5xx / timeout / network blip (common on a busy server) must NOT
        // wipe the tokens, or a transient error logs the user out.
        if (r.status === 401) tokens.clear();
        return false;
      } catch {
        return false; // network error — keep tokens, let the caller fail/retry
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function request<T = any>(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<T> {
  let res = await raw(path, opts);
  // transparent refresh on 401
  if (res.status === 401 && tokens.refresh && opts.auth !== false) {
    if (await refreshAccess()) {
      res = await raw(path, opts);
    }
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

export const http = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: any, auth = true) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined, auth }),
  patch: <T = any>(p: string, body?: any) => request<T>(p, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T = any>(p: string) => request<T>(p, { method: "DELETE" }),
};

// ---- typed auth calls ----
export interface NotificationPrefs { email: boolean; high_risk: boolean; usage: boolean; conversions: boolean; }
export interface User { id: number; email: string; first_name: string; last_name: string; is_verified: boolean; is_staff: boolean; timezone: string; language: string; notification_prefs: NotificationPrefs; }

export const authApi = {
  login: (email: string, password: string) =>
    http.post<{ access: string; refresh: string }>("/auth/token/", { email, password }, false),
  register: (payload: { first_name: string; last_name: string; email: string; password: string }) =>
    http.post<User>("/auth/register/", payload, false),
  me: () => http.get<User>("/auth/me/"),
  forgotPassword: (email: string) => http.post("/auth/password/forgot/", { email }, false),
  resetPassword: (token: string, password: string) => http.post("/auth/password/reset/", { token, password }, false),
  verifyEmail: (token: string) => http.post("/auth/email/verify/", { token }, false),
  resendVerification: () => http.post<{ detail: string }>("/auth/email/resend/", {}),
  updateProfile: (patch: Partial<User>) => http.patch<User>("/auth/me/", patch),
  changePassword: (current_password: string, new_password: string) =>
    http.post("/auth/password/change/", { current_password, new_password }),
};

// ---- organizations ----
export type Role = "owner" | "admin" | "analyst";
export interface Organization { id: number; name: string; slug: string; role: Role; member_count: number; created_at: string; }
export interface Member { id: number; email: string; first_name: string; last_name: string; role: Role; created_at: string; }

export const orgApi = {
  list: () => http.get<{ results: Organization[] } | Organization[]>("/organizations/"),
  create: (name: string) => http.post<Organization>("/organizations/", { name }),
  members: (orgId: number) => http.get<{ results: Member[] }>(`/organizations/${orgId}/members/`),
  invite: (orgId: number, email: string, role: Role) =>
    http.post(`/organizations/${orgId}/invitations/`, { email, role }),
  changeRole: (orgId: number, memberId: number, role: Role) =>
    http.patch(`/organizations/${orgId}/members/${memberId}/`, { role }),
  removeMember: (orgId: number, memberId: number) =>
    http.del(`/organizations/${orgId}/members/${memberId}/`),
  acceptInvite: (token: string) => http.post("/organizations/invitations/accept/", { token }),
  invitations: (orgId: number) => http.get<{ results: Invitation[] } | Invitation[]>(`/organizations/${orgId}/invitations/`),
};
export interface Invitation { id: number; email: string; role: Role; created_at: string; accepted_at: string | null; pending: boolean; }

// ---- websites ----
export type WebsiteStatus = "not_installed" | "detected" | "active" | "error";
export interface Website {
  id: number; organization: number; name: string; domain: string; url: string;
  tracking_id: string; status: WebsiteStatus; last_event_at: string | null;
  created_at: string; snippet: string;
}

export const websiteApi = {
  list: (orgId: number) => http.get<{ results: Website[] }>(`/websites/?organization=${orgId}`),
  get: (id: number) => http.get<Website>(`/websites/${id}/`),
  create: (payload: { organization: number; name: string; domain: string; url?: string }) =>
    http.post<Website>("/websites/", payload),
  update: (id: number, payload: Partial<Website>) => http.patch<Website>(`/websites/${id}/`, payload),
  remove: (id: number) => http.del(`/websites/${id}/`),
  verify: (id: number) => http.post<{ status: WebsiteStatus; installed: boolean; message: string; last_event_at: string | null }>(`/websites/${id}/verify/`),
  verifyShield: (id: number) => http.post<{ active: boolean; last_check_at: string | null; message: string }>(`/websites/${id}/verify-shield/`),
};

// ---- short links ----
export type BotAction = "off" | "decoy" | "notfound" | "blank";
export interface ShortLink {
  id: number; organization: number; website: number | null; slug: string;
  destination_url: string; title: string; active: boolean; bot_action: BotAction;
  clicks: number; human_clicks: number; bot_clicks: number;
  url_safe: boolean | null; url_threats: string[]; url_scanned_at: string | null;
  short_url: string; quality: number; created_at: string;
}
export const linkApi = {
  list: (orgId: number) => http.get<{ results: ShortLink[] }>(`/links/?organization=${orgId}`),
  create: (p: { organization: number; destination_url: string; title?: string; slug?: string; bot_action?: BotAction; website?: number | null }) =>
    http.post<ShortLink>("/links/", p),
  update: (id: number, p: Partial<ShortLink>) => http.patch<ShortLink>(`/links/${id}/`, p),
  remove: (id: number) => http.del(`/links/${id}/`),
};

// ---- campaigns ----
export type CampaignStatus = "active" | "paused";
export type TrafficSource = "facebook" | "google" | "tiktok" | "bing" | "native" | "organic" | "direct" | "other";
export interface Campaign {
  id: number; website: number; website_name: string; organization: number;
  name: string; destination_url: string; traffic_source: TrafficSource; country: string;
  utm_source: string; utm_medium: string; utm_campaign: string;
  risk_threshold: number; status: CampaignStatus; created_at: string; updated_at: string;
  url_safe: boolean | null; url_threats: string[]; url_scanned_at: string | null;
}
export interface CampaignStats {
  events: number; visitors: number; conversions: number;
  by_classification: Record<string, number>; quality: number; flagged: number;
}

export interface CampaignVariant {
  id: number; campaign: number; label: string; destination_url: string;
  weight: number; active: boolean; created_at: string;
}
export interface VariantStatRow {
  id: number; label: string; weight: number; active: boolean;
  visitors: number; conversions: number; cvr: number;
}
export interface VariantStats { variants: VariantStatRow[]; total_visitors: number; }

export const campaignApi = {
  list: (orgId: number) => http.get<{ results: Campaign[] }>(`/campaigns/?organization=${orgId}`),
  get: (id: number) => http.get<Campaign>(`/campaigns/${id}/`),
  create: (p: Partial<Campaign>) => http.post<Campaign>("/campaigns/", p),
  update: (id: number, p: Partial<Campaign>) => http.patch<Campaign>(`/campaigns/${id}/`, p),
  remove: (id: number) => http.del(`/campaigns/${id}/`),
  stats: (id: number) => http.get<CampaignStats>(`/campaigns/${id}/stats/`),
  variantStats: (id: number) => http.get<VariantStats>(`/campaigns/${id}/variant-stats/`),
  scanUrl: (id: number) =>
    http.post<{ safe: boolean | null; flagged_by: string[]; threats: string[]; checked: boolean; detail?: string }>(`/campaigns/${id}/scan-url/`, {}),
};

export const variantApi = {
  list: (campaignId: number) =>
    http.get<{ results: CampaignVariant[] }>(`/campaigns/variants/?campaign=${campaignId}`),
  create: (p: Partial<CampaignVariant>) => http.post<CampaignVariant>("/campaigns/variants/", p),
  update: (id: number, p: Partial<CampaignVariant>) =>
    http.patch<CampaignVariant>(`/campaigns/variants/${id}/`, p),
  remove: (id: number) => http.del(`/campaigns/variants/${id}/`),
};

// ---- traffic rules ----
export type RuleAction = "allow" | "redirect" | "block" | "review" | "tag";
export interface RuleCondition { id?: number; field: string; operator: string; value: string; }
export interface TrafficRule {
  id: number; organization: number; website: number | null; name: string; priority: number;
  action: RuleAction; tag: string; redirect_url: string; active: boolean;
  conditions: RuleCondition[]; created_at: string;
}
export const RULE_FIELDS = [
  ["risk_score", "Risk score"], ["requests_per_min", "Requests per minute"], ["classification", "Classification"], ["country", "Country"],
  ["device", "Device"], ["browser", "Browser"], ["os", "OS"], ["is_bot", "Bot detected"],
  ["is_proxy", "Proxy/Datacenter"], ["utm_source", "UTM source"], ["utm_medium", "UTM medium"],
  ["utm_campaign", "UTM campaign"], ["referrer", "Referrer"], ["ja3", "TLS/JA3 hash"],
  ["path", "URL path"],
] as const;
// Plain-English operator labels (values stay the same for the engine).
export const RULE_OPS = [
  ["eq", "is"], ["ne", "is not"], ["gt", "is more than"], ["gte", "is at least"],
  ["lt", "is less than"], ["lte", "is at most"], ["contains", "contains"], ["in", "is any of"],
] as const;

// Preset value choices per field, so common restrictions are a dropdown, not free text.
export const FIELD_VALUE_OPTIONS: Record<string, [string, string][]> = {
  device: [["mobile", "Mobile"], ["desktop", "Desktop"], ["tablet", "Tablet"]],
  os: [["windows", "Windows"], ["macos", "macOS"], ["ios", "iOS"], ["android", "Android"], ["linux", "Linux"]],
  browser: [["chrome", "Chrome"], ["safari", "Safari"], ["firefox", "Firefox"], ["edge", "Edge"], ["opera", "Opera"]],
  classification: [["human", "Human"], ["suspicious", "Suspicious"], ["bot", "Bot"], ["fraud", "Fraud"]],
  is_bot: [["1", "Yes"], ["0", "No"]],
  is_proxy: [["1", "Yes"], ["0", "No"]],
};

// A short list of common countries (ISO-2) for the country restriction picker.
export const COUNTRIES: [string, string][] = [
  ["US", "United States"], ["GB", "United Kingdom"], ["CA", "Canada"], ["AU", "Australia"],
  ["DE", "Germany"], ["FR", "France"], ["NL", "Netherlands"], ["ES", "Spain"], ["IT", "Italy"],
  ["BR", "Brazil"], ["MX", "Mexico"], ["IN", "India"], ["NG", "Nigeria"], ["ZA", "South Africa"],
  ["RU", "Russia"], ["UA", "Ukraine"], ["CN", "China"], ["JP", "Japan"], ["KR", "South Korea"],
  ["ID", "Indonesia"], ["PH", "Philippines"], ["TR", "Turkey"], ["PL", "Poland"], ["SE", "Sweden"],
];

export type IPKind = "allow" | "deny";
export interface IPListEntry {
  id: number; organization: number; value: string; kind: IPKind;
  note: string; active: boolean; created_at: string;
}
export const ipFilterApi = {
  list: (orgId: number) => http.get<{ results: IPListEntry[] }>(`/rules/ip-filters/?organization=${orgId}`),
  create: (p: { organization: number; value: string; kind: IPKind; note?: string }) =>
    http.post<IPListEntry>("/rules/ip-filters/", p),
  update: (id: number, p: Partial<IPListEntry>) => http.patch<IPListEntry>(`/rules/ip-filters/${id}/`, p),
  remove: (id: number) => http.del(`/rules/ip-filters/${id}/`),
};

export const ruleApi = {
  list: (orgId: number) => http.get<{ results: TrafficRule[] }>(`/rules/?organization=${orgId}`),
  create: (p: Partial<TrafficRule> & { organization: number }) => http.post<TrafficRule>("/rules/", p),
  update: (id: number, p: Partial<TrafficRule>) => http.patch<TrafficRule>(`/rules/${id}/`, p),
  remove: (id: number) => http.del(`/rules/${id}/`),
};

// ---- analytics ----
export interface KV { key: string; count: number; }
export interface Overview {
  range: { days: number };
  totals: {
    events: number; visitors: number; sessions: number; quality: number; human: number;
    suspicious: number; bot: number; fraud: number; flagged: number;
    conversions: number; conversion_rate: number;
  };
  timeseries: { visitors: { date: string; count: number }[]; quality: { date: string; pct: number }[] };
  breakdowns: { countries: KV[]; devices: KV[]; classifications: KV[]; sources: KV[] };
}
export interface VisitorRow {
  id: number; visitor_id: string; country: string; device: string; browser: string; os: string;
  first_seen: string; last_seen: string; events: number; max_risk: number | null; fingerprint: string;
}
export interface EventRow {
  id: number; type: string; visitor_ref: string; ip: string | null; country: string;
  device: string; browser: string; os: string; url: string; referrer: string;
  risk_score: number | null; classification: string; action: string; tag: string;
  fingerprint: string; fp_signals: string[]; ja3: string; utm_campaign: string; created_at: string;
}
export interface SourceRow { key: string; events: number; human: number; quality: number; }

const qs = (o: Record<string, any>) =>
  Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");

export const analyticsApi = {
  overview: (orgId: number, range = "7d") => http.get<Overview>(`/analytics/overview/?${qs({ organization: orgId, range })}`),
  visitors: (orgId: number, params: Record<string, any> = {}) =>
    http.get<{ count: number; results: VisitorRow[] }>(`/analytics/visitors/?${qs({ organization: orgId, ...params })}`),
  visitor: (id: number) => http.get<{ visitor: VisitorRow; sessions: number; events: EventRow[] }>(`/analytics/visitors/${id}/`),
  events: (orgId: number, params: Record<string, any> = {}) =>
    http.get<{ count: number; results: EventRow[] }>(`/analytics/events/?${qs({ organization: orgId, ...params })}`),
  sources: (orgId: number, range = "7d") => http.get<{ sources: SourceRow[] }>(`/analytics/sources/?${qs({ organization: orgId, range })}`),
  report: (orgId: number, dimension: string, range = "7d") =>
    http.get<{ dimension: string; rows: ReportRow[]; dimensions: string[] }>(`/analytics/report/?${qs({ organization: orgId, dimension, range })}`),
};
export interface ReportRow { key: string; events: number; visitors: number; human: number; conversions: number; quality: number; }

// CSV download (uses the stored token; browser saves the file)
export async function downloadReportCsv(orgId: number, dimension: string, range: string) {
  const res = await fetch(`/api/analytics/report/?${qs({ organization: orgId, dimension, range, export: "csv" })}`, {
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `report-${dimension}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ---- conversions ----
export interface ConvRow { key: string; count: number; revenue: number; }
export interface ConversionRecent {
  id: number; event_name: string; revenue: number; currency: string;
  utm_source: string; utm_campaign: string; visitor_ref: string; created_at: string;
}
export interface Conversions {
  totals: { conversions: number; revenue: number; revenue_per_visitor: number; avg_order_value: number };
  by_campaign: ConvRow[]; by_source: ConvRow[]; recent: ConversionRecent[];
}
export const conversionsApi = {
  get: (orgId: number, range = "7d") =>
    http.get<Conversions>(`/analytics/conversions/?${qs({ organization: orgId, range })}`),
};

// ---- developer: api keys & webhooks ----
export interface ApiKey { id: number; organization: number; name: string; prefix: string; last_used: string | null; revoked: boolean; created_at: string; }
export interface ApiKeyCreated extends ApiKey { key: string; }
export interface Webhook { id: number; organization: number; url: string; events: string[]; active: boolean; secret?: string; created_at: string; }
export interface Delivery { id: number; event: string; success: boolean; status_code: number | null; attempts: number; created_at: string; }

export const keysApi = {
  list: (orgId: number) => http.get<{ results: ApiKey[] }>(`/integrations/keys/?organization=${orgId}`),
  create: (orgId: number, name: string) => http.post<ApiKeyCreated>("/integrations/keys/", { organization: orgId, name }),
  revoke: (id: number) => http.del(`/integrations/keys/${id}/`),
};
export const webhookApi = {
  list: (orgId: number) => http.get<{ results: Webhook[] }>(`/integrations/webhooks/?organization=${orgId}`),
  create: (p: { organization: number; url: string; events: string[] }) => http.post<Webhook>("/integrations/webhooks/", p),
  update: (id: number, p: Partial<Webhook>) => http.patch<Webhook>(`/integrations/webhooks/${id}/`, p),
  remove: (id: number) => http.del(`/integrations/webhooks/${id}/`),
  test: (id: number) => http.post(`/integrations/webhooks/${id}/test/`),
  deliveries: (id: number) => http.get<Delivery[]>(`/integrations/webhooks/${id}/deliveries/`),
  events: () => http.get<{ events: string[] }>("/integrations/events/"),
};

// ---- billing ----
export interface Plan { id: number; slug: string; name: string; price: number; monthly_events: number; retention_days: number; team_members: number; max_websites: number; max_redirects: number; }
export interface AccessState {
  locked: boolean;
  reason: "active" | "trialing" | "trial_expired" | "period_ended" | "canceled";
  deadline?: string | null;
  trial_end: string | null;
  days_left: number | null;
}
export interface Subscription { id: number; plan: Plan; status: "trialing" | "active" | "canceled"; period_start: string; period_end: string; trial_end: string | null; access: AccessState; created_at: string; }
export interface Usage {
  period: { start: string; end: string };
  events: { used: number; limit: number; pct: number; remaining: number; level: "ok" | "notice" | "warning" | "critical" };
  team: { used: number; limit: number };
  websites: { used: number; limit: number };
  campaigns: { used: number; limit: number };
  on_trial: boolean;
  retention_days: number; plan: Plan;
}
export const billingApi = {
  plans: () => http.get<Plan[]>("/billing/plans/"),
  subscription: (orgId: number) => http.get<Subscription>(`/billing/subscription/?organization=${orgId}`),
  changePlan: (orgId: number, plan: string) => http.post<Subscription>("/billing/subscription/change/", { organization: orgId, plan }),
  checkout: (orgId: number, plan: string) =>
    http.post<{ checkout_url?: string; activated?: boolean } & Partial<Subscription>>("/billing/checkout/", { organization: orgId, plan }),
  cancel: (orgId: number) => http.post<Subscription>("/billing/subscription/cancel/", { organization: orgId }),
  usage: (orgId: number) => http.get<Usage>(`/billing/usage/?organization=${orgId}`),
};


// ---- staff admin ----
export interface AdminOverview {
  users: number; organizations: number; active_subscriptions: number; mrr: number;
  events_processed: number; conversions: number; websites: number; campaigns: number;
  api_keys: number; subscriptions_by_plan: Record<string, number>;
}
export interface AdminUser { id: number; email: string; name: string; is_verified: boolean; is_staff: boolean; orgs: number; date_joined: string; }
export interface AdminOrg { id: number; name: string; owner: string; members: number; websites: number; plan: string; status: string; created_at: string; }
export interface AdminSub {
  id: number; organization: string; organization_id: number; owner: string; plan: string; price: number;
  status: string; locked: boolean; reason: string; trial_end: string | null; created_at: string;
}
export interface AdminFraudAlert {
  id: number; organization: string; website: string; visitor: string; ip: string; country: string;
  classification: string; risk_score: number | null; action: string; signals: string[]; created_at: string;
}
export const adminApi = {
  overview: () => http.get<AdminOverview>("/admin/overview/"),
  users: () => http.get<AdminUser[]>("/admin/users/"),
  organizations: () => http.get<AdminOrg[]>("/admin/organizations/"),
  subscriptions: () => http.get<AdminSub[]>("/admin/subscriptions/"),
  fraudAlerts: () => http.get<AdminFraudAlert[]>("/admin/fraud-alerts/"),
  grantPlan: (organization: number, plan: string) =>
    http.post<{ detail: string; plan: string; status: string }>("/admin/grant-plan/", { organization, plan }),
};


// ---- public bot-exposure check (no auth) ----
export interface BotFinding { status: "good" | "warn" | "bad"; label: string; detail: string; }
export interface BotCheckResult {
  ok: boolean; error?: string; url?: string; exposure?: number; grade?: string;
  findings?: BotFinding[]; summary?: string;
}
export const botCheckApi = {
  run: (url: string) => http.post<BotCheckResult>("/v1/bot-check/", { url }, false),
};

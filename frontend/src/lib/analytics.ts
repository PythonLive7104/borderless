// Google tag (GA4) + Google Ads conversion tracking — the minimum needed to
// spend on Ads without flying blind. Entirely env-driven and opt-in: with no
// IDs set, nothing loads (no tag, no CSP traffic, no cookies).
//
//   VITE_GA_ID              GA4 measurement id, e.g. G-XXXXXXXXXX   (analytics)
//   VITE_GADS_ID            Google Ads id,      e.g. AW-XXXXXXXXX   (conversions)
//   VITE_GADS_SIGNUP_LABEL  conversion label for the Ads "Sign up" action
//   VITE_GADS_LEAD_LABEL    conversion label for the Bot Check lead action
//   VITE_GADS_PURCHASE_LABEL conversion label for the Ads "Purchase" action
//
// Consent Mode v2 is wired in below. It is not optional for UK/EEA traffic:
// without it, Google withholds remarketing and conversion modelling for those
// users, which is exactly the audience these campaigns are aimed at.

const env = (import.meta as any).env || {};
const GA_ID = env.VITE_GA_ID as string | undefined;
const GADS_ID = env.VITE_GADS_ID as string | undefined;
const GADS_SIGNUP_LABEL = env.VITE_GADS_SIGNUP_LABEL as string | undefined;
const GADS_LEAD_LABEL = env.VITE_GADS_LEAD_LABEL as string | undefined;
const GADS_PURCHASE_LABEL = env.VITE_GADS_PURCHASE_LABEL as string | undefined;

export const CONSENT_KEY = "tnb_consent";

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; }
}

let started = false;

function push(...args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

/** What the visitor last chose, or null if they haven't been asked yet. */
export function storedConsent(): "granted" | "denied" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null; // private mode / blocked storage — treat as "not asked"
  }
}

/** Load the Google tag once, in the browser, only if an id is configured. */
export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  const primary = GA_ID || GADS_ID;
  if (!primary) return;
  started = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };

  // Consent defaults MUST be set before the tag loads, or the first hits go out
  // under the wrong assumption and cannot be taken back. Default to denied for
  // everyone rather than geo-gating: it's the safer default under UK GDPR and
  // PECR, and it keeps one code path instead of two.
  const prior = storedConsent();
  const state = prior === "granted" ? "granted" : "denied";
  push("consent", "default", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500,
  });

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primary)}`;
  document.head.appendChild(s);
  window.gtag("js", new Date());
  if (GA_ID) window.gtag("config", GA_ID);
  if (GADS_ID) window.gtag("config", GADS_ID);
}

/** Record the visitor's choice and tell Google about it. */
export function setConsent(granted: boolean) {
  try { localStorage.setItem(CONSENT_KEY, granted ? "granted" : "denied"); } catch { /* ignore */ }
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const state = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  });
}

function conversion(label: string | undefined, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (!GADS_ID || !label) return;
  window.gtag("event", "conversion", { send_to: `${GADS_ID}/${label}`, ...params });
}

/** Fire the signup conversion (GA4 event + Google Ads conversion). No-op until
 *  the tag is configured, so it's always safe to call. */
export function trackSignup() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (GA_ID) window.gtag("event", "sign_up", { method: "email" });
  conversion(GADS_SIGNUP_LABEL);
}

/** Someone left their email on the free Bot Check. This is the conversion ads
 *  should actually optimise toward — it's what the campaigns land on. */
export function trackLead(value = 0) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (GA_ID) window.gtag("event", "generate_lead", { currency: "USD", value });
  conversion(GADS_LEAD_LABEL, { currency: "USD", value });
}

/** A paid plan started. Reported with its value so Ads can bid on revenue
 *  rather than on raw signup count — the difference between a campaign that
 *  buys customers and one that buys free trials. */
export function trackPurchase(value: number, plan: string, interval: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (GA_ID) window.gtag("event", "purchase", { currency: "USD", value, items: [{ item_id: plan, item_name: plan, item_category: interval }] });
  conversion(GADS_PURCHASE_LABEL, { currency: "USD", value });
}

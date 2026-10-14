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

/** Load the Google tag once, in the browser, only if an id is configured and
 *  the visitor has consented. */
export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  const primary = GA_ID || GADS_ID;
  if (!primary) return;
  if (storedConsent() !== "granted") return;
  started = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };

  const state = "granted";
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
  if (!granted) return;

  if (typeof window === "undefined") return;
  if (!window.gtag) {
    initAnalytics();
    return;
  }
  const state = "granted";
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

/** A route change in the SPA.
 *
 *  GA4's `config` call fires exactly one page_view, on the initial load. Every
 *  client-side navigation after that is invisible without this — which means
 *  the whole journey (ad → landing → compare page → pricing → signup) collapses
 *  into a single pageview on the entry page, and no funnel or landing-page
 *  report can be trusted. Sent manually, so `send_page_view: false` is NOT set
 *  on config: the first view still comes from config, and this covers the rest.
 */
export function trackPageView(path: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  // Any configured tag, not GA4 only: with Google Ads alone, the Ads tag also
  // fires just once on load, so without this a visitor who browses to /pricing
  // never enters the remarketing audience for it.
  if (!GA_ID && !GADS_ID) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/** Someone ran the free Bot Check. Not a conversion — it's the top of the
 *  funnel, and the denominator for the scan → lead rate that decides whether
 *  the Bot Check landing page is worth bidding on at all. */
export function trackScan(grade?: string) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (!GA_ID && !GADS_ID) return;
  window.gtag("event", "bot_check_scan", { grade: grade || "unknown" });
}

/** A visitor reached the pricing table. The strongest pre-signup intent signal
 *  we have, and usable as a remarketing audience even when GADS labels aren't
 *  configured yet. */
export function trackPricingView() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (!GA_ID && !GADS_ID) return;
  window.gtag("event", "view_pricing");
}

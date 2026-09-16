// Google tag (GA4) + Google Ads conversion tracking — the minimum needed to
// spend on Ads without flying blind. Entirely env-driven and opt-in: with no
// IDs set, nothing loads (no tag, no CSP traffic, no cookies).
//
//   VITE_GA_ID            GA4 measurement id, e.g. G-XXXXXXXXXX   (analytics)
//   VITE_GADS_ID          Google Ads id,      e.g. AW-XXXXXXXXX   (conversions)
//   VITE_GADS_SIGNUP_LABEL  the conversion label from the Ads "Sign up" action

const env = (import.meta as any).env || {};
const GA_ID = env.VITE_GA_ID as string | undefined;
const GADS_ID = env.VITE_GADS_ID as string | undefined;
const GADS_SIGNUP_LABEL = env.VITE_GADS_SIGNUP_LABEL as string | undefined;

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; }
}

let started = false;

/** Load the Google tag once, in the browser, only if an id is configured. */
export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  const primary = GA_ID || GADS_ID;
  if (!primary) return;
  started = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primary)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };
  window.gtag("js", new Date());
  if (GA_ID) window.gtag("config", GA_ID);
  if (GADS_ID) window.gtag("config", GADS_ID);
}

/** Fire the signup conversion (GA4 event + Google Ads conversion). No-op until
 *  the tag is configured, so it's always safe to call. */
export function trackSignup() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  if (GA_ID) window.gtag("event", "sign_up", { method: "email" });
  if (GADS_ID && GADS_SIGNUP_LABEL) {
    window.gtag("event", "conversion", { send_to: `${GADS_ID}/${GADS_SIGNUP_LABEL}` });
  }
}

/** First-touch acquisition attribution for TryNoBot's OWN signups.
 *
 *  Not to be confused with the UTM fields in lib/api.ts — those describe a
 *  CUSTOMER's visitors. This describes ours: which ad brought the person who
 *  is about to create an account.
 *
 *  Why first touch and not last: the trial is 7 days and the paid conversion
 *  lands weeks later, by which time the visitor arrives direct or via a branded
 *  search. Overwriting on every visit would credit "google / organic" for a
 *  customer the paid campaign actually bought, which is the single easiest way
 *  to switch off the campaign that is working.
 *
 *  The gclid is what makes offline conversion import possible later — Google
 *  can only match a conversion back to a click if we hand back the click id.
 */

const KEY = "tnb_attr";
/** A first touch older than this is stale — a returning visitor from a campaign
 *  that ended months ago is not what that campaign bought. */
const MAX_AGE_DAYS = 90;

export interface Attribution {
  /** Google Ads click id — the join key for offline conversion import. */
  gclid?: string;
  /** Microsoft Ads click id. */
  msclkid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  /** Document referrer at first touch, host only — a full URL can carry PII. */
  referrer?: string;
  /** Path the visitor first landed on: tells us which page earns trials. */
  landing_path?: string;
  /** ISO timestamp of the first touch. */
  first_seen?: string;
}

const PARAMS = ["gclid", "msclkid", "utm_source", "utm_medium",
                "utm_campaign", "utm_term", "utm_content"] as const;

function read(): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Attribution;
    if (v.first_seen) {
      const age = Date.now() - new Date(v.first_seen).getTime();
      if (age > MAX_AGE_DAYS * 86400_000) return null;
    }
    return v;
  } catch {
    return null; // private mode / blocked storage — behave as if unattributed
  }
}

/** Host only, and never our own domain: an internal referrer is not a source. */
function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const h = new URL(document.referrer).hostname;
    return h && h !== window.location.hostname ? h : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Record the first touch, once. Safe to call on every route change: it writes
 * only when nothing is stored yet, so later navigations can't overwrite the
 * campaign that brought the visitor here.
 *
 * Deliberately not gated on cookie consent. This is first-party storage used
 * solely to attribute our own signups, carries no identifier the visitor
 * didn't arrive with, and is the record we need to not waste the ad budget.
 * The Google tag, which is what consent actually governs, stays gated.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  if (read()) return; // first touch already recorded — leave it alone

  const q = new URLSearchParams(window.location.search);
  const attr: Attribution = {};
  for (const p of PARAMS) {
    const v = q.get(p);
    if (v) attr[p] = v.slice(0, 200); // bound it; these land in a DB column
  }
  const ref = referrerHost();
  if (ref) attr.referrer = ref;

  // Nothing at all to attribute (direct, no referrer) is still worth storing:
  // it fixes the landing page and timestamp, and stops a later visit from
  // claiming credit it didn't earn.
  attr.landing_path = window.location.pathname.slice(0, 200);
  attr.first_seen = new Date().toISOString();

  try { localStorage.setItem(KEY, JSON.stringify(attr)); } catch { /* ignore */ }
}

/** The stored first touch, for sending with a signup. Null when unavailable. */
export function getAttribution(): Attribution | null {
  return typeof window === "undefined" ? null : read();
}

/** True when the visitor arrived from a paid click we are paying for. */
export function isPaidClick(): boolean {
  const a = getAttribution();
  return !!(a?.gclid || a?.msclkid || a?.utm_medium === "cpc" || a?.utm_medium === "ppc");
}

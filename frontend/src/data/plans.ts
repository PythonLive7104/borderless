/** Plan feature copy — the single source of truth for both pricing surfaces.
 *
 * The marketing pricing page and the dashboard billing page previously kept
 * their own hard-coded lists and had already drifted: the dashboard sold "TLS
 * fingerprinting (JA3 & JA4)" and "Silent deep browser check" as Plus
 * upgrades, while marketing (correctly) listed both as included on every tier.
 * A customer on Basic could read the two pages and get opposite answers about
 * what they'd paid for.
 *
 * Keep this honest against the backend. Detection features are NOT gated by
 * plan — tiers differ on caps (ad clicks, redirects, sites, retention, team)
 * and on support. Bring-your-own-domain is included on every PAID tier
 * (link_shortener_enabled() in billing/models.py) — it's what makes redirects
 * deliverable in email, so it isn't held back for the top tier. What stays
 * Pro-only is the UNCAPPED redirect allowance on a BYOD domain (is_pro()).
 */

/** Included on every paid tier. */
export const PLAN_BASE: string[] = [
  "Smart redirects with bot detection on every click",
  "Full anti-bot engine (Shield + Traffic Rules)",
  "Deep filters: country, device, OS, connection type, ISP/ASN",
  "VPN / proxy / datacenter blocking + live IP reputation",
  "TLS fingerprinting (JA3 & JA4) + silent deep browser check",
  "Cross-surface bot memory — caught once, flagged everywhere",
  "Filtering funnel & campaign analytics",
  "IP allow / deny rules",
  "Bring your own domain — the reliable way to send redirect links in email",
];

/** What each tier adds on top of the one below it. */
export const PLAN_ADD: Record<string, string[]> = {
  basic: [],
  plus: [
    "Higher ad-click, redirect & antibot-site limits",
    "Longer data retention",
    "Priority support",
  ],
  pro: [
    "Highest ad-click, redirect & antibot-site limits",
    "Longest data retention",
    "Unlimited redirects on your own domain — no per-domain cap",
    "Private domains available",
    "Dedicated support",
  ],
};

/** The "Everything in X" roll-up line shown above a tier's additions. */
export const PLAN_ROLLUP: Record<string, string> = {
  plus: "Everything in Basic",
  pro: "Everything in Plus",
};

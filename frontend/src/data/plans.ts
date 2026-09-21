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
 * and on support. The only code-gated entitlement is bring-your-own-domain,
 * which billing/models.py restricts to Pro via is_pro().
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
    "Bring your own domain — run redirects on your brand",
    "Private domains available",
    "Dedicated support",
  ],
};

/** The "Everything in X" roll-up line shown above a tier's additions. */
export const PLAN_ROLLUP: Record<string, string> = {
  plus: "Everything in Basic",
  pro: "Everything in Plus",
};

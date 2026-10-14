/** Billing interval arithmetic, mirrored from apps/billing/models.py.
 *
 *  These numbers exist on the server too, and the server is authoritative —
 *  what the UI shows here is only ever a preview of what checkout will charge
 *  and provision. They are duplicated rather than fetched because the pricing
 *  page is prerendered and must render correctly with no API call at all.
 *
 *  If you change INTERVAL_DAYS, INTERVAL_MONTHS or the cap cascade, change
 *  Plan._cap_for / ad_clicks_for / INTERVAL_DAYS in models.py in the same
 *  commit. A mismatch here doesn't throw — it quietly advertises an allowance
 *  the server won't grant, which the customer discovers after paying.
 */
import type { BillingInterval, Plan } from "./api";

/** One period, in days. Matches INTERVAL_DAYS on the server. */
export const INTERVAL_DAYS: Record<BillingInterval, number> = {
  weekly: 7,
  monthly: 30,
  yearly: 365,
};

/** How many months of allowance one period buys. Caps are stored per month,
 *  so this converts them. Matches INTERVAL_MONTHS on the server. */
export const INTERVAL_MONTHS: Record<BillingInterval, number> = {
  weekly: 0.25,
  monthly: 1,
  yearly: 12,
};

/** What one period is called in prose. */
export const INTERVAL_NOUN: Record<BillingInterval, string> = {
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

/** Resolve a per-interval cap, falling back down the ladder.
 *
 *  0 means "same as the interval below", so a tier that doesn't differentiate
 *  needs no extra value — and a yearly cap left unset inherits the monthly one
 *  rather than silently dropping to the weekly figure. Mirrors Plan._cap_for().
 */
export function capFor(
  interval: BillingInterval, weekly: number, monthly: number, yearly: number,
): number {
  if (interval === "yearly") return yearly || monthly || weekly;
  if (interval === "monthly") return monthly || weekly;
  return weekly;
}

/** Price of a tier on an interval. 0 means that interval isn't sold. */
export function priceFor(plan: Plan, interval: BillingInterval): number {
  if (interval === "yearly") return plan.price_yearly;
  if (interval === "monthly") return plan.price_monthly;
  return plan.price;
}

/** Badge copy per interval: the best saving any tier achieves on it, against
 *  the interval below. Derived rather than hand-written — the old badge read
 *  "Save up to 46%", a number someone had to remember to update on a reprice.
 *
 *  Intervals no tier offers yet are left out, so the badge never advertises a
 *  discount on something that can't be bought.
 */
export function savingBadges(plans: Plan[]): Partial<Record<BillingInterval, string>> {
  const out: Partial<Record<BillingInterval, string>> = {};
  const best = (f: (p: Plan) => number | null) => {
    const vals = plans.map(f).filter((v): v is number => v !== null && v > 0);
    return vals.length ? Math.floor(Math.max(...vals) * 100) : 0;
  };

  const monthly = best((p) =>
    p.price_monthly && p.price ? 1 - p.price_monthly / (p.price * 4) : null);
  if (monthly > 0) out.monthly = `Save up to ${monthly}%`;

  const yearly = best((p) =>
    p.price_yearly && p.price_monthly ? 1 - p.price_yearly / (p.price_monthly * 12) : null);
  if (yearly > 0) out.yearly = `Save up to ${yearly}%`;

  return out;
}

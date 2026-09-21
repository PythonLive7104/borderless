/** Published entry-tier pricing for the products buyers compare us against.
 *
 * Every figure here was read from the vendor's own pricing page on the date
 * below — not from a review site, which are frequently months stale. This is a
 * public claim about somebody else's business: if it goes out of date it stops
 * being a comparison and becomes a misrepresentation, which is precisely the
 * thing we've cleaned off the rest of this site.
 *
 * RE-CHECK QUARTERLY. If nobody has verified these in six months, delete the
 * section rather than leave it up.
 *
 * Note the units genuinely differ and the table says so: Fraud Blocker meters
 * ad clicks, ClickCease meters all site visits. Presenting them as the same
 * number would flatter us dishonestly — their 5,000 visits is a tighter cap
 * than 5,000 ad clicks, not a looser one.
 */
export const COMPARISON_CHECKED = "21 September 2026";

export interface Competitor {
  name: string;
  /** Published list price per month, in USD. */
  price: number;
  /** Shown when the vendor advertises a lower introductory rate. */
  promo?: number;
  /** Included volume at the entry tier, with its own unit spelled out. */
  volume: string;
  sites: string;
  url: string;
}

export const COMPETITORS: Competitor[] = [
  {
    name: "Fraud Blocker",
    price: 79,
    volume: "5,000 ad clicks",
    sites: "1",
    url: "https://fraudblocker.com/pricing",
  },
  {
    name: "ClickCease",
    price: 99,
    promo: 69,
    volume: "5,000 visits",
    sites: "1",
    url: "https://www.clickcease.com/pricing.html",
  },
  {
    name: "ClickPatrol",
    price: 77, // €71 at the time of checking
    volume: "5,000 ad clicks",
    sites: "1 brand",
    url: "https://clickpatrol.com/pricing/",
  },
];

/** Brand copy and site navigation.
 *
 *  Positioning note, because it drives everything below. This product can be
 *  sold to two different audiences, and they do not want the same page:
 *
 *   - Advertisers and agencies protecting a Google/Microsoft Ads budget. They
 *     search for the problem ("why am I paying for bot clicks"), buy monthly,
 *     and are reachable through paid search.
 *   - Media buyers who want granular traffic filtering on redirect links. They
 *     arrive through forums and word of mouth, not search ads.
 *
 *  The public marketing site is aimed squarely at the first group. That is not
 *  a judgement about the second — those features exist, are documented, and are
 *  described factually on /features and in the docs. It is that a shop window
 *  leading with decoy redirects and rented short domains reads, to the exact
 *  buyer we want and to the ad reviewer deciding whether our own campaigns run,
 *  as something other than the fraud-detection product this is. Lead with the
 *  budget, let the depth be found.
 */
export const BRAND = {
  name: "TryNoBot",
  tagline: "Stop paying for clicks that were never people.",
  subtitle:
    "Every visitor to your ad landing pages scored 0-100 in real time. Bots, click fraud, proxies and datacenter traffic caught before they drain the budget — with the exact signals behind every decision.",
};

/** Primary nav. Ordered by what a paid-search visitor needs to answer, in the
 *  order they ask it: what is it, does it solve my problem, is it credible,
 *  what does it cost. Comparisons sit in the nav because "<competitor>
 *  alternative" is the highest-intent search in this category and the page
 *  needs to be reachable from anywhere on the site. */
export const NAV_LINKS = [
  { label: "How it works", to: "/features" },
  { label: "Click fraud", to: "/fraud-detection" },
  { label: "Analytics", to: "/analytics" },
  { label: "Compare", to: "/compare" },
  { label: "Pricing", to: "/pricing" },
  { label: "Free check", to: "/bot-check" },
  { label: "Docs", to: "/docs" },
];

export const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "How it works", to: "/features" },
      { label: "Click fraud detection", to: "/fraud-detection" },
      { label: "Traffic intelligence", to: "/traffic-intelligence" },
      { label: "Analytics", to: "/analytics" },
      { label: "Integrations", to: "/integrations" },
      { label: "Pricing", to: "/pricing" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Free bot check", to: "/bot-check" },
      { label: "Blog", to: "/blog" },
      { label: "Compare alternatives", to: "/compare" },
      { label: "vs ClickCease", to: "/compare/clickcease" },
      { label: "vs Fraud Blocker", to: "/compare/fraud-blocker" },
      { label: "FAQ", to: "/faq" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API", to: "/api" },
      { label: "Documentation", to: "/docs" },
      { label: "Status", to: "/status" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Contact", to: "/contact" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
      // Discoverable abuse reporting: a complainant who can't find this goes
      // to our registrar instead, and the whole short domain gets suspended.
      { label: "Report abuse", to: "/report" },
    ],
  },
];

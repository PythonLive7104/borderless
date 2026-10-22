/** Head-to-head comparison content for the /compare pages.
 *
 *  These pages exist to catch the "<competitor> alternative" and
 *  "<competitor> vs" searches, which convert far better than the head terms
 *  and cost a fraction per click — the buyer has already decided they want
 *  this category and is only choosing a vendor.
 *
 *  Three rules, and they are not stylistic:
 *
 *  1. Every claim about a competitor is something a reader can verify on that
 *     competitor's own public pages. Prices come from data/competitors.ts,
 *     which carries the date they were read. Nothing here asserts what another
 *     vendor's detection does internally, because we cannot see it.
 *  2. Every page says where the competitor is genuinely the better choice.
 *     This is not modesty: a comparison with no downside reads as an advert
 *     and converts like one, and an unsupported knock on a named competitor is
 *     the kind of claim that invites a complaint we would lose.
 *  3. "Not published" is written as not published — never as "none" or "no".
 *     The absence of a feature from a pricing page is not proof it is missing.
 *
 *  RE-CHECK WITH competitors.ts, QUARTERLY.
 */
import { COMPARISON_CHECKED, COMPETITORS, type Competitor } from "./competitors";

/** One row of the head-to-head table. */
export interface CompareRow {
  label: string;
  /** What TryNoBot does. */
  us: string;
  /** What the competitor publishes. Keep it to the publishable facts. */
  them: string;
  /** Marks the rows that are the actual reason to switch. */
  edge?: boolean;
}

export interface Comparison {
  /** URL segment: /compare/<slug> */
  slug: string;
  /** Competitor as they brand themselves. */
  name: string;
  /** Page title — carries the phrase people actually search. */
  title: string;
  metaDescription: string;
  /** One-paragraph honest summary, shown under the H1. */
  intro: string;
  /** The short answer, for the reader who reads nothing else. */
  verdict: string;
  rows: CompareRow[];
  /** Where they win. Required, not optional — see rule 2. */
  theirStrengths: string[];
  /** Where we win, in plain terms. */
  ourStrengths: string[];
  faq: { q: string; a: string }[];
}

const byName = (n: string): Competitor => {
  const c = COMPETITORS.find((x) => x.name === n);
  if (!c) throw new Error("comparisons.ts: no competitor named " + n + " in competitors.ts");
  return c;
};

const clickcease = byName("ClickCease");
const fraudblocker = byName("Fraud Blocker");
const clickpatrol = byName("ClickPatrol");

/** Rows every comparison shares, so our own column can't drift between pages. */
const OURS = {
  price: "$69/month billed monthly, or $690/year — annual is an option, never a requirement",
  volume: "10,000 ad clicks/month",
  sites: "10 websites",
  tls: "JA3 + JA4 TLS fingerprinting on every request",
  serverSide: "Server-side Shield — PHP, Django, Node, nginx, Cloudflare Workers",
  network: "Cross-customer bot memory, matched on fingerprint cardinality",
  scoring: "0–100 score with the exact signals that produced it",
  latency: "Under 10ms decision latency",
  trial: "7-day trial, no credit card",
  crawlers: "Verified search crawlers are identified by reverse DNS, not user-agent, "
          + "and always receive the same page as a human visitor",
};

const NOT_PUBLISHED = "Not published on their pricing or features pages";

/** The one row we must never quietly drop: it is the gap buyers care most
 *  about, and omitting it from a comparison page would be the dishonest kind
 *  of selective reporting these pages are written to avoid. */
const ADS_EXCLUSIONS_US = "On the roadmap — not shipped yet";

export const COMPARISONS: Comparison[] = [
  {
    slug: "clickcease",
    name: "ClickCease",
    title: "TryNoBot vs ClickCease — a ClickCease alternative for 2026",
    metaDescription:
      "An honest comparison of TryNoBot and ClickCease: published pricing, included volume, site limits, TLS fingerprinting and server-side blocking. Includes where ClickCease is the better pick.",
    intro:
      "ClickCease is the best-known name in click-fraud protection and is now part of CHEQ. It is a mature product with years of reviews behind it, and if brand familiarity is what you are buying, it is the safe choice. TryNoBot is newer and takes a different technical approach: scoring happens on a Go hot path in under 10ms, detection includes JA3/JA4 TLS fingerprinting, and the same engine can run server-side — before your page renders — not only from a JavaScript tag.",
    verdict:
      "Choose ClickCease if you want the established brand and its ad-platform integrations. Choose TryNoBot if you run more than one site, want server-side and TLS-level detection, or do not want to commit to annual billing to get a reasonable rate.",
    rows: [
      {
        label: "Entry price", us: OURS.price, edge: true,
        them: "$" + clickcease.price + "/month list, $" + clickcease.promo +
              " introductory — their published intro rate covers the first three billing cycles",
      },
      { label: "Included volume", us: OURS.volume, them: clickcease.volume + " at the entry tier", edge: true },
      { label: "Websites", us: OURS.sites, them: clickcease.sites + " at the entry tier", edge: true },
      {
        label: "Metering unit", us: "Ad clicks — organic traffic is scored but not metered",
        them: "All site visits, which is a tighter cap than the same number of ad clicks",
      },
      { label: "TLS fingerprinting", us: OURS.tls, them: NOT_PUBLISHED, edge: true },
      // Deliberately NOT marked `edge`. Serving a crawler different content
      // from a visitor is cloaking and can cost a site its rankings, so what
      // a blocker does here matters — but we cannot see what anyone else
      // does, and rule 1 at the top of this file forbids guessing.
      { label: "Search-engine safety", us: OURS.crawlers, them: NOT_PUBLISHED },
      { label: "Server-side enforcement", us: OURS.serverSide, them: NOT_PUBLISHED, edge: true },
      {
        label: "Shared threat network", us: OURS.network,
        them: "Cross-customer detection is advertised; the matching method is not published",
      },
      { label: "Score transparency", us: OURS.scoring, them: NOT_PUBLISHED, edge: true },
      {
        label: "Google Ads IP exclusions", us: ADS_EXCLUSIONS_US,
        them: "Automatic IP exclusion push to Google Ads",
      },
      {
        label: "Billing", us: "Weekly, monthly or yearly, cancel anytime",
        them: "Best rate requires annual billing; check the current cancellation terms before signing",
      },
      { label: "Trial", us: OURS.trial, them: "7-day free trial" },
    ],
    theirStrengths: [
      "Automatic IP exclusion lists pushed into your Google Ads account — TryNoBot does not do this yet, and for some buyers that alone decides it",
      "Years of public reviews and case studies, and the backing of CHEQ",
      "A wider set of native ad-platform integrations, including Microsoft Ads",
      "A larger support organisation than a newer product can offer",
    ],
    ourStrengths: [
      "Ten sites and 10,000 ad clicks at the price of their one-site entry tier",
      "JA3/JA4 TLS fingerprinting catches automation that presents a clean IP and a convincing user-agent",
      "A server-side Shield stops bots that never execute JavaScript, which a tag-only product cannot see",
      "Every score comes with the signals behind it, so you can argue with it",
      "Monthly billing at the list price — annual is offered and discounted, but never required to avoid a penalty rate",
    ],
    faq: [
      {
        q: "Is TryNoBot a drop-in replacement for ClickCease?",
        a: "For detection and blocking on your own site, yes — you install a tag or the server-side Shield and set your rules. The gap is ad-platform automation: ClickCease pushes IP exclusions into Google Ads for you, and TryNoBot does not do that yet. If that automation is the reason you bought ClickCease, wait for it.",
      },
      {
        q: "Why is TryNoBot cheaper for more volume?",
        a: "Lower overheads and a cheaper hot path. The decision engine is a small Go service reading from Redis, so the marginal cost of scoring a click is very low, and we are not carrying an enterprise sales organisation.",
      },
      {
        q: "Does ClickCease meter the same thing as TryNoBot?",
        a: "No, and it matters. Their entry tier meters all site visits; ours meters paid ad clicks. 5,000 visits is a tighter limit than 10,000 ad clicks, not a looser one, because organic traffic eats into it.",
      },
    ],
  },
  {
    slug: "fraud-blocker",
    name: "Fraud Blocker",
    title: "TryNoBot vs Fraud Blocker — a Fraud Blocker alternative for 2026",
    metaDescription:
      "TryNoBot compared with Fraud Blocker on published price, ad-click allowance, site limits, TLS fingerprinting and server-side blocking — including where Fraud Blocker wins.",
    intro:
      "Fraud Blocker is a well-reviewed click-fraud tool aimed squarely at small businesses and agencies running Google Ads, with a clean dashboard and a genuine Google Ads integration. TryNoBot overlaps with it on detection and goes further on the technical side — TLS fingerprinting, server-side enforcement and explainable scores — while including considerably more volume and more sites at the entry price.",
    verdict:
      "Fraud Blocker is the better buy if your whole problem is one Google Ads account and you want IP exclusions handled for you today. TryNoBot is the better buy if you manage several sites, need to stop non-JavaScript automation, or want to see why a visitor was scored the way it was.",
    rows: [
      {
        label: "Entry price", us: OURS.price, edge: true,
        them: "$" + fraudblocker.price + "/month list, lower on annual billing",
      },
      { label: "Included volume", us: OURS.volume, them: fraudblocker.volume + " at the entry tier", edge: true },
      { label: "Websites", us: OURS.sites, them: fraudblocker.sites + " at the entry tier", edge: true },
      { label: "Metering unit", us: "Ad clicks", them: "Ad clicks — directly comparable" },
      { label: "TLS fingerprinting", us: OURS.tls, them: NOT_PUBLISHED, edge: true },
      // Deliberately NOT marked `edge`. Serving a crawler different content
      // from a visitor is cloaking and can cost a site its rankings, so what
      // a blocker does here matters — but we cannot see what anyone else
      // does, and rule 1 at the top of this file forbids guessing.
      { label: "Search-engine safety", us: OURS.crawlers, them: NOT_PUBLISHED },
      { label: "Server-side enforcement", us: OURS.serverSide, them: NOT_PUBLISHED, edge: true },
      { label: "Shared threat network", us: OURS.network, them: NOT_PUBLISHED, edge: true },
      {
        label: "Score transparency", us: OURS.scoring,
        them: "A fraud score is shown; the contributing signals are not published",
      },
      {
        label: "Google Ads IP exclusions", us: ADS_EXCLUSIONS_US,
        them: "Automatic IP exclusion push to Google Ads",
      },
      { label: "Decision latency", us: OURS.latency, them: NOT_PUBLISHED },
      { label: "Trial", us: OURS.trial, them: "7-day free trial" },
    ],
    theirStrengths: [
      "A shipped Google Ads integration that writes exclusions back to your account — the single biggest thing TryNoBot is still missing",
      "A long record of positive small-business and agency reviews",
      "Thousands of domains on the platform, which is the kind of proof a new product cannot manufacture",
      "A simpler product with less to learn if all you want is one-account protection",
    ],
    ourStrengths: [
      "Ten sites against their single-site entry tier, at a lower monthly price",
      "Twice the ad-click allowance, metered the same way, so the comparison is direct",
      "TLS-level detection (JA3/JA4) that does not depend on the visitor running your JavaScript",
      "Server-side Shield for PHP, Django, Node, nginx and Cloudflare Workers",
      "Shared bot memory across all customers, matched on fingerprint cardinality rather than a single sighting",
    ],
    faq: [
      {
        q: "Which is better for an agency?",
        a: "If the agency wants hands-off Google Ads exclusion management, Fraud Blocker today. If it manages many client sites and wants one bill, ten sites on TryNoBot's entry tier is a materially different proposition from one.",
      },
      {
        q: "Do both meter ad clicks the same way?",
        a: "Yes. Both meter paid ad clicks at the entry tier, so 10,000 against 5,000 is a like-for-like comparison — unlike ClickCease, which meters all site visits.",
      },
      {
        q: "What does TryNoBot catch that a JavaScript tag cannot?",
        a: "Anything that never runs the tag: scripted HTTP clients, scrapers, and automation hitting your pages or endpoints directly. The server-side Shield scores those before your page renders.",
      },
    ],
  },
  {
    slug: "clickpatrol",
    name: "ClickPatrol",
    title: "TryNoBot vs ClickPatrol — a ClickPatrol alternative for 2026",
    metaDescription:
      "TryNoBot compared with ClickPatrol on published pricing, ad-click volume, brand and site limits, and detection depth — with an honest note on where ClickPatrol fits better.",
    intro:
      "ClickPatrol is a European click-fraud product with a strong content presence and a per-brand entry tier. It is a credible choice, particularly for EU advertisers who want a vendor in the same jurisdiction. TryNoBot competes on included volume, site count and detection depth, and prices in dollars with monthly billing.",
    verdict:
      "ClickPatrol suits a single-brand EU advertiser who values an EU vendor relationship. TryNoBot suits multi-site operators and anyone who wants TLS-level and server-side detection alongside the standard IP and behavioural checks.",
    rows: [
      {
        label: "Entry price", us: OURS.price, edge: true,
        them: "About $" + clickpatrol.price + "/month, priced in euros",
      },
      { label: "Included volume", us: OURS.volume, them: clickpatrol.volume + " at the entry tier", edge: true },
      { label: "Scope", us: OURS.sites, them: clickpatrol.sites + " at the entry tier", edge: true },
      { label: "Metering unit", us: "Ad clicks", them: "Ad clicks — directly comparable" },
      { label: "TLS fingerprinting", us: OURS.tls, them: NOT_PUBLISHED, edge: true },
      // Deliberately NOT marked `edge`. Serving a crawler different content
      // from a visitor is cloaking and can cost a site its rankings, so what
      // a blocker does here matters — but we cannot see what anyone else
      // does, and rule 1 at the top of this file forbids guessing.
      { label: "Search-engine safety", us: OURS.crawlers, them: NOT_PUBLISHED },
      { label: "Server-side enforcement", us: OURS.serverSide, them: NOT_PUBLISHED, edge: true },
      { label: "Score transparency", us: OURS.scoring, them: NOT_PUBLISHED, edge: true },
      {
        label: "Google Ads IP exclusions", us: ADS_EXCLUSIONS_US,
        them: "Google Ads integration advertised",
      },
      { label: "Currency", us: "USD", them: "EUR, so your cost moves with the exchange rate" },
      { label: "Trial", us: OURS.trial, them: "Free trial advertised; check current terms" },
    ],
    theirStrengths: [
      "An EU-based vendor, which simplifies procurement and data-residency conversations for European advertisers",
      "Euro pricing with no FX exposure if you budget in euros",
      "A substantial published library on click fraud, and an established review footprint",
      "A shipped Google Ads integration",
    ],
    ourStrengths: [
      "Ten websites against a single-brand entry tier",
      "Twice the ad-click allowance at a lower monthly price",
      "JA3/JA4 TLS fingerprinting and a server-side Shield",
      "Explainable 0–100 scores with the contributing signals shown",
    ],
    faq: [
      {
        q: "Does TryNoBot work for EU advertisers?",
        a: "Yes. The tracker is consent-aware, data retention is configurable, and verified ad-review crawlers are always served exactly what a human is served. If EU data residency is a hard procurement requirement, ask us before you buy rather than after.",
      },
      {
        q: "Is the price comparison fair given the currency difference?",
        a: "It is approximate by nature. ClickPatrol lists in euros; the dollar figure in the table is a conversion taken on the date noted below the table, and it moves.",
      },
    ],
  },
];

export const comparisonBySlug = (slug: string): Comparison | undefined =>
  COMPARISONS.find((c) => c.slug === slug);

export { COMPARISON_CHECKED };

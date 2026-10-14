/** Structured data (JSON-LD) builders, for search engines and answer engines.
 *
 *  Why this is a module of plain builders rather than a hook: schema has to be
 *  in the PRERENDERED markup. Anything injected from an effect lands after
 *  hydration, and most crawlers — and nearly every AI answer engine — read the
 *  server response and never run the script. The FAQ page already proved the
 *  pattern; this generalises it so every page can use it the same way.
 *
 *  House rule carried over from the rest of the site: schema states only what
 *  the page itself says and what we can substantiate. No invented ratings, no
 *  aggregateRating without real reviews, no counts we cannot evidence. Fake
 *  review markup is a manual-action risk, and an answer engine repeating an
 *  invented number is worse than it saying nothing.
 */

export const ORIGIN = "https://trynobot.com";
const LOGO = `${ORIGIN}/og-image.png`;

/** Stable @id values so the graph can cross-reference rather than repeat. */
export const ORG_ID = `${ORIGIN}/#organization`;
export const SITE_ID = `${ORIGIN}/#website`;

/** Absolute URL for a site-relative path. */
export const abs = (path: string): string =>
  path === "/" ? `${ORIGIN}/` : `${ORIGIN}${path}`;

/**
 * Serialise for embedding in a <script> tag.
 *
 * `</script>` inside any string value would close the tag early and spill the
 * rest of the JSON into the document as markup — so `<` is escaped. The other
 * two are belt-and-braces against older parsers treating them as delimiters.
 */
export function serialize(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** Who we are. Emitted once per page, referenced by everything else. */
export function organization() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: "TryNoBot",
    url: `${ORIGIN}/`,
    logo: { "@type": "ImageObject", url: LOGO, width: 1200, height: 630 },
    description:
      "TryNoBot scores every visitor to your ad landing pages in real time and blocks bots, click fraud, proxies and datacenter traffic before they waste your ad budget.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${ORIGIN}/contact`,
      availableLanguage: "English",
    },
  };
}

/** The site itself. SearchAction is deliberately omitted: we have no site
 *  search endpoint, and declaring one that 404s is worse than declaring none. */
export function website() {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: `${ORIGIN}/`,
    name: "TryNoBot",
    publisher: { "@id": ORG_ID },
    inLanguage: "en",
  };
}

export interface Crumb {
  name: string;
  path: string;
}

/** Breadcrumbs give answer engines the page's place in the site, and search
 *  engines a richer result line than a bare URL. */
export function breadcrumbs(trail: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.path),
    })),
  };
}

/** Question/answer pairs, the single highest-value schema for answer engines:
 *  it hands them an extractable answer instead of making them infer one. */
export function faqPage(qa: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export interface OfferSpec {
  name: string;
  price: number;
  /** Billing period as an ISO 8601 duration: P7D, P1M, P1Y. */
  duration: string;
  description: string;
}

/** The product and what it costs.
 *
 *  "How much does TryNoBot cost" is the question answer engines are asked most
 *  about any SaaS, and an Offer with a real number is what lets them answer it
 *  instead of guessing from page text.
 */
export function softwareApplication(offers: OfferSpec[]) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${ORIGIN}/#software`,
    name: "TryNoBot",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Click fraud protection",
    operatingSystem: "Web",
    url: `${ORIGIN}/`,
    publisher: { "@id": ORG_ID },
    description:
      "Real-time click fraud protection and traffic intelligence. Scores every visitor 0-100, classifies them as human, suspicious, bot or fraud, and blocks the bad ones before they cost you ad spend.",
    featureList: [
      "Real-time risk scoring with the contributing signals shown",
      "JA3 and JA4 TLS fingerprinting",
      "Server-side Shield for PHP, Django, Node, nginx and Cloudflare Workers",
      "Live IP reputation: proxy, VPN, datacenter and recent-abuse checks",
      "Cross-customer shared bot network",
      "Campaign analytics and conversion tracking",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...offers.map((o) => o.price)),
      highPrice: Math.max(...offers.map((o) => o.price)),
      offerCount: offers.length,
      offers: offers.map((o) => ({
        "@type": "Offer",
        name: o.name,
        price: o.price,
        priceCurrency: "USD",
        description: o.description,
        availability: "https://schema.org/InStock",
        url: `${ORIGIN}/pricing`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: o.price,
          priceCurrency: "USD",
          billingDuration: o.duration,
        },
      })),
    },
  };
}

export interface ArticleSpec {
  headline: string;
  description: string;
  path: string;
  datePublished: string;
  section: string;
  wordCount?: number;
}

/** A blog post. Author is the organisation rather than an invented person —
 *  naming a byline nobody can be shown is the kind of small fiction that
 *  undermines everything else on the page. */
export function blogPosting(a: ArticleSpec) {
  return {
    "@type": "BlogPosting",
    "@id": `${abs(a.path)}#article`,
    headline: a.headline,
    description: a.description,
    url: abs(a.path),
    datePublished: a.datePublished,
    dateModified: a.datePublished,
    articleSection: a.section,
    ...(a.wordCount ? { wordCount: a.wordCount } : {}),
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": SITE_ID },
    mainEntityOfPage: { "@type": "WebPage", "@id": abs(a.path) },
    image: LOGO,
    inLanguage: "en",
  };
}

/** Wrap one or more nodes into a single @graph document.
 *
 *  One script tag per page rather than several: duplicate @context blocks are
 *  legal but make the graph harder for consumers to resolve, and a single graph
 *  lets nodes reference each other by @id.
 */
export function graph(...nodes: object[]): string {
  return serialize({ "@context": "https://schema.org", "@graph": nodes });
}

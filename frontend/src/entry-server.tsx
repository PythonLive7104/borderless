import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { AuthProvider } from "./context/AuthContext";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import { DialogProvider } from "./context/DialogContext";
import AppRoutes from "./AppRoutes";
import { COMPARISONS } from "./data/comparisons";
import { postsByDate } from "./data/posts";

// Called by the prerender script for each public route.
export function render(url: string): string {
  return renderToString(
    <AuthProvider>
      <WorkspaceProvider>
        <DialogProvider>
          <StaticRouter location={url}>
            <AppRoutes />
          </StaticRouter>
        </DialogProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export interface PrerenderRoute {
  path: string;
  /** Output file, relative to dist/. */
  out: string;
  title: string;
  desc: string;
  /** Sitemap priority. Defaults applied by the prerender script when absent. */
  priority?: string;
}

/** Every public route, in one place.
 *
 *  This lives here rather than in scripts/prerender.mjs because the comparison
 *  and blog routes are generated from data/comparisons.ts and data/posts.ts —
 *  a plain .mjs script cannot read those, and a hand-kept copy of the list is
 *  exactly how a published post ends up missing from the sitemap. Adding a post
 *  to posts.ts now prerenders it and lists it, with no second edit.
 */
export function routes(): PrerenderRoute[] {
  const staticRoutes: PrerenderRoute[] = [
    { path: "/", out: "index.html", priority: "1.0", title: "Stop paying for bot clicks on your ads", desc: "Protect your Google and Microsoft Ads budget: every visitor scored 0-100 in real time, bots and click fraud blocked before they cost you, with the exact signals behind every decision." },
    { path: "/features", out: "features/index.html", title: "Features", desc: "Real-time scoring, JS + TLS/JA3 fingerprinting, traffic rules, IP allow/deny, server-side blocking and more." },
    { path: "/traffic-intelligence", out: "traffic-intelligence/index.html", title: "Traffic intelligence", desc: "Understand who's really visiting — real users vs bots — with real-time visitor intelligence." },
    { path: "/fraud-detection", out: "fraud-detection/index.html", priority: "0.9", title: "Click fraud detection", desc: "Detect and block bots, click fraud, proxies and VPNs before they waste your ad budget." },
    { path: "/analytics", out: "analytics/index.html", title: "Traffic analytics", desc: "See traffic quality, sources, conversions and fraud across all your campaigns in one dashboard." },
    { path: "/integrations", out: "integrations/index.html", title: "Integrations", desc: "Connect TryNoBot with your stack via the JavaScript tracker, REST API and webhooks." },
    { path: "/api", out: "api/index.html", title: "API", desc: "Automate everything with the TryNoBot REST API and webhooks." },
    { path: "/pricing", out: "pricing/index.html", priority: "0.9", title: "Pricing", desc: "10,000 ad clicks and 10 sites protected from $69/month. Start free, no credit card." },
    { path: "/compare", out: "compare/index.html", priority: "0.9", title: "Compare TryNoBot with the alternatives", desc: "Honest head-to-head comparisons against ClickCease, Fraud Blocker and ClickPatrol — published prices, included volume, and where each of them wins." },
    { path: "/blog", out: "blog/index.html", priority: "0.8", title: "Blog — ad traffic, bots and click fraud", desc: "Practical writing on ad traffic quality: diagnosing invalid clicks yourself, what datacenter IPs and TLS fingerprints tell you, and what to compare when buying protection." },
    { path: "/bot-check", out: "bot-check/index.html", priority: "0.9", title: "Free bot exposure check", desc: "Scan any website in 10 seconds and see how exposed it is to bots — free, no signup." },
    { path: "/docs", out: "docs/index.html", title: "Documentation", desc: "Install the tracker, create rules and integrate TryNoBot with your site." },
    { path: "/faq", out: "faq/index.html", title: "FAQ", desc: "Answers to common questions about TryNoBot's bot detection and pricing." },
    { path: "/contact", out: "contact/index.html", title: "Contact", desc: "Get in touch with the TryNoBot team." },
    { path: "/status", out: "status/index.html", title: "Status", desc: "TryNoBot system status." },
    { path: "/terms", out: "terms/index.html", title: "Terms of Service", desc: "TryNoBot terms of service." },
    { path: "/privacy", out: "privacy/index.html", title: "Privacy Policy", desc: "How TryNoBot handles your data." },
    { path: "/report", out: "report/index.html", title: "Report a redirect link", desc: "Report a TryNoBot short link used for phishing, malware or spam. We re-scan the destination immediately and disable confirmed threats." },
  ];

  // The comparison pages carry their own search-intent titles ("<competitor>
  // alternative"), so they are used verbatim rather than prefixed.
  const compareRoutes: PrerenderRoute[] = COMPARISONS.map((c) => ({
    path: `/compare/${c.slug}`,
    out: `compare/${c.slug}/index.html`,
    title: c.title,
    desc: c.metaDescription,
    priority: "0.8",
  }));

  const blogRoutes: PrerenderRoute[] = postsByDate().map((p) => ({
    path: `/blog/${p.slug}`,
    out: `blog/${p.slug}/index.html`,
    title: p.title,
    desc: p.description,
    priority: "0.7",
  }));

  return [...staticRoutes, ...compareRoutes, ...blogRoutes];
}

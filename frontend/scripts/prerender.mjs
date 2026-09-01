// Post-build: server-render each public route to static HTML for SEO + fast paint.
import fs from "node:fs";
import path from "node:path";
import { render } from "../dist-server/entry-server.js";

const dist = path.resolve("dist");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf-8");
const BRAND = "TrackAudit";

const routes = [
  { path: "/", out: "index.html", title: "Real-time traffic intelligence & bot detection", desc: "Score every visitor, block bots and fraud, and protect your ad campaigns in real time with TrackAudit." },
  { path: "/features", out: "features/index.html", title: "Features", desc: "Real-time scoring, JS + TLS/JA3 fingerprinting, traffic rules, IP allow/deny, A/B testing and more." },
  { path: "/traffic-intelligence", out: "traffic-intelligence/index.html", title: "Traffic intelligence", desc: "Understand who's really visiting — real users vs bots — with real-time visitor intelligence." },
  { path: "/fraud-detection", out: "fraud-detection/index.html", title: "Fraud detection", desc: "Detect and block bots, click fraud, proxies and VPNs before they waste your ad budget." },
  { path: "/analytics", out: "analytics/index.html", title: "Traffic analytics", desc: "See traffic quality, sources, conversions and fraud across all your campaigns in one dashboard." },
  { path: "/integrations", out: "integrations/index.html", title: "Integrations", desc: "Connect TrackAudit with your stack via the JavaScript tracker, REST API and webhooks." },
  { path: "/api", out: "api/index.html", title: "API", desc: "Automate everything with the TrackAudit REST API and webhooks." },
  { path: "/pricing", out: "pricing/index.html", title: "Pricing", desc: "Simple plans for real-time bot and fraud detection. Start free, upgrade as you grow." },
  { path: "/bot-check", out: "bot-check/index.html", title: "Free bot exposure check", desc: "Scan any website in 10 seconds and see how exposed it is to bots — free, no signup." },
  { path: "/docs", out: "docs/index.html", title: "Documentation", desc: "Install the tracker, create rules and integrate TrackAudit with your site." },
  { path: "/faq", out: "faq/index.html", title: "FAQ", desc: "Answers to common questions about TrackAudit's bot detection and pricing." },
  { path: "/contact", out: "contact/index.html", title: "Contact", desc: "Get in touch with the TrackAudit team." },
  { path: "/status", out: "status/index.html", title: "Status", desc: "TrackAudit system status." },
  { path: "/terms", out: "terms/index.html", title: "Terms of Service", desc: "TrackAudit terms of service." },
  { path: "/privacy", out: "privacy/index.html", title: "Privacy Policy", desc: "How TrackAudit handles your data." },
];

function withHead(html, title, desc) {
  const full = `${title} · ${BRAND}`;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${full}</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${desc}">`);
  const og = `<meta property="og:title" content="${full}"><meta property="og:description" content="${desc}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${full}"><meta name="twitter:description" content="${desc}">`;
  return html.replace("</head>", og + "</head>");
}

let ok = 0;
for (const r of routes) {
  let appHtml = "";
  try { appHtml = render(r.path); }
  catch (e) { console.error("prerender FAILED for", r.path, "-", e.message); continue; }
  let out = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
  out = withHead(out, r.title, r.desc);
  const dest = path.join(dist, r.out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  ok++;
}
console.log(`prerender: wrote ${ok}/${routes.length} pages`);

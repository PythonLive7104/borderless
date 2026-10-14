// Post-build: server-render each public route to static HTML for SEO + fast paint.
import fs from "node:fs";
import path from "node:path";
import { render, routes } from "../dist-server/entry-server.js";

const dist = path.resolve("dist");
const template = fs.readFileSync(path.join(dist, "index.html"), "utf-8");
const BRAND = "TryNoBot";
// Canonical origin for absolute URLs (og:url, canonical, sitemap).
const ORIGIN = (process.env.SITE_ORIGIN || "https://trynobot.com").replace(/\/$/, "");
const OG_IMAGE = `${ORIGIN}/og-image.png`;

// The route list — including the comparison and blog pages generated from
// data/comparisons.ts and data/posts.ts — comes from the SSR bundle, so it
// cannot list a page that doesn't exist or miss one that does.
const ROUTES = routes();

/** Comparison titles already read "TryNoBot vs X"; suffixing the brand again
 *  gives "...vs ClickCease · TryNoBot", which wastes the most valuable
 *  characters in the search result. */
const fullTitle = (title) => (title.includes(BRAND) ? title : `${title} · ${BRAND}`);

/** Attribute values land inside double-quoted HTML attributes. A description
 *  containing a quote or an ampersand would otherwise break out of it. */
function attr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function withHead(html, title, desc, routePath) {
  const full = fullTitle(title);
  const url = `${ORIGIN}${routePath === "/" ? "/" : routePath}`;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${attr(full)}</title>`);
  html = html.replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${attr(desc)}">`);
  // Replace the shell's page-level tags rather than appending duplicates —
  // two og:title tags is worse than none, and crawlers pick unpredictably.
  html = html.replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`);
  html = html.replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${url}">`);
  html = html.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${attr(full)}">`);
  html = html.replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${attr(desc)}">`);
  const tw = `<meta name="twitter:title" content="${attr(full)}"><meta name="twitter:description" content="${attr(desc)}"><meta name="twitter:image" content="${OG_IMAGE}">`;
  return html.replace("</head>", tw + "</head>");
}

// Blank SPA shell (empty #root) for app routes (dashboard/admin/auth). nginx
// serves this as the fallback so those routes DON'T flash the pre-rendered
// landing page before React boots — the shell is empty, so React paints the
// real page (or its auth spinner) directly.
// noindex: nginx serves this shell for ANY unmatched URL (try_files ... /_shell.html),
// so without it Google indexes every stray path as a 200 that duplicates the home page.
fs.writeFileSync(
  path.join(dist, "_shell.html"),
  template.replace("</head>", '<meta name="robots" content="noindex">\n</head>'),
);

let ok = 0;
const failed = [];
for (const r of ROUTES) {
  let appHtml = "";
  try { appHtml = render(r.path); }
  catch (e) { console.error("prerender FAILED for", r.path, "-", e.message); failed.push(r.path); continue; }
  let out = template.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
  out = withHead(out, r.title, r.desc, r.path);
  const dest = path.join(dist, r.out);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  ok++;
}

// Sitemap from the same route list the pages come from — it cannot list a page
// that doesn't exist, or miss one that does. A route that failed to render is
// left out: listing a page we didn't write is worse than not listing it.
const today = new Date().toISOString().slice(0, 10);
const urls = ROUTES.filter((r) => !failed.includes(r.path)).map((r) => {
  const loc = `${ORIGIN}${r.path === "/" ? "/" : r.path}`;
  const priority = r.priority || (r.path === "/" ? "1.0" : "0.7");
  // Blog posts and comparisons are edited rarely; the rest of the site moves
  // with releases. Claiming weekly for a post written in September invites
  // Google to discount the whole file's hints.
  const changefreq = r.path.startsWith("/blog/") || r.path.startsWith("/compare/") ? "monthly" : "weekly";
  return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n` +
         `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}).join("\n");
fs.writeFileSync(path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);

console.log(`prerender: wrote ${ok}/${ROUTES.length} pages + sitemap.xml`);
if (failed.length) {
  console.error(`prerender: ${failed.length} route(s) failed:`, failed.join(", "));
  process.exitCode = 1; // a half-built site should not ship silently
}

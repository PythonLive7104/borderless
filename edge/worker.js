/**
 * TryNoBot edge redirector (Cloudflare Worker).
 *
 * Serves short-link redirects in the visitor's own city for links that filter
 * NOBODY — where an edge 302 is provably identical to what the origin would do.
 * Django decides which links qualify (apps/links/edge.py: edge_simple) and
 * mirrors only those into the SHORTLINKS KV namespace. Anything not in KV —
 * a filtering link, an unknown slug, a reserved path — is passed straight
 * through to the origin, which stays the single source of truth.
 *
 * The visitor gets an instant redirect; the click is reported to the origin
 * asynchronously (waitUntil) so counters, IP/fingerprint memory and the shared
 * corpus keep updating centrally, exactly as for an origin-served click.
 */

// Paths the short domain answers itself at the origin (abuse page, bot decoys,
// ACME) — never treated as slugs.
const RESERVED = new Set([
  "", "report", "abuse", "favicon.ico",
  "decoy.html", "not-found.html", "blocked.html", "unauthorized.html",
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const slug = decodeURIComponent(url.pathname.replace(/^\/+/, ""));

    // Reserved paths and ACME challenges are the origin's job.
    if (RESERVED.has(slug) || slug.startsWith(".well-known/")) {
      return fetch(request);
    }

    let record = null;
    try {
      record = await env.SHORTLINKS.get(`${url.hostname}:${slug}`, { type: "json" });
    } catch (_) {
      // KV hiccup: fail safe to the origin rather than dropping the click.
      return fetch(request);
    }

    // Not an edge-safe link (filters someone, unknown, or withdrawn): origin decides.
    if (!record || !record.dest) {
      return fetch(request);
    }

    // Build the destination, forwarding query params when the link opts in.
    let dest = record.dest;
    if (record.forward_params && url.search) {
      const incoming = new URLSearchParams(url.search);
      const keep = Array.isArray(record.forward_keys) && record.forward_keys.length
        ? record.forward_keys
        : [...incoming.keys()];
      const out = new URL(dest);
      for (const k of keep) {
        const v = incoming.get(k);
        if (v !== null) out.searchParams.set(k, v);
      }
      dest = out.toString();
    }

    // Report the click to the origin, off the visitor's critical path.
    ctx.waitUntil(reportClick(env, request, url, slug, record, dest));

    return Response.redirect(dest, 302);
  },
};

async function reportClick(env, request, url, slug, record, dest) {
  if (!env.EDGE_ANALYTICS_URL) return;
  const cf = request.cf || {};
  const body = JSON.stringify({
    slug,
    tid: record.tid || "",
    org: record.org || "",
    dest,
    ip: request.headers.get("CF-Connecting-IP") || "",
    ua: request.headers.get("User-Agent") || "",
    referrer: request.headers.get("Referer") || "",
    country: cf.country || "",
    // JA3/JA4 are only present with Cloudflare Bot Management; harmless if absent.
    ja3: (cf.botManagement && cf.botManagement.ja3Hash) || "",
    ja4: (cf.botManagement && cf.botManagement.ja4) || "",
  });
  try {
    await fetch(env.EDGE_ANALYTICS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Edge-Secret": env.EDGE_CLICK_SECRET || "",
      },
      body,
    });
  } catch (_) {
    // Analytics are best-effort; a lost report never affects the redirect.
  }
}

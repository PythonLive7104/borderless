/* TryNoBot service worker.
 *
 *  Deliberately conservative. A service worker is the one piece of a site that
 *  can keep serving yesterday's files to a returning visitor forever, so the
 *  rules here are chosen so the worst case is "no faster than before" rather
 *  than "stuck on an old build":
 *
 *    - navigations are network-first, so a deploy is live on the next load
 *    - only /assets/ is cached aggressively, and those filenames carry a
 *      content hash, so a cached one can never be the wrong version
 *    - the API, the tracker and anything cross-origin are never touched
 *
 *  Bump CACHE when the strategy changes; activate deletes every other cache.
 */
const CACHE = "tnb-v1";

// Paths this worker must never come between the browser and the network.
//
// /api and /v1 are live data and decisions — a cached verdict is a wrong
// verdict. /bl.js is the tracker other people's sites load; it is served from
// this origin and must always be the current build.
const NEVER = [/^\/api\//, /^\/v1\//, /^\/bl\.js$/, /^\/admin\//, /^\/static\//];

self.addEventListener("install", (e) => {
  // Take over promptly: a worker waiting for every tab to close is a worker
  // that ships a fix days late.
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/** An escape hatch. If a future worker ever misbehaves, the page can post
 *  {type: "UNREGISTER"} and this one stands down and clears its caches —
 *  without anyone needing to walk a customer through browser settings. */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "UNREGISTER") {
    e.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
    })());
  }
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;

  // Hashed build output: the name changes whenever the bytes do, so serving
  // from cache is always correct and always fastest.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
    return;
  }

  // Pages: network first, cache only as a fallback for being offline. This is
  // what stops an installed app from pinning itself to an old release.
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      } catch (err) {
        return (await caches.match(req))
            || (await caches.match("/dashboard"))
            || (await caches.match("/"))
            || new Response(
                 "<!doctype html><meta charset=utf-8>"
                 + "<meta name=viewport content='width=device-width,initial-scale=1'>"
                 + "<title>Offline</title>"
                 + "<body style='margin:0;min-height:100vh;display:grid;place-items:center;"
                 + "font-family:system-ui,sans-serif;background:#0a0f1d;color:#e5e7eb'>"
                 + "<div style='text-align:center;padding:1.5rem'>"
                 + "<h1 style='font-size:1.25rem;margin:0 0 .5rem'>You're offline</h1>"
                 + "<p style='color:#9ca3af;margin:0'>TryNoBot needs a connection to show live traffic.</p>"
                 + "</div></body>",
                 { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 });
      }
    })());
    return;
  }

  // Everything else (icons, fonts, the manifest): network first, fall back to
  // whatever we have. Never fails louder than the network already did.
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw err;
    }
  })());
});

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
const CACHE = "tnb-v2";

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

  // EVERYTHING ELSE IS LEFT ALONE. No interception, no fallback page.
  //
  // This used to take over page loads: network first, then cache, then an
  // "You're offline" page. It was wrong in a way that only showed up in front
  // of real users. A navigation fetch fails for reasons that have nothing to
  // do with the visitor's connection — nginx restarting for a few seconds
  // during a deploy, a transient blip, navigating away mid-request — and every
  // one of those put a full-screen "You're offline" in front of someone whose
  // connection was fine. For a new visitor that is not a glitch, it is the
  // product looking broken on first contact.
  //
  // Guarding it on navigator.onLine would have narrowed it. Not standing in
  // the way at all removes the failure mode completely, and costs nothing that
  // matters: the dashboard needs the network to show anything useful anyway.
  //
  // What stays below is the part that is purely a win — /assets/ filenames
  // carry a content hash, so a cached one can never be the wrong version.
  // Keeping a fetch handler is also what makes the app installable.
});

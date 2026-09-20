/* Borderless tracker (bl.js) — async, non-blocking, with JS fingerprinting. */
(function () {
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script'); return s[s.length - 1];
  })();
  if (!script) return;
  var siteId = script.getAttribute('data-site-id');
  if (!siteId) return;
  // data-strict="1" hides the page until the verdict arrives, so a blocked
  // visitor never sees the content. It ALWAYS reveals again on a timer, so a
  // slow or failed check can't white-screen real people.
  var strict = script.getAttribute('data-strict') === '1';
  var revealTimer = 0, revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    clearTimeout(revealTimer);
    var el = document.getElementById('bl-veil');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }
  if (strict) {
    try {
      var v = document.createElement('style');
      v.id = 'bl-veil';
      v.textContent = 'html{visibility:hidden!important}';
      (document.head || document.documentElement).appendChild(v);
    } catch (e) {}
    revealTimer = setTimeout(reveal, 1200);   // fail open, always
  }
  var endpoint;
  try { endpoint = new URL(script.src).origin + '/v1/collect'; } catch (e) { return; }

  function uid() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return 'xxxxxxxxxxxx'.replace(/x/g, function () { return (Math.random() * 16 | 0).toString(16); }) + Date.now().toString(16);
  }
  function g(store, k) { try { return store.getItem(k); } catch (e) { return null; } }
  function s(store, k, v) { try { store.setItem(k, v); } catch (e) {} }
  var vid = g(localStorage, 'bl_vid'); if (!vid) { vid = uid(); s(localStorage, 'bl_vid', vid); }
  var sid = g(sessionStorage, 'bl_sid'); if (!sid) { sid = uid(); s(sessionStorage, 'bl_sid', sid); }

  function utm(name) { try { return new URLSearchParams(location.search).get(name) || ''; } catch (e) { return ''; } }
  function hash32(str) { var h = 5381, i = str.length; while (i) h = (h * 33) ^ str.charCodeAt(--i); return (h >>> 0).toString(16); }

  function fingerprint() {
    var n = navigator, sc = screen, out = { flags: [] };
    try {
      out.platform = n.platform || '';
      out.langs = (n.languages || []).join(',');
      out.lang = n.language || '';
      out.hw = n.hardwareConcurrency || 0;
      out.mem = n.deviceMemory || 0;
      out.touch = n.maxTouchPoints || 0;
      out.plugins = (n.plugins && n.plugins.length) || 0;
      out.webdriver = !!n.webdriver;
      out.sw = sc.width; out.sh = sc.height; out.cd = sc.colorDepth;
      out.dpr = window.devicePixelRatio || 1;
      out.tz = (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })();
      // canvas
      var canvas = '';
      try {
        var c = document.createElement('canvas'); c.width = 200; c.height = 50;
        var ctx = c.getContext('2d');
        ctx.textBaseline = 'top'; ctx.font = "14px Arial";
        ctx.fillStyle = '#f60'; ctx.fillRect(2, 2, 120, 20);
        ctx.fillStyle = '#069'; ctx.fillText('Borderless,fp\u{1F3AF}', 4, 17);
        canvas = c.toDataURL();
      } catch (e) {}
      // webgl
      try {
        var gc = document.createElement('canvas');
        var gl = gc.getContext('webgl') || gc.getContext('experimental-webgl');
        if (gl) {
          var dbg = gl.getExtension('WEBGL_debug_renderer_info');
          out.glvendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : '';
          out.glrenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
        }
      } catch (e) {}

      // client-side bot flags
      var ua = n.userAgent || '';
      if (out.webdriver) out.flags.push('webdriver');
      if (!out.langs && !out.lang) out.flags.push('no_languages');
      if (out.plugins === 0 && /chrome/i.test(ua) && !/mobi|android|iphone|ipad/i.test(ua)) out.flags.push('no_plugins');
      if (/chrome/i.test(ua) && !window.chrome) out.flags.push('no_chrome_object');
      if (out.hw === 0) out.flags.push('no_hardware_concurrency');
      if (!canvas) out.flags.push('no_canvas');

      out.hash = hash32([out.platform, out.langs, out.hw, out.mem, out.sw, out.sh, out.cd, out.dpr, out.tz, out.plugins, canvas, out.glvendor || '', out.glrenderer || ''].join('|'));
    } catch (e) {}
    return out;
  }

  var FP = fingerprint();

  // Passive behaviour collector. A human moves the pointer along curved,
  // variable-speed paths, scrolls, and types; automation typically does none of
  // that, or fires events the browser marks isTrusted=false (script-dispatched).
  // We only OBSERVE here — the initial pageview carries no behaviour because
  // none has happened yet, so absence is never held against a first-time
  // visitor. The engine treats real interaction as exoneration and synthetic
  // events as a bot tell; see internal/risk.
  var BH = { mm: 0, md: 0, sc: 0, kd: 0, tp: '', ttfi: -1, syn: false };
  (function () {
    var lastX = null, lastY = null, lastDir = null, t0 = Date.now();
    function firstInteraction() { if (BH.ttfi < 0) BH.ttfi = Date.now() - t0; }
    function onMove(e) {
      if (e && e.isTrusted === false) { BH.syn = true; return; }
      BH.mm++;
      if (!BH.tp) BH.tp = (e && e.pointerType) || 'mouse';
      if (lastX !== null) {
        var dir = Math.atan2(e.clientY - lastY, e.clientX - lastX);
        // Count direction changes as a cheap movement-entropy proxy: a straight
        // programmatic line barely changes heading, a hand never stops wobbling.
        if (lastDir !== null && Math.abs(dir - lastDir) > 0.3) BH.md++;
        lastDir = dir;
      }
      lastX = e.clientX; lastY = e.clientY;
      firstInteraction();
    }
    function onScroll() {
      var h = document.documentElement;
      var max = (h.scrollHeight - h.clientHeight) || 1;
      var pct = Math.round((h.scrollTop || window.pageYOffset || 0) / max * 100);
      if (pct > BH.sc) BH.sc = Math.min(pct, 100);
      firstInteraction();
    }
    function onKey(e) {
      if (e && e.isTrusted === false) { BH.syn = true; return; }
      BH.kd++; firstInteraction();
    }
    function onDown(e) {
      if (e && e.isTrusted === false) { BH.syn = true; return; }
      if (!BH.tp) BH.tp = (e && e.pointerType) || 'mouse';
      firstInteraction();
    }
    try {
      var opt = { passive: true, capture: true };
      addEventListener('pointermove', onMove, opt);
      addEventListener('pointerdown', onDown, opt);
      addEventListener('scroll', onScroll, opt);
      addEventListener('keydown', onKey, opt);
    } catch (e) {}
  })();

  // Whether we have seen enough genuine interaction to vouch for a human. Kept
  // deliberately conservative: a couple of stray mouse samples is not a person.
  function humanSeen() {
    return (BH.mm >= 5 && BH.md >= 2) || BH.kd >= 2 || BH.sc >= 25;
  }
  function behaviour() {
    return { mm: BH.mm, md: BH.md, sc: BH.sc, kd: BH.kd, tp: BH.tp,
             ttfi: BH.ttfi, syn: BH.syn, human: humanSeen() };
  }

  function send(type, extra) {
    var p = {
      site_id: siteId, visitor_id: vid, session_id: sid, type: type,
      url: location.href, referrer: document.referrer || '',
      utm_source: utm('utm_source'), utm_medium: utm('utm_medium'), utm_campaign: utm('utm_campaign'),
      tz: FP.tz || '', lang: navigator.language || '',
      fp: FP
    };
    if (type !== 'pageview') p.bh = behaviour();
    if (extra) for (var k in extra) p[k] = extra[k];
    var body = JSON.stringify(p);
    // Prefer fetch so we can read the decision (e.g. a Redirect rule) and act
    // on it. sendBeacon is the fallback for browsers without fetch.
    if (window.fetch) {
      try {
        fetch(endpoint, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
          .then(function (r) { return r && r.status === 200 ? r.json() : null; })
          .then(function (d) { act(d); })
          .catch(function () { reveal(); });
        return;
      } catch (e) {}
    }
    try { if (navigator.sendBeacon) { navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' })); } } catch (e) {}
  }

  // Enforce the engine's verdict. This is best-effort by nature: it runs in the
  // visitor's browser, so anything ignoring JS ignores this too — that's what
  // the server-side Shield is for. It does stop the large slice of automation
  // that does run JS, which previously walked straight through because only
  // "redirect" was ever acted on.
  function act(d) {
    if (!d) { reveal(); return; }
    if (d.action === 'redirect' && d.redirect) { location.replace(d.redirect); return; }
    if (d.action === 'block') { deny(); return; }
    reveal();
  }

  function deny() {
    try {
      // Replace the document outright rather than overlaying it, so the real
      // content isn't left sitting in the DOM for a scraper to read.
      document.documentElement.innerHTML =
        '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Access denied</title></head><body style="margin:0;min-height:100vh;display:grid;' +
        'place-items:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
        'background:#0b1220;color:#e5e7eb"><div style="text-align:center;max-width:26rem;padding:1.5rem">' +
        '<h1 style="font-size:1.5rem;margin:0 0 .5rem">Access denied</h1>' +
        '<p style="color:#9ca3af;line-height:1.6;margin:0">Automated or suspicious traffic isn\'t allowed here. ' +
        'If you believe this is a mistake, try again from a standard web browser.</p></div></body>';
      window.stop && window.stop();
    } catch (e) {}
    reveal();
  }

  function bl(cmd, opts) {
    opts = opts || {};
    if (cmd === 'event') send('event', { event_name: opts.name || '' });
    else if (cmd === 'conversion') send('conversion', { event_name: opts.event || 'conversion', revenue: opts.revenue || 0, currency: opts.currency || 'USD' });
    else if (cmd === 'pageview') send('pageview', {});
  }
  var existing = window.bl;
  window.bl = bl;
  if (existing && existing.q) for (var i = 0; i < existing.q.length; i++) bl.apply(null, existing.q[i]);

  send('pageview', {});

  // A parting behaviour beacon: most sessions never fire a custom event, so
  // without this the only signal we would ever have is the behaviour-free
  // pageview. Fired once, best-effort, as the page goes away.
  var flushed = false;
  function flushBehaviour() {
    if (flushed) return; flushed = true;
    try {
      if (!navigator.sendBeacon) return;
      var p = { site_id: siteId, visitor_id: vid, session_id: sid, type: 'behaviour',
                url: location.href, tz: FP.tz || '', bh: behaviour(), fp: FP };
      navigator.sendBeacon(endpoint, new Blob([JSON.stringify(p)], { type: 'text/plain' }));
    } catch (e) {}
  }
  addEventListener('pagehide', flushBehaviour);
  addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushBehaviour();
  });
})();

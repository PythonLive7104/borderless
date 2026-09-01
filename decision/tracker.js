/* Borderless tracker (bl.js) — async, non-blocking, with JS fingerprinting. */
(function () {
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName('script'); return s[s.length - 1];
  })();
  if (!script) return;
  var siteId = script.getAttribute('data-site-id');
  if (!siteId) return;
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

  function send(type, extra) {
    var p = {
      site_id: siteId, visitor_id: vid, session_id: sid, type: type,
      url: location.href, referrer: document.referrer || '',
      utm_source: utm('utm_source'), utm_medium: utm('utm_medium'), utm_campaign: utm('utm_campaign'),
      tz: FP.tz || '', lang: navigator.language || '',
      fp: FP
    };
    if (extra) for (var k in extra) p[k] = extra[k];
    var body = JSON.stringify(p);
    // Prefer fetch so we can read the decision (e.g. a Redirect rule) and act
    // on it. sendBeacon is the fallback for browsers without fetch.
    if (window.fetch) {
      try {
        fetch(endpoint, { method: 'POST', body: body, keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } })
          .then(function (r) { return r && r.status === 200 ? r.json() : null; })
          .then(function (d) { if (d && d.action === 'redirect' && d.redirect) { location.replace(d.redirect); } })
          .catch(function () {});
        return;
      } catch (e) {}
    }
    try { if (navigator.sendBeacon) { navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' })); } } catch (e) {}
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
})();

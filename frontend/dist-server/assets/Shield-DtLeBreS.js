import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { P as PageNote } from "./PageNote-9zZCxTLa.js";
import { B as Button, D as ruleApi, c as useWorkspace, y as websiteApi } from "../entry-server.js";
import "react-dom/server";
import "react-router-dom/server.mjs";
function FolderGuard({ orgId, canManage }) {
  const [rules, setRules] = useState([]);
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function load() {
    const all = (await ruleApi.list(orgId)).results;
    setRules(all.filter((r) => r.conditions.length === 1 && r.conditions[0].field === "path"));
  }
  useEffect(() => {
    load();
  }, [orgId]);
  async function add(e) {
    var _a;
    e.preventDefault();
    let p = path.trim();
    if (!p) return;
    if (!p.startsWith("/")) p = "/" + p;
    setBusy(true);
    setErr("");
    try {
      await ruleApi.create({
        organization: orgId,
        name: `Guard ${p}`,
        priority: 5,
        action: "block",
        redirect_url: "",
        tag: "",
        conditions: [{ field: "path", operator: "contains", value: p }]
      });
      setPath("");
      load();
    } catch (e2) {
      setErr(((_a = e2.data) == null ? void 0 : _a.detail) || e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    if (!confirm("Stop guarding this path?")) return;
    await ruleApi.remove(id);
    load();
  }
  return /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-6 p-6", children: [
    /* @__PURE__ */ jsx("h2", { className: "text-lg font-bold", children: "Folder Guard" }),
    /* @__PURE__ */ jsxs("p", { className: "mt-1 max-w-2xl text-sm text-fg-muted", children: [
      "Lock down specific pages or folders — like ",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1", children: "/admin" }),
      ",",
      " ",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1", children: "/wp-login" }),
      " or ",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1", children: "/downloads" }),
      " — so bots and fraud can't reach them. Guarded paths are blocked by the Shield ",
      /* @__PURE__ */ jsx("b", { children: "before the page loads" }),
      ", so they need the Shield snippet installed (below)."
    ] }),
    canManage && /* @__PURE__ */ jsxs("form", { onSubmit: add, className: "mt-4 flex flex-wrap gap-2", children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          value: path,
          onChange: (e) => setPath(e.target.value),
          placeholder: "/admin",
          className: "w-56 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand"
        }
      ),
      /* @__PURE__ */ jsx(Button, { type: "submit", disabled: busy, children: busy ? "Adding…" : "Guard this path" })
    ] }),
    err && /* @__PURE__ */ jsx("div", { className: "mt-2 rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600", children: err }),
    /* @__PURE__ */ jsx("div", { className: "mt-4 space-y-2", children: rules.length === 0 ? /* @__PURE__ */ jsxs("p", { className: "text-sm text-fg-dim", children: [
      "No guarded paths yet. Add one above (e.g. ",
      /* @__PURE__ */ jsx("code", { className: "rounded bg-bg-mute px-1", children: "/admin" }),
      ")."
    ] }) : rules.map((r) => {
      var _a;
      return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between rounded-xl border border-line bg-bg-soft px-4 py-2.5", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 text-sm", children: [
          /* @__PURE__ */ jsx("span", { className: "rounded-md bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600", children: "Blocked" }),
          /* @__PURE__ */ jsx("code", { className: "font-mono", children: (_a = r.conditions[0]) == null ? void 0 : _a.value }),
          !r.active && /* @__PURE__ */ jsx("span", { className: "text-xs text-fg-dim", children: "(paused)" })
        ] }),
        canManage && /* @__PURE__ */ jsx("button", { onClick: () => remove(r.id), className: "text-sm text-red-500 hover:underline", children: "Remove" })
      ] }, r.id);
    }) })
  ] });
}
const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const HOST = typeof window !== "undefined" ? window.location.hostname : "trynobot.com";
const ENDPOINT = ORIGIN + "/v1/decide";
const GUARD = ORIGIN + "/v1/guard";
const TABS = [
  { id: "cpanel", label: "cPanel / Apache" },
  { id: "php", label: "PHP" },
  { id: "django", label: "Python / Django" },
  { id: "nginx", label: "nginx (VPS)" },
  { id: "cloudflare", label: "Cloudflare Worker" },
  { id: "node", label: "Node / Express" },
  { id: "curl", label: "Test (cURL)" }
];
const HINTS = {
  cpanel: {
    title: "Install on a cPanel / Apache site (most shared hosting)",
    steps: [
      "In cPanel, open File Manager and go into your site folder (usually public_html).",
      "Click “+ New File”, name it shield.php, then select it and click Edit.",
      "Paste the whole snippet above into it and Save. Your site ID is already filled in — there's nothing to edit.",
      "Back in File Manager, turn on “Show Hidden Files” (Settings, top-right), then Edit the .htaccess file (create it if it isn't there).",
      "Add these two lines at the top, using the full path shown at the top of File Manager for shield.php:",
      "    AddHandler application/x-httpd-php .html .htm",
      '    php_value auto_prepend_file "/home/YOUR_CPANEL_USER/public_html/shield.php"',
      "Save. Your whole site is now protected — every page runs the shield before it loads. No need to edit each page.",
      "If your host blocks that .htaccess line, open cPanel → “MultiPHP INI Editor”, pick your domain, and set auto_prepend_file to the same shield.php path there instead."
    ]
  },
  php: {
    title: "Install on a PHP site",
    steps: [
      "Open the PHP file for the page you want to protect (e.g. index.php).",
      "Paste the snippet at the VERY TOP, before any HTML or output (before <!DOCTYPE>).",
      "Save. Your site ID is already filled in — there's nothing to edit.",
      "Repeat for each page you want protected. To cover the whole site at once without editing every page, use the cPanel / Apache tab instead."
    ]
  },
  django: {
    dev: true,
    title: "Install on a Django site",
    steps: [
      "Save the snippet as trynobot_shield.py inside one of your Django apps (next to views.py). Your site ID is already in it.",
      'In settings.py, add "yourapp.trynobot_shield.TryNoBotShield" to the TOP of MIDDLEWARE.',
      "Restart your app (e.g. sudo systemctl restart gunicorn).",
      "Note: this only guards pages Django serves. If your pages are a static React build served by nginx, use the nginx or Cloudflare tab."
    ]
  },
  nginx: {
    dev: true,
    title: "Install on your own nginx server (VPS) — hard server-side blocking",
    steps: [
      "Find your site's nginx config — usually /etc/nginx/sites-available/YOURDOMAIN or /etc/nginx/conf.d/YOURDOMAIN.conf.",
      "Open it: sudo nano /etc/nginx/sites-available/YOURDOMAIN",
      "Inside you'll see 'server { ... }' and, within it, a 'location / { ... }' that serves your pages.",
      "PART 1 — inside that existing 'location / { }', add the first 4 lines from the snippet (the auth_request / auth_request_set / error_page lines). Keep your existing lines (like try_files).",
      "PART 2 — paste the whole 'location = /_ta_guard { }' block AND the 'location @ta_denied { }' block inside the same 'server { }', just after your 'location /'.",
      "Your site ID is already filled in — there's nothing to edit.",
      "Save (in nano: Ctrl+O, Enter, then Ctrl+X), then check for typos: sudo nginx -t",
      "If it says 'syntax is ok' and 'test is successful', reload: sudo systemctl reload nginx. Bots are now blocked BEFORE your pages load.",
      "Want blocked bots sent to a page (not a plain 'Access denied')? Don't touch nginx — just add a Redirect rule in Traffic Rules and pick a ready-made page. The shield sends them there automatically."
    ]
  },
  cloudflare: {
    title: "Install as a Cloudflare Worker (if your site is on Cloudflare)",
    steps: [
      "In the Cloudflare dashboard, go to Workers & Pages → Create → Worker.",
      "Replace the sample code with the snippet and Deploy — your site ID is already filled in.",
      "Go to your Worker → Settings → Triggers → Add a Route like example.com/* so it runs on your site."
    ]
  },
  node: {
    dev: true,
    title: "Install on a Node / Express site",
    steps: [
      "Add the snippet as middleware in your Express app (before your routes). Your site ID is already in it.",
      "Restart your app."
    ]
  },
  curl: {
    title: "This tab is only for testing — not for your website",
    steps: [
      "This is a command to run in a TERMINAL to check the shield answers. Do NOT put it on your site or in a file.",
      'Run it as-is (your site ID is already filled in) and you should get back a JSON reply with an "action".',
      "To actually protect your site, use one of the other tabs (cPanel, PHP, nginx, Cloudflare or Node)."
    ]
  }
};
function snippets(site) {
  const S = site || "YOUR_SITE_ID";
  return {
    php: `<?php
// TryNoBot server-side shield — paste at the VERY TOP of your page,
// before any HTML is sent. Turns bad visitors away before the page loads.
$ta_site = '${S}';   // your site ID — already filled in, nothing to change
// Behind Cloudflare/a proxy, use the real client IP header instead of REMOTE_ADDR:
$ta_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ch = curl_init('${ENDPOINT}');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 2,                     // fail open if we're slow
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode([
    'site_id' => $ta_site,
    'ip'      => $ta_ip,
    'ua'      => $_SERVER['HTTP_USER_AGENT'] ?? '',
  ]),
]);
$ta = json_decode(curl_exec($ch), true) ?: [];
curl_close($ch);
if (($ta['action'] ?? 'allow') === 'block') { http_response_code(403); exit('Access denied'); }
if (($ta['action'] ?? '') === 'redirect' && !empty($ta['redirect'])) { header('Location: '.$ta['redirect']); exit; }
// else: allow — carry on rendering your page
?>`,
    cpanel: `<?php
// shield.php — TryNoBot shield for cPanel / Apache sites.
// Save this WHOLE file as shield.php in your public_html, then load it site-wide
// from .htaccess (click "How do I install this?" below). No need to edit each page.
$ta_site = '${S}';   // your site ID — already filled in, nothing to change
$ta_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ch = curl_init('${ENDPOINT}');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 2,                     // fail open if we're slow
  CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode([
    'site_id' => $ta_site,
    'ip'      => $ta_ip,
    'ua'      => $_SERVER['HTTP_USER_AGENT'] ?? '',
    'path'    => $_SERVER['REQUEST_URI'] ?? '',
  ]),
]);
$ta = json_decode(curl_exec($ch), true) ?: [];
curl_close($ch);
if (($ta['action'] ?? 'allow') === 'block') { http_response_code(403); exit('Access denied'); }
if (($ta['action'] ?? '') === 'redirect' && !empty($ta['redirect'])) { header('Location: '.$ta['redirect']); exit; }
// else: allow — let the page load normally
?>`,
    django: `# trackaudit_shield.py — save in your Django app, then add it to
# settings.py MIDDLEWARE (near the top). Blocks bad visitors before your views run.
# NOTE: this guards pages Django itself serves. If nginx serves your React build
# directly, put the shield in Cloudflare/nginx instead (Django never sees those loads).
import json, urllib.request
from django.http import HttpResponseForbidden, HttpResponseRedirect

TA_ENDPOINT = "${ENDPOINT}"
TA_SITE = "${S}"   # your site ID — already filled in

def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", "")

class TryNoBotShield:
    SKIP = ("/static/", "/media/", "/api/", "/admin/")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only guard real page views — skip assets, API and admin for speed.
        if (request.method != "GET" or request.path.startswith(self.SKIP)
                or "text/html" not in request.META.get("HTTP_ACCEPT", "")):
            return self.get_response(request)
        try:
            data = json.dumps({
                "site_id": TA_SITE,
                "ip": _client_ip(request),
                "ua": request.META.get("HTTP_USER_AGENT", ""),
                "path": request.path,
            }).encode()
            req = urllib.request.Request(TA_ENDPOINT, data=data, headers={
                "Content-Type": "application/json",
            })
            with urllib.request.urlopen(req, timeout=2) as resp:   # fail open if slow
                d = json.loads(resp.read() or "{}")
            if d.get("action") == "block":
                return HttpResponseForbidden("Access denied")
            if d.get("action") == "redirect" and d.get("redirect"):
                return HttpResponseRedirect(d["redirect"])
        except Exception:
            pass  # never break your own site on our error
        return self.get_response(request)

# settings.py:
# MIDDLEWARE = ["yourapp.trackaudit_shield.TryNoBotShield", *MIDDLEWARE]`,
    nginx: `# This is a COMPLETE example server block. Compare it with your own config —
# you already have a "server { }" with a "location / { }". Just add the 3 parts
# marked with a star (★). Everything else below mirrors what you already have.

server {
    listen 443 ssl;
    server_name yourdomain.com;         # ← your domain (leave your real config)
    # ... your ssl_certificate / root / etc. stay exactly as they are ...

    location / {
        # ★ PART 1 — add these 4 lines at the TOP of your existing "location /"
        auth_request /_ta_guard;
        auth_request_set $ta_action   $upstream_http_x_ta_action;
        auth_request_set $ta_redirect $upstream_http_x_ta_redirect;
        error_page 403 = @ta_denied;

        try_files $uri $uri/ /index.html;   # ← your existing line — keep it
    }

    # ★ PART 2 — add this whole block (it asks TryNoBot about each visitor)
    location = /_ta_guard {
        internal;
        resolver 1.1.1.1 ipv6=off;
        proxy_pass ${GUARD};
        proxy_ssl_server_name on;
        proxy_set_header Host ${HOST};
        proxy_pass_request_body off;
        proxy_set_header Content-Length "";
        proxy_set_header X-TA-Site "${S}";       # your site ID (already filled in)
        proxy_set_header X-TA-IP   $remote_addr; # (behind Cloudflare? use $http_cf_connecting_ip)
        proxy_set_header X-TA-UA   $http_user_agent;
    }

    # ★ PART 3 — add this whole block (what a blocked visitor gets)
    location @ta_denied {
        if ($ta_action = "redirect") { return 302 $ta_redirect; }
        return 403 "Access denied";
    }
}
# Save, then:  sudo nginx -t  &&  sudo systemctl reload nginx`,
    cloudflare: `// TryNoBot shield as a Cloudflare Worker — runs at the edge, before your origin.
export default {
  async fetch(request, env, ctx) {
    const d = await fetch("${ENDPOINT}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: "${S}",
        ip: request.headers.get("CF-Connecting-IP") || "",
        ua: request.headers.get("User-Agent") || "",
      }),
    }).then(r => r.json()).catch(() => ({ action: "allow" })); // fail open
    if (d.action === "block") return new Response("Access denied", { status: 403 });
    if (d.action === "redirect" && d.redirect) return Response.redirect(d.redirect, 302);
    return fetch(request); // allow -> pass through to your site
  },
};`,
    node: `// TryNoBot shield as Express middleware. Node 18+ has global fetch.
async function trackauditShield(req, res, next) {
  try {
    const r = await fetch("${ENDPOINT}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        site_id: "${S}",
        ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress,
        ua: req.headers["user-agent"] || "",
      }),
      signal: AbortSignal.timeout(2000),
    });
    const d = await r.json();
    if (d.action === "block") return res.status(403).send("Access denied");
    if (d.action === "redirect" && d.redirect) return res.redirect(d.redirect);
  } catch (e) { /* fail open — never block your own site on our error */ }
  next();
}
app.use(trackauditShield);`,
    curl: `# Test the shield from your terminal (your site ID is already filled in).
# Try a bot user-agent to see how it scores.
curl -s -X POST ${ENDPOINT} \\
  -H "Content-Type: application/json" \\
  -d '{"site_id":"${S}","ip":"1.2.3.4","ua":"python-requests/2.31"}'
# -> {"action":"allow|block|redirect","classification":"...","risk_score":..,"redirect":"..."}`
  };
}
function Shield() {
  const { current } = useWorkspace();
  const [sites, setSites] = useState([]);
  const [siteId, setSiteId] = useState("");
  const [tab, setTab] = useState("cpanel");
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);
  useEffect(() => {
    if (!current) return;
    websiteApi.list(current.id).then((r) => {
      setSites(r.results);
      setSiteId((prev) => {
        var _a;
        return prev || ((_a = r.results[0]) == null ? void 0 : _a.tracking_id) || "";
      });
    });
  }, [current == null ? void 0 : current.id]);
  const code = useMemo(() => snippets(siteId)[tab], [siteId, tab]);
  function copy() {
    var _a;
    (_a = navigator.clipboard) == null ? void 0 : _a.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  async function verifyShield() {
    const site = sites.find((s) => s.tracking_id === siteId);
    if (!site) return;
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const r = await websiteApi.verifyShield(site.id);
      setVerifyMsg({ ok: r.active, text: r.message });
    } catch {
      setVerifyMsg({ ok: false, text: "Couldn't check right now — please try again." });
    } finally {
      setVerifying(false);
    }
  }
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs(PageNote, { id: "shield", children: [
      "Think of your tracking snippet as a ",
      /* @__PURE__ */ jsx("b", { children: "security camera" }),
      " — it watches visitors and can send bots away after the page opens. The Shield is a ",
      /* @__PURE__ */ jsx("b", { children: "bouncer at the door" }),
      ": it checks each visitor ",
      /* @__PURE__ */ jsx("b", { children: "before" }),
      " your page loads and can fully block bad ones. It's stronger, but it needs a one-time bit of code added to your website — so it's usually a job for whoever builds or manages your site. Good news: the snippet is",
      /* @__PURE__ */ jsx("b", { children: "ready to paste" }),
      " — your site ID is already in it, so there's ",
      /* @__PURE__ */ jsx("b", { children: "no key and nothing to edit" }),
      "."
    ] }),
    /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-end justify-between gap-3", children: /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-extrabold tracking-tight", children: "Server-side shield" }),
        /* @__PURE__ */ jsx("span", { className: "rounded-full bg-bg-mute px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-fg-dim", children: "Advanced" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "The strongest way to block bots & fraud — before your page is shown." })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-5 flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/5 p-5", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "font-bold", children: "Not technical? You probably don't need this page." }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 max-w-2xl text-sm text-fg-muted", children: [
          "For most sites, the ",
          /* @__PURE__ */ jsx("b", { children: "one-click protection in Traffic Rules" }),
          " already turns bad visitors away using the snippet you installed — ",
          /* @__PURE__ */ jsx("b", { children: "no code, no developer" }),
          ". Use the Shield only if you want the strongest possible blocking and can add a small snippet to your server."
        ] })
      ] }),
      /* @__PURE__ */ jsx(Link, { to: "/dashboard/traffic-rules", className: "whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700", children: "Use the easy option →" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-3", children: [
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-4", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "Step 1 · You" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-semibold", children: 'Decide what "bad" means' }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          "In ",
          /* @__PURE__ */ jsx(Link, { to: "/dashboard/traffic-rules", className: "font-semibold text-brand hover:underline", children: "Traffic Rules" }),
          ', set a rule like "block fraud & bots". The Shield uses these same rules — nothing new to learn here.'
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-4", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "Step 2 · You" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-semibold", children: "Copy the snippet" }),
        /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
          "Pick your site below and copy the snippet. Your site ID is already filled in — ",
          /* @__PURE__ */ jsx("b", { children: "no key, no setup, nothing to edit." })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "card shadow-soft p-4", children: [
        /* @__PURE__ */ jsx("div", { className: "text-xs font-bold uppercase tracking-wide text-fg-dim", children: "Step 3 · Your web person" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm font-semibold", children: "Add the snippet to your site" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-fg-muted", children: "Copy one snippet below and add it to your website's server (or Cloudflare). Not sure how? Send this page and your key to whoever manages your site." })
      ] })
    ] }),
    current && /* @__PURE__ */ jsx(FolderGuard, { orgId: current.id, canManage: current.role === "owner" || current.role === "admin" }),
    /* @__PURE__ */ jsxs("div", { className: "mt-8 border-t border-line pt-6", children: [
      /* @__PURE__ */ jsxs("h2", { className: "text-lg font-bold", children: [
        "The snippet ",
        /* @__PURE__ */ jsx("span", { className: "text-sm font-normal text-fg-dim", children: "— for whoever manages your website" })
      ] }),
      /* @__PURE__ */ jsxs("p", { className: "mt-1 text-sm text-fg-muted", children: [
        "Pick your site and platform, then copy. It's ready to paste — your site ID is already filled in, ",
        /* @__PURE__ */ jsx("b", { children: "nothing to edit" }),
        "."
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [
      /* @__PURE__ */ jsx("label", { className: "text-sm font-semibold", children: "Protecting site:" }),
      /* @__PURE__ */ jsxs(
        "select",
        {
          value: siteId,
          onChange: (e) => setSiteId(e.target.value),
          className: "rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand",
          children: [
            sites.length === 0 && /* @__PURE__ */ jsx("option", { value: "", children: "Add a website first" }),
            sites.map((s) => /* @__PURE__ */ jsxs("option", { value: s.tracking_id, children: [
              s.name,
              " (",
              s.tracking_id,
              ")"
            ] }, s.id))
          ]
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-4 overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2", children: [
        /* @__PURE__ */ jsx("div", { className: "flex flex-wrap gap-1", children: TABS.map((t) => /* @__PURE__ */ jsx(
          "button",
          {
            onClick: () => setTab(t.id),
            className: `rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.id ? "bg-brand text-white" : "text-fg-muted hover:bg-bg-mute"}`,
            children: t.label
          },
          t.id
        )) }),
        /* @__PURE__ */ jsx("button", { onClick: copy, className: "rounded-md bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90", children: copied ? "Copied ✓" : "Copy" })
      ] }),
      /* @__PURE__ */ jsx("pre", { className: "overflow-x-auto bg-navy-900 p-4 text-[12.5px] leading-relaxed text-slate-200", children: /* @__PURE__ */ jsx("code", { children: code }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-4 overflow-hidden border-brand/30", children: [
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          onClick: () => setShowHint((v) => !v),
          className: "flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-soft",
          children: [
            /* @__PURE__ */ jsxs("span", { className: "text-sm font-bold text-brand", children: [
              "💡 How do I install this? — ",
              HINTS[tab].title
            ] }),
            /* @__PURE__ */ jsx("span", { className: "text-fg-dim", children: showHint ? "▲" : "▼" })
          ]
        }
      ),
      showHint && HINTS[tab].dev && /* @__PURE__ */ jsxs("div", { className: "border-t border-line bg-warning/10 px-5 py-3 text-xs text-amber-800", children: [
        "⚙️ ",
        /* @__PURE__ */ jsx("b", { children: "This option is for a developer or server admin" }),
        " — it means editing server config, which can't be made click-simple. Not technical? You don't need it. Most sites just add the ",
        /* @__PURE__ */ jsx("b", { children: "cPanel / PHP" }),
        ` script (that's the "drop-in script" model), and the no-code `,
        /* @__PURE__ */ jsx(Link, { to: "/dashboard/traffic-rules", className: "font-semibold underline", children: "Redirect rule" }),
        " works everywhere with zero setup."
      ] }),
      showHint && /* @__PURE__ */ jsx("ol", { className: "space-y-1.5 border-t border-line px-5 py-4 text-sm text-fg-muted", children: HINTS[tab].steps.map((s, i) => s.startsWith("    ") ? /* @__PURE__ */ jsx("li", { className: "ml-4 list-none rounded bg-bg-mute px-2 py-1 font-mono text-xs text-fg", children: s.trim() }, i) : /* @__PURE__ */ jsx("li", { className: "ml-4 list-decimal", children: s }, i)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "card shadow-soft mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 p-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "min-w-0 flex-1", children: [
        /* @__PURE__ */ jsx("div", { className: "text-sm font-bold", children: "Check the Shield is working" }),
        /* @__PURE__ */ jsx("div", { className: "text-xs text-fg-muted", children: "Once installed, open any page on your site in a browser, then click Verify — we'll confirm your server is calling the Shield." })
      ] }),
      /* @__PURE__ */ jsx(Button, { onClick: verifyShield, disabled: verifying || !siteId, children: verifying ? "Checking…" : "Verify Shield" }),
      verifyMsg && /* @__PURE__ */ jsxs("div", { className: `w-full rounded-lg px-3 py-2 text-sm ${verifyMsg.ok ? "bg-success/10 text-emerald-700" : "bg-warning/10 text-amber-700"}`, children: [
        verifyMsg.ok ? "✅ " : "⏳ ",
        verifyMsg.text
      ] })
    ] }),
    /* @__PURE__ */ jsxs("p", { className: "mt-3 text-xs text-fg-dim", children: [
      "The shield ",
      /* @__PURE__ */ jsx("b", { children: "fails open" }),
      ": if we're ever unreachable, your site keeps serving normally — a visitor is only turned away on an explicit ",
      /* @__PURE__ */ jsx("b", { children: "block" }),
      "/",
      /* @__PURE__ */ jsx("b", { children: "redirect" }),
      " verdict. Every check also appears in your Click Log."
    ] })
  ] });
}
export {
  Shield as default
};

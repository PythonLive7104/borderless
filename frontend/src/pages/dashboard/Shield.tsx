import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { websiteApi, type Website } from "../../lib/api";
import FolderGuard from "../../components/dashboard/FolderGuard";
import Button from "../../components/ui/Button";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
const HOST = typeof window !== "undefined" ? window.location.hostname : "trynobot.com";
const ENDPOINT = ORIGIN + "/v1/decide";
const GUARD = ORIGIN + "/v1/guard";

type Lang = "php" | "cpanel" | "django" | "nginx" | "cloudflare" | "node" | "curl";
const TABS: { id: Lang; label: string }[] = [
  { id: "cpanel", label: "cPanel / Apache" },
  { id: "php", label: "PHP" },
  { id: "django", label: "Python / Django" },
  { id: "nginx", label: "nginx (VPS)" },
  { id: "cloudflare", label: "Cloudflare Worker" },
  { id: "node", label: "Node / Express" },
  { id: "curl", label: "Test (cURL)" },
];

// Plain-English, step-by-step install help for non-technical users — shown when
// they click "How do I install this?" under the snippet.
const HINTS: Record<Lang, { title: string; steps: string[]; dev?: boolean }> = {
  cpanel: {
    title: "Install on a cPanel / Apache site (most shared hosting)",
    steps: [
      "In cPanel, open File Manager and go into your site folder (usually public_html).",
      "Click “+ New File”, name it shield.php, then select it and click Edit.",
      "Paste the whole snippet above into it and Save. Your site ID is already filled in — there's nothing to edit.",
      "Back in File Manager, turn on “Show Hidden Files” (Settings, top-right), then Edit the .htaccess file (create it if it isn't there).",
      "Add these two lines at the top, using the full path shown at the top of File Manager for shield.php:",
      "    AddHandler application/x-httpd-php .html .htm",
      "    php_value auto_prepend_file \"/home/YOUR_CPANEL_USER/public_html/shield.php\"",
      "Save. Your whole site is now protected — every page runs the shield before it loads. No need to edit each page.",
      "If your host blocks that .htaccess line, open cPanel → “MultiPHP INI Editor”, pick your domain, and set auto_prepend_file to the same shield.php path there instead.",
    ],
  },
  php: {
    title: "Install on a PHP site",
    steps: [
      "Open the PHP file for the page you want to protect (e.g. index.php).",
      "Paste the snippet at the VERY TOP, before any HTML or output (before <!DOCTYPE>).",
      "Save. Your site ID is already filled in — there's nothing to edit.",
      "Repeat for each page you want protected. To cover the whole site at once without editing every page, use the cPanel / Apache tab instead.",
    ],
  },
  django: {
    dev: true,
    title: "Install on a Django site",
    steps: [
      "Save the snippet as trynobot_shield.py inside one of your Django apps (next to views.py). Your site ID is already in it.",
      "In settings.py, add \"yourapp.trynobot_shield.TryNoBotShield\" to the TOP of MIDDLEWARE.",
      "Restart your app (e.g. sudo systemctl restart gunicorn).",
      "Note: this only guards pages Django serves. If your pages are a static React build served by nginx, use the nginx or Cloudflare tab.",
    ],
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
      "Want blocked bots sent to a page (not a plain 'Access denied')? Don't touch nginx — just add a Redirect rule in Traffic Rules and pick a ready-made page. The shield sends them there automatically.",
    ],
  },
  cloudflare: {
    title: "Install as a Cloudflare Worker (if your site is on Cloudflare)",
    steps: [
      "In the Cloudflare dashboard, go to Workers & Pages → Create → Worker.",
      "Replace the sample code with the snippet and Deploy — your site ID is already filled in.",
      "Go to your Worker → Settings → Triggers → Add a Route like example.com/* so it runs on your site.",
    ],
  },
  node: {
    dev: true,
    title: "Install on a Node / Express site",
    steps: [
      "Add the snippet as middleware in your Express app (before your routes). Your site ID is already in it.",
      "Restart your app.",
    ],
  },
  curl: {
    title: "This tab is only for testing — not for your website",
    steps: [
      "This is a command to run in a TERMINAL to check the shield answers. Do NOT put it on your site or in a file.",
      "Run it as-is (your site ID is already filled in) and you should get back a JSON reply with an \"action\".",
      "To actually protect your site, use one of the other tabs (cPanel, PHP, nginx, Cloudflare or Node).",
    ],
  },
};

function snippets(site: string): Record<Lang, string> {
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
# -> {"action":"allow|block|redirect","classification":"...","risk_score":..,"redirect":"..."}`,
  };
}

export default function Shield() {
  const { current } = useWorkspace();
  const [sites, setSites] = useState<Website[]>([]);
  const [siteId, setSiteId] = useState("");
  const [tab, setTab] = useState<Lang>("cpanel");
  const [copied, setCopied] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!current) return;
    websiteApi.list(current.id).then((r) => {
      setSites(r.results);
      setSiteId((prev) => prev || r.results[0]?.tracking_id || "");
    });
  }, [current?.id]);

  const code = useMemo(() => snippets(siteId)[tab], [siteId, tab]);
  function copy() {
    navigator.clipboard?.writeText(code);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  async function verifyShield() {
    const site = sites.find((s) => s.tracking_id === siteId);
    if (!site) return;
    setVerifying(true); setVerifyMsg(null);
    try {
      const r = await websiteApi.verifyShield(site.id);
      setVerifyMsg({ ok: r.active, text: r.message });
    } catch { setVerifyMsg({ ok: false, text: "Couldn't check right now — please try again." }); }
    finally { setVerifying(false); }
  }

  return (
    <div>
      <PageNote id="shield">
        Think of your tracking snippet as a <b>security camera</b> — it watches visitors and can send bots away
        after the page opens. The Shield is a <b>bouncer at the door</b>: it checks each visitor <b>before</b> your
        page loads and can fully block bad ones. It's stronger, but it needs a one-time bit of code added to your
        website — so it's usually a job for whoever builds or manages your site. Good news: the snippet is
        <b>ready to paste</b> — your site ID is already in it, so there's <b>no key and nothing to edit</b>.
      </PageNote>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight">Server-side shield</h1>
            <span className="rounded-full bg-bg-mute px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-fg-dim">Advanced</span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">The strongest way to block bots &amp; fraud — before your page is shown.</p>
        </div>
      </div>

      {/* Non-technical off-ramp: most people should use the no-code option instead. */}
      <div className="card shadow-soft mt-5 flex flex-wrap items-center justify-between gap-3 border-emerald-500/30 bg-emerald-500/5 p-5">
        <div>
          <h2 className="font-bold">Not technical? You probably don't need this page.</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            For most sites, the <b>one-click protection in Traffic Rules</b> already turns bad visitors away using
            the snippet you installed — <b>no code, no developer</b>. Use the Shield only if you want the strongest
            possible blocking and can add a small snippet to your server.
          </p>
        </div>
        <Link to="/dashboard/traffic-rules" className="whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Use the easy option →</Link>
      </div>

      {/* setup checklist — plain language */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 1 · You</div>
          <p className="mt-1 text-sm font-semibold">Decide what "bad" means</p>
          <p className="mt-1 text-sm text-fg-muted">In <Link to="/dashboard/traffic-rules" className="font-semibold text-brand hover:underline">Traffic Rules</Link>, set a rule like "block fraud &amp; bots". The Shield uses these same rules — nothing new to learn here.</p>
        </div>
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 2 · You</div>
          <p className="mt-1 text-sm font-semibold">Copy the snippet</p>
          <p className="mt-1 text-sm text-fg-muted">Pick your site below and copy the snippet. Your site ID is already filled in — <b>no key, no setup, nothing to edit.</b></p>
        </div>
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 3 · Your web person</div>
          <p className="mt-1 text-sm font-semibold">Add the snippet to your site</p>
          <p className="mt-1 text-sm text-fg-muted">Copy one snippet below and add it to your website's server (or Cloudflare). Not sure how? Send this page and your key to whoever manages your site.</p>
        </div>
      </div>

      {/* Folder Guard — protect specific paths (enforced by the shield). */}
      {current && <FolderGuard orgId={current.id} canManage={current.role === "owner" || current.role === "admin"} />}

      {/* code section — clearly framed as the developer's part */}
      <div className="mt-8 border-t border-line pt-6">
        <h2 className="text-lg font-bold">The snippet <span className="text-sm font-normal text-fg-dim">— for whoever manages your website</span></h2>
        <p className="mt-1 text-sm text-fg-muted">Pick your site and platform, then copy. It's ready to paste — your site ID is already filled in, <b>nothing to edit</b>.</p>
      </div>

      {/* site picker */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">Protecting site:</label>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-brand">
          {sites.length === 0 && <option value="">Add a website first</option>}
          {sites.map((s) => <option key={s.id} value={s.tracking_id}>{s.name} ({s.tracking_id})</option>)}
        </select>
      </div>

      {/* snippet card */}
      <div className="card shadow-soft mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tab === t.id ? "bg-brand text-white" : "text-fg-muted hover:bg-bg-mute"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={copy} className="rounded-md bg-navy-900 px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto bg-navy-900 p-4 text-[12.5px] leading-relaxed text-slate-200"><code>{code}</code></pre>
      </div>

      {/* Per-platform step-by-step help (Hint) */}
      <div className="card shadow-soft mt-4 overflow-hidden border-brand/30">
        <button type="button" onClick={() => setShowHint((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg-soft">
          <span className="text-sm font-bold text-brand">💡 How do I install this? — {HINTS[tab].title}</span>
          <span className="text-fg-dim">{showHint ? "▲" : "▼"}</span>
        </button>
        {showHint && HINTS[tab].dev && (
          <div className="border-t border-line bg-warning/10 px-5 py-3 text-xs text-amber-800">
            ⚙️ <b>This option is for a developer or server admin</b> — it means editing server config, which can't be made click-simple.
            Not technical? You don't need it. Most sites just add the <b>cPanel / PHP</b> script (that's the "drop-in script" model), and the
            no-code <Link to="/dashboard/traffic-rules" className="font-semibold underline">Redirect rule</Link> works everywhere with zero setup.
          </div>
        )}
        {showHint && (
          <ol className="space-y-1.5 border-t border-line px-5 py-4 text-sm text-fg-muted">
            {HINTS[tab].steps.map((s, i) => (
              s.startsWith("    ")
                ? <li key={i} className="ml-4 list-none rounded bg-bg-mute px-2 py-1 font-mono text-xs text-fg">{s.trim()}</li>
                : <li key={i} className="ml-4 list-decimal">{s}</li>
            ))}
          </ol>
        )}
      </div>

      {/* Verify the shield is actually running — same idea as snippet verification */}
      <div className="card shadow-soft mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Check the Shield is working</div>
          <div className="text-xs text-fg-muted">Once installed, open any page on your site in a browser, then click Verify — we'll confirm your server is calling the Shield.</div>
        </div>
        <Button onClick={verifyShield} disabled={verifying || !siteId}>{verifying ? "Checking…" : "Verify Shield"}</Button>
        {verifyMsg && (
          <div className={`w-full rounded-lg px-3 py-2 text-sm ${verifyMsg.ok ? "bg-success/10 text-emerald-700" : "bg-warning/10 text-amber-700"}`}>
            {verifyMsg.ok ? "✅ " : "⏳ "}{verifyMsg.text}
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-fg-dim">
        The shield <b>fails open</b>: if we're ever unreachable, your site keeps serving normally — a visitor is only
        turned away on an explicit <b>block</b>/<b>redirect</b> verdict. Every check also appears in your Click Log.
      </p>
    </div>
  );
}

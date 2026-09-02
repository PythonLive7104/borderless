import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { websiteApi, type Website } from "../../lib/api";

const ENDPOINT = (typeof window !== "undefined" ? window.location.origin : "https://trackaudit.info") + "/v1/decide";

type Lang = "php" | "django" | "cloudflare" | "node" | "curl";
const TABS: { id: Lang; label: string }[] = [
  { id: "php", label: "PHP" },
  { id: "django", label: "Python / Django" },
  { id: "cloudflare", label: "Cloudflare Worker" },
  { id: "node", label: "Node / Express" },
  { id: "curl", label: "Test (cURL)" },
];

function snippets(site: string): Record<Lang, string> {
  const S = site || "YOUR_SITE_ID";
  return {
    php: `<?php
// TrackAudit server-side shield — paste at the VERY TOP of your page,
// before any HTML is sent. Turns bad visitors away before the page loads.
$ta_key  = 'YOUR_API_KEY';   // Dashboard → API Keys (create one, paste it here)
$ta_site = '${S}';
// Behind Cloudflare/a proxy, use the real client IP header instead of REMOTE_ADDR:
$ta_ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
$ch = curl_init('${ENDPOINT}');
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_TIMEOUT => 2,                     // fail open if we're slow
  CURLOPT_HTTPHEADER => ['Content-Type: application/json', "Authorization: Bearer $ta_key"],
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
    django: `# trackaudit_shield.py — save in your Django app, then add it to
# settings.py MIDDLEWARE (near the top). Blocks bad visitors before your views run.
# NOTE: this guards pages Django itself serves. If nginx serves your React build
# directly, put the shield in Cloudflare/nginx instead (Django never sees those loads).
import json, urllib.request
from django.http import HttpResponseForbidden, HttpResponseRedirect

TA_ENDPOINT = "${ENDPOINT}"
TA_KEY  = "YOUR_API_KEY"        # Dashboard -> API Keys (create one, paste it here)
TA_SITE = "${S}"

def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR", "")

class TrackAuditShield:
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
                "Authorization": "Bearer " + TA_KEY,
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
# MIDDLEWARE = ["yourapp.trackaudit_shield.TrackAuditShield", *MIDDLEWARE]`,
    cloudflare: `// TrackAudit shield as a Cloudflare Worker — runs at the edge, before your origin.
export default {
  async fetch(request, env, ctx) {
    const d = await fetch("${ENDPOINT}", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer YOUR_API_KEY" },
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
    node: `// TrackAudit shield as Express middleware. Node 18+ has global fetch.
async function trackauditShield(req, res, next) {
  try {
    const r = await fetch("${ENDPOINT}", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + process.env.TA_KEY },
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
    curl: `# Test the shield from your terminal. Swap in your API key and try a
# datacenter IP or a bot user-agent to see it flip to "block".
curl -s -X POST ${ENDPOINT} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"site_id":"${S}","ip":"1.2.3.4","ua":"python-requests/2.31"}'
# -> {"action":"allow|block|redirect","classification":"...","risk_score":..,"redirect":"..."}`,
  };
}

export default function Shield() {
  const { current } = useWorkspace();
  const [sites, setSites] = useState<Website[]>([]);
  const [siteId, setSiteId] = useState("");
  const [tab, setTab] = useState<Lang>("php");
  const [copied, setCopied] = useState(false);

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

  return (
    <div>
      <PageNote id="shield">
        Think of your tracking snippet as a <b>security camera</b> — it watches visitors and can send bots away
        after the page opens. The Shield is a <b>bouncer at the door</b>: it checks each visitor <b>before</b> your
        page loads and can fully block bad ones. It's stronger, but it needs a one-time bit of code added to your
        website — so it's usually a job for whoever builds or manages your site.
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
          <p className="mt-1 text-sm font-semibold">Get your secure key</p>
          <p className="mt-1 text-sm text-fg-muted">Go to <Link to="/dashboard/api" className="font-semibold text-brand hover:underline">API Keys</Link> and create one. It's a private password that lets your website talk to us. Copy it — it's shown only once.</p>
        </div>
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 3 · Your web person</div>
          <p className="mt-1 text-sm font-semibold">Add the snippet to your site</p>
          <p className="mt-1 text-sm text-fg-muted">Copy one snippet below and add it to your website's server (or Cloudflare). Not sure how? Send this page and your key to whoever manages your site.</p>
        </div>
      </div>

      {/* code section — clearly framed as the developer's part */}
      <div className="mt-8 border-t border-line pt-6">
        <h2 className="text-lg font-bold">The snippet <span className="text-sm font-normal text-fg-dim">— for whoever manages your website</span></h2>
        <p className="mt-1 text-sm text-fg-muted">Pick your site and platform, then copy. Replace <code className="rounded bg-bg-mute px-1">YOUR_API_KEY</code> with the key from Step 2.</p>
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

      <p className="mt-3 text-xs text-fg-dim">
        The shield <b>fails open</b>: if we're ever unreachable, your site keeps serving normally — a visitor is only
        turned away on an explicit <b>block</b>/<b>redirect</b> verdict. Every check also appears in your Click Log.
      </p>
    </div>
  );
}

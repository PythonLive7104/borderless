import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";
import { useWorkspace } from "../../context/WorkspaceContext";
import { websiteApi, type Website } from "../../lib/api";

const ENDPOINT = (typeof window !== "undefined" ? window.location.origin : "https://trackaudit.info") + "/v1/decide";

type Lang = "php" | "cloudflare" | "node" | "curl";
const TABS: { id: Lang; label: string }[] = [
  { id: "php", label: "PHP" },
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
        The <b>server-side shield</b> turns bad visitors away <b>before your page loads</b> — real protection,
        not just labels. Your server asks us for a verdict and we answer using the same <b>Traffic Rules</b> you
        already set. Add a rule (e.g. block fraud &amp; bots), create an <b>API key</b>, then paste one snippet below.
      </PageNote>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Server-side shield</h1>
          <p className="mt-1 text-sm text-fg-muted">Block bots &amp; fraud at your server or edge, before rendering.</p>
        </div>
      </div>

      {/* setup checklist */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 1</div>
          <p className="mt-1 text-sm">Set your <Link to="/dashboard/traffic-rules" className="font-semibold text-brand hover:underline">Traffic Rules</Link> — the shield enforces block/redirect rules.</p>
        </div>
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 2</div>
          <p className="mt-1 text-sm">Create an <Link to="/dashboard/api" className="font-semibold text-brand hover:underline">API key</Link> and paste it into the snippet.</p>
        </div>
        <div className="card shadow-soft p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-fg-dim">Step 3</div>
          <p className="mt-1 text-sm">Install the snippet on your server or Cloudflare. Done.</p>
        </div>
      </div>

      {/* site picker */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
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

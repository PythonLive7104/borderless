import { useMemo, useState } from "react";

/** How to actually use an API key.
 *
 *  The keys page used to create a key, warn you to keep it secret, and stop —
 *  so the one question anyone has after making one ("what do I send, and
 *  where?") had no answer anywhere in the product. Everything below is the
 *  real contract of POST /api/v1/conversions/, the single endpoint the key
 *  authenticates; if that view changes, these samples have to change with it.
 */
type Lang = "curl" | "python" | "php" | "node" | "go";

const TABS: { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "python", label: "Python" },
  { id: "php", label: "PHP" },
  { id: "node", label: "Node.js" },
  { id: "go", label: "Go" },
];

const FIELDS: [string, string, string][] = [
  ["site_id", "required", "The tracking ID of the website this sale belongs to. Find it on the Websites page — it looks like st_a1b2c3d4."],
  ["event", "optional", "What happened: \"signup\", \"purchase\", \"lead\". Defaults to \"conversion\"."],
  ["revenue", "optional", "Amount as a number, e.g. 49.00. Defaults to 0."],
  ["currency", "optional", "Three-letter code. Defaults to USD."],
  ["visitor_id", "optional", "The visitor this sale belongs to, so it can be tied back to the click that produced it. Defaults to \"server\"."],
  ["utm_source", "optional", "Pass through if you track the source yourself."],
  ["utm_campaign", "optional", "Pass through if you track the campaign yourself."],
];

function samples(origin: string, site: string) {
  const url = `${origin}/api/v1/conversions/`;
  return {
    curl: `curl -X POST ${url} \\
  -H "Authorization: Bearer $TRYNOBOT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "site_id": "${site}",
    "event": "purchase",
    "revenue": 49.00,
    "currency": "USD",
    "visitor_id": "the-visitor-id-you-stored"
  }'`,

    python: `import os, requests

# Never hard-code the key. Read it from the environment.
resp = requests.post(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['TRYNOBOT_API_KEY']}"},
    json={
        "site_id": "${site}",
        "event": "purchase",
        "revenue": 49.00,
        "currency": "USD",
        "visitor_id": "the-visitor-id-you-stored",
    },
    timeout=5,          # never let analytics hold up a checkout
)
resp.raise_for_status()
print(resp.json())      # {'id': 123, 'status': 'recorded'}`,

    php: `<?php
// Fire this AFTER you have taken the money, not before.
$ch = curl_init('${url}');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . getenv('TRYNOBOT_API_KEY'),
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'site_id'    => '${site}',
        'event'      => 'purchase',
        'revenue'    => 49.00,
        'currency'   => 'USD',
        'visitor_id' => 'the-visitor-id-you-stored',
    ]),
]);
$body = curl_exec($ch);
curl_close($ch);
echo $body;   // {"id":123,"status":"recorded"}`,

    node: `// Node 18+ has fetch built in.
const res = await fetch("${url}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.TRYNOBOT_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    site_id: "${site}",
    event: "purchase",
    revenue: 49.0,
    currency: "USD",
    visitor_id: "the-visitor-id-you-stored",
  }),
  signal: AbortSignal.timeout(5000),
});

if (!res.ok) throw new Error(\`TryNoBot: \${res.status} \${await res.text()}\`);
console.log(await res.json());   // { id: 123, status: "recorded" }`,

    go: `package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"time"
)

func recordConversion() error {
	body, _ := json.Marshal(map[string]any{
		"site_id":    "${site}",
		"event":      "purchase",
		"revenue":    49.00,
		"currency":   "USD",
		"visitor_id": "the-visitor-id-you-stored",
	})

	req, err := http.NewRequest("POST", "${url}", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("TRYNOBOT_API_KEY"))
	req.Header.Set("Content-Type", "application/json")

	// Analytics must never hold up the request that triggered it.
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}`,
  } as Record<Lang, string>;
}

export default function ApiDocs({ sites }: { sites: { name: string; tracking_id: string }[] }) {
  const [tab, setTab] = useState<Lang>("curl");
  const [site, setSite] = useState(sites[0]?.tracking_id || "");
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://trynobot.com";
  // Substituting the real site id means the sample is runnable as pasted,
  // which is the difference between documentation and a worked example.
  const code = useMemo(
    () => samples(origin, site || "st_your_site_id")[tab],
    [origin, site, tab]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked — the code is on screen to select by hand */ }
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold">Using your key</h2>
      <p className="mt-1 max-w-3xl text-sm text-fg-muted">
        One endpoint needs an API key: recording a sale or signup from your own server.
        Send it <b>after</b> the payment succeeds, so your numbers only ever count real
        money. Everything else — scoring visitors, blocking bots — happens through the
        tracking snippet and needs no key.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-bg-soft px-3 py-1.5 font-mono text-xs">
          <b className="text-brand">POST</b> {origin}/api/v1/conversions/
        </code>
        {sites.length > 1 && (
          <select value={site} onChange={(e) => setSite(e.target.value)}
            className="rounded-lg border border-line bg-bg-soft px-3 py-1.5 text-xs">
            {sites.map((s) => (
              <option key={s.tracking_id} value={s.tracking_id}>{s.name} ({s.tracking_id})</option>
            ))}
          </select>
        )}
      </div>

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

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card shadow-soft p-5">
          <h3 className="text-sm font-bold">What to send</h3>
          <dl className="mt-3 space-y-2.5 text-xs">
            {FIELDS.map(([name, req, desc]) => (
              <div key={name}>
                <dt className="flex items-center gap-2">
                  <code className="rounded bg-bg-mute px-1.5 py-0.5 font-mono font-bold">{name}</code>
                  <span className={req === "required" ? "font-semibold text-red-500" : "text-fg-dim"}>{req}</span>
                </dt>
                <dd className="mt-0.5 leading-relaxed text-fg-muted">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card shadow-soft p-5">
          <h3 className="text-sm font-bold">What comes back</h3>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-bg-soft p-3 text-[11px] leading-relaxed"><code>{`201  {"id": 123, "status": "recorded"}`}</code></pre>
          <h3 className="mt-5 text-sm font-bold">When it doesn't</h3>
          <dl className="mt-2 space-y-2 text-xs">
            <div>
              <dt><code className="rounded bg-bg-mute px-1.5 py-0.5 font-mono font-bold">401</code> Invalid API key</dt>
              <dd className="mt-0.5 text-fg-muted">The header is missing, malformed, or the key was revoked.
                It must read <code className="rounded bg-bg-mute px-1 py-0.5">Authorization: Bearer blk_…</code>.</dd>
            </div>
            <div>
              <dt><code className="rounded bg-bg-mute px-1.5 py-0.5 font-mono font-bold">400</code> Unknown site_id for this API key</dt>
              <dd className="mt-0.5 text-fg-muted">The site exists but belongs to another workspace, or the
                tracking ID has a typo. Keys only ever reach their own workspace's sites.</dd>
            </div>
          </dl>
          {/* Said plainly because the failure is silent and the symptom —
              "my conversions are all zero" — points nowhere near the cause. */}
          <p className="mt-5 rounded-lg bg-warning/5 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
            <b>Set a timeout.</b> Recording a sale must never be able to hold up the
            checkout that produced it. Every sample above uses five seconds, and treats
            a failure here as something to log rather than to show the customer.
          </p>
        </div>
      </div>

      <p className="mt-5 text-xs text-fg-dim">
        Want to be told when a conversion is recorded, rather than asking? Add a webhook
        under Integrations and we will POST <code className="rounded bg-bg-mute px-1 py-0.5">conversion.created</code> to your endpoint.
      </p>
    </div>
  );
}

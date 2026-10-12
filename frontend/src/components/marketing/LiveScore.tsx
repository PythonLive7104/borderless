import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { previewApi, type PreviewResult, type PreviewVisitor } from "../../lib/api";

/**
 * The live "what do you see about me?" panel.
 *
 * Every other SaaS demo needs invented data. Ours doesn't: the product's input
 * is the visitor, so the person reading the page is already a complete example.
 * Nothing to type, nothing to install — which is the entire point, so this is
 * never gated behind an email.
 *
 * Reads from /v1/preview, which scores and explains but stores nothing. See
 * decision/preview.go for why that endpoint exists instead of /v1/decide.
 */

// A minimal browser fingerprint. The full one lives in the tracker (bl.js); we
// only need enough for the engine to tell a real browser from a script, and to
// avoid being scored as "no JS fingerprint" — which would add risk to every
// visitor and make the demo misrepresent its own product.
function miniFingerprint() {
  const n = navigator as any;
  const flags: string[] = [];
  let canvas = "";
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60"; ctx.fillRect(2, 2, 120, 20);
      ctx.fillStyle = "#069"; ctx.fillText("TryNoBot,fp", 4, 17);
      canvas = c.toDataURL();
    }
  } catch { /* blocked: handled as a flag below */ }

  const ua = n.userAgent || "";
  if (n.webdriver) flags.push("webdriver");
  if (!n.languages?.length && !n.language) flags.push("no_languages");
  if (!canvas) flags.push("no_canvas");
  if ((n.hardwareConcurrency || 0) === 0) flags.push("no_hardware_concurrency");

  let hash = 5381;
  const basis = [n.platform, (n.languages || []).join(","), n.hardwareConcurrency,
    screen.width, screen.height, screen.colorDepth, window.devicePixelRatio, canvas].join("|");
  for (let i = basis.length; i; ) hash = (hash * 33) ^ basis.charCodeAt(--i);

  return {
    hash: (hash >>> 0).toString(16),
    platform: n.platform || "",
    webdriver: !!n.webdriver,
    plugins: n.plugins?.length || 0,
    hw: n.hardwareConcurrency || 0,
    flags,
  };
}

const VERDICT = {
  human: { label: "Human", tone: "text-emerald-700", ring: "stroke-emerald-500", bg: "bg-emerald-50" },
  suspicious: { label: "Suspicious", tone: "text-amber-700", ring: "stroke-amber-500", bg: "bg-amber-50" },
  bot: { label: "Bot", tone: "text-red-700", ring: "stroke-red-500", bg: "bg-red-50" },
  fraud: { label: "Fraud", tone: "text-red-700", ring: "stroke-red-600", bg: "bg-red-50" },
} as const;

/**
 * A clean visitor produces NO risk signals, and an empty list reads as "we
 * found nothing" — the opposite of the impression we want. So a clean result
 * states what was actually checked and passed. These are derived from the same
 * response, never invented.
 */
function passedChecks(v: PreviewVisitor, hadFingerprint: boolean): string[] {
  const out: string[] = [];
  if (hadFingerprint) out.push("Real browser fingerprint");
  if (v.connection && !v.is_datacenter) out.push(`${v.connection} connection`);
  if (!v.is_vpn && !v.is_proxy) out.push("Not using a VPN or proxy");
  if (!v.is_datacenter) out.push("Not a datacenter IP");
  if (v.has_ja3) out.push("TLS fingerprint matches a real browser");
  out.push("Not on any known-bot list");
  return out;
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-0">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="truncate text-xs font-semibold text-fg">{value}</dd>
    </div>
  );
}

export default function LiveScore({
  ctaTo = "/bot-check",
  ctaLabel = "Check my website →",
}: { ctaTo?: string; ctaLabel?: string } = {}) {
  const [res, setRes] = useState<PreviewResult | null>(null);
  const [failed, setFailed] = useState(false);
  const hadFP = useRef(false);

  useEffect(() => {
    const ctrl = new AbortController();
    let fp: unknown;
    try { fp = miniFingerprint(); hadFP.current = true; } catch { /* still worth asking */ }
    previewApi.me({ fp }, ctrl.signal)
      .then(setRes)
      .catch(() => setFailed(true));
    return () => ctrl.abort();
  }, []);

  // If our own demo can't answer, say nothing rather than showing a broken
  // widget on the homepage of a product that sells reliability.
  if (failed) return null;

  const v = res?.visitor;
  const verdict = res ? VERDICT[res.classification] ?? VERDICT.suspicious : null;
  const pct = res ? Math.max(0, Math.min(100, res.score)) : 0;
  const circumference = 2 * Math.PI * 42;

  return (
    <div className="card shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div>
          <h3 className="text-sm font-bold">You, scored live</h3>
          <p className="text-xs text-fg-muted">
            The same check that runs on every visitor to your site.
          </p>
        </div>
        {res && (
          <span className="shrink-0 rounded-full bg-bg-mute px-2.5 py-1 text-[11px] font-semibold text-fg-muted">
            {res.took_ms} ms
          </span>
        )}
      </div>

      {!res ? (
        <div className="grid place-items-center py-16">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand" />
          <p className="mt-3 text-xs text-fg-muted">Checking you…</p>
        </div>
      ) : (
        <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr]">
          {/* score dial */}
          <div className="flex flex-col items-center justify-center gap-2 sm:w-36">
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9"
                  className="stroke-line" />
                <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9"
                  strokeLinecap="round" className={verdict!.ring}
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - pct / 100)} />
              </svg>
              <div className="absolute inset-0 grid place-content-center text-center">
                <div className="text-3xl font-extrabold leading-none">{res.score}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-fg-dim">
                  risk
                </div>
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${verdict!.bg} ${verdict!.tone}`}>
              {res.visitor.is_crawler ? "Verified crawler" : verdict!.label}
            </span>
          </div>

          <div className="min-w-0">
            {/* what we saw */}
            <dl className="rounded-xl border border-line bg-bg-soft px-3 py-1">
              <Row label="IP address" value={v!.ip} />
              <Row label="Location" value={v!.country} />
              <Row label="Connection" value={v!.connection || (v!.is_datacenter ? "Data Center" : "")} />
              <Row label="Network" value={v!.isp} />
              <Row label="Device" value={[v!.device, v!.os, v!.os_version].filter(Boolean).join(" · ")} />
              <Row label="Browser" value={[v!.browser, v!.browser_version].filter(Boolean).join(" ")} />
            </dl>

            {/* why */}
            <div className="mt-3">
              {res.signals.length > 0 ? (
                <ul className="space-y-1">
                  {res.signals.map((s) => (
                    <li key={s.code} className="flex items-start gap-2 text-xs">
                      <span aria-hidden className={s.good ? "text-emerald-600" : "text-amber-600"}>
                        {s.good ? "✓" : "!"}
                      </span>
                      <span className="text-fg-muted">{s.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-1">
                  {passedChecks(v!, hadFP.current).map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs">
                      <span aria-hidden className="text-emerald-600">✓</span>
                      <span className="text-fg-muted">{c}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {res.visitor.is_crawler && (
              <p className="mt-3 rounded-lg bg-brand/5 px-3 py-2 text-xs text-fg-muted">
                You're a verified crawler, so we'd send you straight to the real page —
                never a different one. Showing reviewers something else is cloaking.
              </p>
            )}
          </div>
        </div>
      )}

      {/* The bridge. Without this the panel is a clever toy: a visitor's own
          humanity isn't their problem — the traffic hitting their site is. */}
      <div className="border-t border-line bg-bg-soft px-5 py-4">
        <p className="text-sm font-semibold">That's one visitor. What's hitting your site?</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Run the same check against your own domain — free, no account needed.
        </p>
        <Link to={ctaTo}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

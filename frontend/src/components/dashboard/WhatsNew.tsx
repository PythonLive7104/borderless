import { useState } from "react";
import { Link } from "react-router-dom";

// Bump this key when the announcement changes so a dismissed note reappears
// with new content. localStorage read/writes are wrapped — a private window or
// blocked storage must not break the page.
const KEY = "tnb:whatsnew:2026-09";

function dismissed(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** A small, dismissible "what's new / coming soon" note so users can see the
 *  product is moving — the funnel is live now, more detection depth is next. */
export default function WhatsNew() {
  const [hidden, setHidden] = useState(dismissed);
  if (hidden) return null;

  const close = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className="mb-5 rounded-2xl border border-brand/25 bg-brand/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">New</span>
            <span className="text-sm font-bold">Filtering funnel is live</span>
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            See exactly how much traffic we check and how much we filter out — with the reasons.{" "}
            <Link to="/dashboard/reports" className="font-semibold text-brand hover:underline">Open Reports →</Link>
          </p>
          <p className="mt-2 text-xs text-fg-dim">
            <b className="text-fg-muted">Coming next:</b> deeper targeting (ISP/ASN, carrier,
            language & timezone checks), JA4 fingerprinting, per-campaign streams, and faster decisions.
          </p>
        </div>
        <button onClick={close} aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1 text-fg-dim hover:bg-brand/10 hover:text-fg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

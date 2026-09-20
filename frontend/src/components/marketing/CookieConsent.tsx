import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { setConsent, storedConsent } from "../../lib/analytics";

/** Consent banner for analytics/advertising cookies.
 *
 * Shown until the visitor answers. Consent Mode starts denied (see
 * lib/analytics.ts), so declining is genuinely the status quo rather than a
 * button that changes nothing — which is what UK PECR and the EU rules
 * actually require, and what a Google Ads landing-page review looks for.
 */
export default function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(storedConsent() === null); }, []);

  if (!open) return null;

  const choose = (granted: boolean) => () => { setConsent(granted); setOpen(false); };

  return (
    <div role="dialog" aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 p-4 shadow-[0_-8px_24px_-16px_rgba(15,23,42,.4)] backdrop-blur">
      <div className="container-page flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-fg-muted">
          We use cookies to measure how our ads and site perform. Decline and we'll only
          keep what the site needs to work.{" "}
          <Link to="/privacy" className="font-semibold text-brand">Privacy policy</Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button onClick={choose(false)}
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-fg hover:border-brand/50 hover:text-brand">
            Decline
          </button>
          <button onClick={choose(true)}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

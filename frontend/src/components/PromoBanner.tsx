import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { billingApi, type PromoInfo } from "../lib/api";

/** The site-wide Black Friday notice that sits just below the navbar on every
 *  page. It reads the live campaign from the public /billing/promo/ endpoint, so
 *  it shows only while a promo is actually running and disappears by itself the
 *  day the campaign ends — nothing to take down by hand.
 *
 *  Dismissal is deliberately in-memory only (a plain useState, no localStorage):
 *  closing it hides it for this view, but a refresh brings it back. That's the
 *  behaviour asked for — a promo worth running is worth showing again next visit,
 *  while still letting someone clear it out of the way for the current page.
 */
export default function PromoBanner({ ctaHref = "/pricing" }: { ctaHref?: string }) {
  const [promo, setPromo] = useState<PromoInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    billingApi.promoInfo().then((p) => { if (alive) setPromo(p); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!promo?.active || dismissed) return null;

  // Parse as a local date (the server sends a bare YYYY-MM-DD) so the day shown
  // doesn't slip by a timezone.
  const endLabel = promo.ends
    ? new Date(`${promo.ends}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })
    : "";

  return (
    <div
      role="region"
      aria-label="Black Friday promotion"
      className="tnb-promo relative overflow-hidden border-b border-amber-400/30 text-amber-50"
      style={{ background: "linear-gradient(90deg,#1b1200,#3a1d00,#1b1200)" }}
    >
      <span className="tnb-promo-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 text-sm">
        <span className="tnb-promo-gift text-lg leading-none" aria-hidden="true">🎁</span>
        <p className="min-w-0 flex-1 truncate sm:whitespace-normal">
          <b className="font-extrabold text-amber-300">Black Friday</b>
          <span className="mx-1.5 hidden text-amber-200/50 sm:inline">·</span>
          <span className="text-amber-100/90">
            Use code{" "}
            <b className="rounded bg-amber-400/20 px-1.5 py-0.5 font-mono font-bold text-amber-200">{promo.code}</b>{" "}
            at checkout for <b>{promo.multiplier}× your Pro plan</b> — same price.
            {endLabel && <span className="text-amber-200/70"> Ends {endLabel}.</span>}
          </span>
        </p>
        <Link
          to={ctaHref}
          className="hidden shrink-0 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950 transition hover:bg-amber-300 sm:inline-block"
        >
          Claim offer →
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss promotion"
          className="shrink-0 rounded-full p-1 text-amber-200/70 transition hover:bg-white/10 hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <style>{`
        .tnb-promo { animation: tnb-promo-in .5s cubic-bezier(.16,1,.3,1) both; }
        @keyframes tnb-promo-in { from { transform: translateY(-100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .tnb-promo-shimmer { background: linear-gradient(100deg, transparent 20%, rgba(255,214,120,.16) 50%, transparent 80%); background-size: 200% 100%; animation: tnb-promo-sh 3.5s linear infinite; }
        @keyframes tnb-promo-sh { from { background-position: 200% 0 } to { background-position: -200% 0 } }
        .tnb-promo-gift { display: inline-block; animation: tnb-promo-bob 2s ease-in-out infinite; }
        @keyframes tnb-promo-bob { 0%,100% { transform: translateY(0) rotate(0) } 25% { transform: translateY(-2px) rotate(-8deg) } 75% { transform: translateY(-2px) rotate(8deg) } }
        @media (prefers-reduced-motion: reduce) { .tnb-promo, .tnb-promo-shimmer, .tnb-promo-gift { animation: none } }
      `}</style>
    </div>
  );
}

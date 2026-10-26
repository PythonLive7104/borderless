import { useState } from "react";
import type { MyTestimonial } from "../../lib/api";

/** "Would you post that on G2 too?"
 *
 *  Asked at the one moment it is easy to say yes to: they have just written
 *  something kind and it is still on screen. Asking cold by email a month later
 *  means writing it again from nothing, which is why almost nobody does.
 *
 *  Three rules, and they are not decoration:
 *
 *  1. Only happy customers are asked. Sending someone who rated us two stars to
 *     a public review site is self-harm, and a testimonial form is not the place
 *     to discover that.
 *  2. Their own words travel with them. The quote is shown with a copy button,
 *     so the public review is two minutes, not a blank page.
 *  3. Nothing is shown until there is somewhere to send them. The links come
 *     from VITE_REVIEW_URL_* and the block hides itself when they are unset, so
 *     this ships dormant and wakes up the day the profiles exist.
 */

type Site = { key: string; label: string; url: string };

function sites(): Site[] {
  const env = (import.meta as any).env || {};
  return [
    { key: "g2", label: "G2", url: env.VITE_REVIEW_URL_G2 || "" },
    { key: "capterra", label: "Capterra", url: env.VITE_REVIEW_URL_CAPTERRA || "" },
    { key: "trustpilot", label: "Trustpilot", url: env.VITE_REVIEW_URL_TRUSTPILOT || "" },
  ].filter((s) => s.url);
}

/** Below this we say thank you and stop. */
const HAPPY = 4;

export default function ReviewAsk({ t }: { t: MyTestimonial }) {
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);
  const where = sites();

  if (!where.length || t.rating < HAPPY || done) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(t.quote);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the quote is on screen to select by hand */ }
  }

  return (
    <div className="mt-4 rounded-xl border border-brand/25 bg-brand/5 p-4">
      <div className="text-sm font-bold">Would you post that publicly too?</div>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">
        It's the single most useful thing you can do for us. Other advertisers
        trust a named review far more than anything we say about ourselves —
        and your words are already written, so it's a paste and a click.
      </p>

      <div className="mt-3 rounded-lg border border-line bg-bg-soft px-3 py-2">
        <p className="text-xs italic leading-relaxed text-fg-muted">
          &ldquo;{t.quote}&rdquo;
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:border-brand/50 hover:text-brand">
          {copied ? "Copied ✓" : "Copy my words"}
        </button>
        {where.map((s) => (
          <a key={s.key} href={s.url} target="_blank" rel="noopener noreferrer"
            className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600">
            Post on {s.label}
          </a>
        ))}
        <button type="button" onClick={() => setDone(true)}
          className="text-xs font-semibold text-fg-dim hover:text-fg">
          No thanks
        </button>
      </div>
    </div>
  );
}

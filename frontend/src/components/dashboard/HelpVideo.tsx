import { useState } from "react";

/**
 * A short walkthrough video for a dashboard page.
 *
 * The iframe is mounted only after the button is pressed — an embed that loads
 * on every page view costs a request to a third party for the large majority of
 * visits where nobody watches it, and it would sit in the layout as dead weight
 * above the thing people actually came to use.
 *
 * Note: the site's Content-Security-Policy must list the player's host under
 * frame-src (see deploy/security-headers.inc). A missing entry renders an empty
 * box with nothing in the UI to explain it.
 */
export default function HelpVideo({
  id, title, minutes,
}: { id: string; title: string; minutes?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center gap-4 rounded-xl border border-brand/30 bg-brand/5 p-5 text-left transition hover:border-brand/60 hover:bg-brand/10 sm:gap-5 sm:p-6"
        >
          {/* cta-glow pulses the ring and stills itself under
              prefers-reduced-motion — see index.css. */}
          <span className="cta-glow grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-white transition group-hover:scale-105 sm:h-16 sm:w-16">
            <svg viewBox="0 0 24 24" className="h-6 w-6 translate-x-[2px] sm:h-7 sm:w-7" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="mb-1 inline-block rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              Watch first
            </span>
            <span className="block text-base font-bold leading-snug sm:text-lg">{title}</span>
            <span className="block text-sm text-fg-muted">
              A short walkthrough{minutes ? ` — ${minutes}` : ""}. Tap to play here.
            </span>
          </span>
        </button>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between rounded-t-xl">
            <span className="text-sm font-semibold">{title}</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-fg-muted hover:text-fg"
            >
              Hide video
            </button>
          </div>
          {/* 16:9, so it scales with the column instead of a fixed height. */}
          <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={`https://www.loom.com/embed/${id}`}
              title={title}
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </>
      )}
    </div>
  );
}

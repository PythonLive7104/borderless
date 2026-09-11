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
    <div className="mb-4 rounded-xl border border-line bg-bg-mute/40 p-3.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-white">
            {/* Play triangle */}
            <svg viewBox="0 0 24 24" className="h-4 w-4 translate-x-[1px]" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span>
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-xs text-fg-muted">
              Watch the walkthrough{minutes ? ` — ${minutes}` : ""}
            </span>
          </span>
        </button>
      ) : (
        <>
          <div className="mb-2 flex items-center justify-between">
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

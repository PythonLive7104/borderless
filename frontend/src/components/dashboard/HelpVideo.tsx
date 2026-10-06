import { useState } from "react";
import { HAS_WEBM } from "./helpVideoFormats";

/**
 * A short walkthrough video for a dashboard page.
 *
 * Self-hosted, not embedded. These started life as Loom embeds; Loom took the
 * videos down and the pages were left with a play button that opened an empty
 * box. A file under our own /videos/ can't be retired by a third party, needs
 * no frame-src entry, and ships no tracking script to the people watching it.
 *
 * The <video> is mounted only after the button is pressed. preload="none" is
 * belt-and-braces for the same reason: these files are megabytes, and the large
 * majority of page views never play them.
 *
 * `name` is the basename under frontend/public/videos — scripts/encode-videos.sh
 * writes <name>.mp4 and <name>.jpg from each recording, so those paths follow
 * from it. The .webm is conditional: that script keeps one only where VP9 beat
 * H.264 on size, which on an already well-compressed screencast it sometimes
 * doesn't, and reports what it kept in the generated helpVideoFormats.ts. The
 * list has to be consulted rather than assumed — a <source> pointing at a .webm
 * that was never written costs every viewer a 404 before playback starts, and
 * because <video> then falls through to the mp4 and plays, it looks fine.
 */
export default function HelpVideo({
  name, title, minutes,
}: { name: string; title: string; minutes?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group flex w-full items-center gap-4 rounded-xl border border-brand/30 bg-brand/5 p-5 text-left transition hover:border-brand/60 hover:bg-brand/10 sm:gap-5 sm:p-6"
        >
          {/* pulse-red: loud red glow so the "watch first" button can't be
              missed; stills itself under prefers-reduced-motion (see index.css). */}
          <span className="pulse-red grid h-14 w-14 shrink-0 place-items-center rounded-full bg-red-600 text-white transition group-hover:scale-105 sm:h-16 sm:w-16">
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
          <div className="relative w-full overflow-hidden rounded-lg bg-black" style={{ paddingTop: "56.25%" }}>
            <video
              controls
              autoPlay
              preload="none"
              /* iOS Safari hijacks an un-hinted <video> into its fullscreen
                 player, which drops the viewer out of the dashboard on tap. */
              playsInline
              poster={`/videos/${name}.jpg`}
              className="absolute inset-0 h-full w-full"
            >
              {HAS_WEBM.has(name) && (
                <source src={`/videos/${name}.webm`} type="video/webm" />
              )}
              <source src={`/videos/${name}.mp4`} type="video/mp4" />
              <a href={`/videos/${name}.mp4`} download>Download the walkthrough video</a>
            </video>
          </div>
        </>
      )}
    </div>
  );
}

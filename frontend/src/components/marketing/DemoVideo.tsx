import { useEffect, useRef, useState } from "react";
import Modal from "../ui/Modal";

/** "View Demo" — opens the product walkthrough in a lightbox.
 *
 *  It used to be href="#demo", which scrolled a few hundred pixels to the mock
 *  dashboard beside the hero. Someone who clicks a button labelled View Demo
 *  expects to watch something, not to be moved slightly down the page they are
 *  already on.
 *
 *  The video is NOT in the page markup and is not preloaded. At ~6MB it would
 *  otherwise be downloaded by every visitor to a page most of them scroll past,
 *  on a landing page whose whole job is loading fast. The <video> element only
 *  mounts when the modal opens, so the bytes are fetched by people who asked
 *  for them.
 */
export default function DemoVideo({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLVideoElement | null>(null);

  // Autoplay on open: they pressed a play-shaped button, so waiting for a
  // second click is friction. Muted because an unmuted autoplay is both rude
  // and blocked by every browser — the walkthrough has no audio track anyway.
  useEffect(() => {
    if (!open) return;
    const v = ref.current;
    if (v) v.play().catch(() => { /* blocked: the controls are right there */ });
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        /* bg-[#fff], not bg-white. index.css remaps --color-white to the card
           surface in dark theme (it means "card", not "white", in 119 places),
           which turned this pill near-black with near-black text on it. The
           hero band is dark in BOTH themes, so this button has to stay
           literally white and ignore the theme entirely. */
        className={`demo-glow group inline-flex items-center gap-2.5 rounded-full bg-[#ffffff] px-6 py-3 text-base font-semibold text-navy-950 transition hover:bg-slate-100 ${className}`}>
        {/* A filled play disc rather than a bare triangle: at this size the
            triangle alone reads as a decorative chevron, and the point of the
            button is that something will actually play. */}
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand text-white transition group-hover:scale-110">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        Watch 80-second demo
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="TryNoBot in 80 seconds" size="wide">
        <div className="overflow-hidden rounded-xl bg-navy-900">
          <video
            ref={ref}
            className="block h-auto w-full"
            controls
            playsInline
            muted
            preload="none"
            poster="/videos/demo.jpg"
          >
            {/* H.264 only, deliberately. VP9 usually wins by a wide margin on a
                screencast, but on this edit it came out 12% LARGER (6.56MB vs
                5.83MB) — the cuts and motion give up the advantage it gets from
                flat, static UI. Shipping it as the first <source> would make
                every viewer download the worse file. Same rule as
                encode-videos.sh: keep the WebM only when it actually wins. */}
            <source src="/videos/demo.mp4" type="video/mp4" />
            <a href="/videos/demo.mp4" download>Download the demo video</a>
          </video>
        </div>
      </Modal>
    </>
  );
}

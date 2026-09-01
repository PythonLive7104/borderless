import { useEffect, useState, type ReactNode } from "react";

export type Slide = { badge: string; title: ReactNode; subtitle: string };

export default function HeroCarousel({ slides, interval = 5500 }: { slides: Slide[]; interval?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (n: number) => setI((n + slides.length) % slides.length);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [paused, slides.length, interval]);

  const s = slides[i];
  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* arrows */}
      <button aria-label="Previous" onClick={() => go(i - 1)}
        className="absolute -left-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-2 text-white/70 backdrop-blur transition hover:bg-white/15 hover:text-white sm:block lg:-left-10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 6l-6 6 6 6"/></svg>
      </button>
      <button aria-label="Next" onClick={() => go(i + 1)}
        className="absolute -right-2 top-1/2 hidden -translate-y-1/2 rounded-full border border-white/15 bg-white/5 p-2 text-white/70 backdrop-blur transition hover:bg-white/15 hover:text-white sm:block lg:-right-10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6"/></svg>
      </button>

      {/* slide (keyed so the fade re-runs) */}
      <div key={i} className="fade-up min-h-[220px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan" /> {s.badge}
        </span>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
          {s.title}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">{s.subtitle}</p>
      </div>

      {/* dots */}
      <div className="mt-7 flex gap-2">
        {slides.map((_, n) => (
          <button key={n} aria-label={`Slide ${n + 1}`} onClick={() => go(n)}
            className={`h-1.5 rounded-full transition-all ${n === i ? "w-8 bg-white" : "w-4 bg-white/30 hover:bg-white/50"}`} />
        ))}
      </div>
    </div>
  );
}

import { useState } from "react";
import { Section, SectionHead } from "../ui/Section";
import { TESTIMONIALS, HAS_TESTIMONIALS } from "../../data/testimonials";

/** Customer testimonials, from the generated data file.
 *
 *  Renders nothing at all when there are none. That is deliberate: an empty
 *  carousel, a "testimonials coming soon" placeholder, or invented quotes are
 *  each worse than the section simply not existing yet. The first real one
 *  publishes the section; until then the page is honest by omission.
 */
function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${n} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24"
             className={i < n ? "text-amber-400" : "text-line"} fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  const [i, setI] = useState(0);
  if (!HAS_TESTIMONIALS) return null;

  const t = TESTIMONIALS[i];
  const many = TESTIMONIALS.length > 1;
  const go = (d: number) => setI((n) => (n + d + TESTIMONIALS.length) % TESTIMONIALS.length);

  return (
    <Section className="bg-bg-soft rounded-none">
      <SectionHead eyebrow="Customers" title="Why marketers choose TryNoBot"
        sub="Published with permission, in their own words." />

      <div className="mx-auto mt-12 flex max-w-4xl items-center gap-3">
        {many && (
          <button type="button" onClick={() => go(-1)} aria-label="Previous testimonial"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-fg-muted shadow-soft transition hover:text-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}

        <figure className="card shadow-soft flex-1 p-8">
          <Stars n={t.rating} />
          <blockquote className="mt-5 text-xl font-bold leading-snug text-fg sm:text-2xl">
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-5 text-sm text-fg-muted">
            <span className="font-semibold text-fg">{t.name}</span>
            {t.role && <>, {t.role}</>}
            {t.company && <> &middot; {t.company}</>}
            {t.country && <div className="mt-0.5 text-xs text-fg-dim">{t.country}</div>}
          </figcaption>
        </figure>

        {many && (
          <button type="button" onClick={() => go(1)} aria-label="Next testimonial"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-white text-fg-muted shadow-soft transition hover:text-brand">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
      </div>

      {many && (
        <div className="mt-6 flex justify-center gap-2">
          {TESTIMONIALS.map((_, n) => (
            <button key={n} type="button" onClick={() => setI(n)}
              aria-label={`Testimonial ${n + 1}`} aria-current={n === i}
              className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-brand" : "w-2 bg-line hover:bg-fg-dim"}`} />
          ))}
        </div>
      )}
    </Section>
  );
}

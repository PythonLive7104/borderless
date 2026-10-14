import { Link, useParams } from "react-router-dom";
import { useSeo } from "../../lib/seo";
import { useCta } from "../../lib/useCta";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section, SectionHead } from "../../components/ui/Section";
import { COMPARISON_CHECKED, comparisonBySlug, COMPARISONS } from "../../data/comparisons";
import { IArrow, ICheck } from "../../components/ui/icons";
import JsonLd from "../../components/marketing/JsonLd";
import { breadcrumbs, faqPage, graph } from "../../lib/schema";

/** One head-to-head comparison.
 *
 *  The "where they win" block is rendered with the same visual weight as our
 *  own advantages, deliberately. A comparison page that buries the competitor's
 *  strengths in small grey text is the thing buyers have learned to distrust,
 *  and the honest version is what makes the rest of the page believable.
 */
export default function CompareDetail() {
  const { slug = "" } = useParams();
  const c = comparisonBySlug(slug);
  const cta = useCta();

  useSeo(
    c ? c.title : "Comparison not found",
    c ? c.metaDescription : "That comparison does not exist. See all TryNoBot comparisons.",
  );

  if (!c) {
    return (
      <Section>
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Comparison not found</h1>
          <p className="mt-3 text-fg-muted">We don't have a comparison at that address.</p>
          <Button to="/compare" className="mt-6">See all comparisons</Button>
        </div>
      </Section>
    );
  }

  const others = COMPARISONS.filter((o) => o.slug !== c.slug);

  // The verdict is prepended as a question because "is X better than Y" is the
  // exact phrasing answer engines are asked, and the verdict is already written
  // as a direct answer to it.
  const jsonLd = graph(
    faqPage([
      { q: `Should I choose TryNoBot or ${c.name}?`, a: c.verdict },
      ...c.faq.map((f) => ({ q: f.q, a: f.a })),
    ]),
    breadcrumbs([
      { name: "Home", path: "/" },
      { name: "Compare", path: "/compare" },
      { name: `vs ${c.name}`, path: `/compare/${c.slug}` },
    ]),
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="light">TryNoBot vs {c.name}</Badge>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              TryNoBot vs {c.name}
            </h1>
            <p className="mt-5 text-left text-slate-300 sm:text-center">{c.intro}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to={cta.signupHref} size="lg">{cta.label("Start free")} <IArrow width={18} /></Button>
              <Button to="/bot-check" variant="light" size="lg">Check your site free</Button>
            </div>
          </div>
        </div>
      </section>

      {/* THE SHORT ANSWER — for the reader who gets no further. */}
      <Section className="!py-14">
        <div className="mx-auto max-w-3xl rounded-2xl border border-brand/30 bg-brand/5 p-7">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand">The short answer</div>
          <p className="mt-3 text-lg leading-relaxed text-fg">{c.verdict}</p>
        </div>
      </Section>

      {/* HEAD-TO-HEAD TABLE */}
      <Section className="bg-bg-soft rounded-none !pt-14">
        <SectionHead eyebrow="Head to head" title={`TryNoBot and ${c.name}, feature by feature`}
          sub="Rows marked with a dot are the material differences. Everything in the right-hand column is taken from their own published pages." />
        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-fg-dim">
                <th scope="col" className="px-5 py-3 font-semibold">&nbsp;</th>
                <th scope="col" className="px-5 py-3 font-semibold text-brand">TryNoBot</th>
                <th scope="col" className="px-5 py-3 font-semibold">{c.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {c.rows.map((r) => (
                <tr key={r.label} className={r.edge ? "bg-brand/[0.03]" : ""}>
                  <th scope="row" className="px-5 py-4 align-top font-semibold text-fg">
                    {r.edge && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" aria-label="Material difference" />}
                    {r.label}
                  </th>
                  <td className="px-5 py-4 align-top text-fg">{r.us}</td>
                  <td className="px-5 py-4 align-top text-fg-muted">{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-fg-dim">
          {c.name} figures read from their own pricing and feature pages on {COMPARISON_CHECKED}.
          Introductory offers and annual rates may differ — check theirs before deciding. Where a row
          reads "not published", that means we could not find it stated publicly, not that the
          product lacks it.
        </p>
      </Section>

      {/* BOTH SIDES, EQUAL WEIGHT */}
      <Section>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card shadow-soft p-7">
            <h2 className="text-xl font-bold">Where TryNoBot is stronger</h2>
            <ul className="mt-5 space-y-3">
              {c.ourStrengths.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><ICheck width={13} /></span>
                  <span className="text-sm leading-relaxed text-fg">{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card shadow-soft p-7">
            <h2 className="text-xl font-bold">Where {c.name} is stronger</h2>
            <ul className="mt-5 space-y-3">
              {c.theirStrengths.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700"><ICheck width={13} /></span>
                  <span className="text-sm leading-relaxed text-fg">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="bg-bg-soft rounded-none">
        <SectionHead eyebrow="Questions" title={`TryNoBot vs ${c.name}: common questions`} />
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          {c.faq.map((f) => (
            <div key={f.q} className="rounded-xl border border-line bg-white p-6 shadow-soft">
              <h3 className="font-bold text-fg">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* OTHER COMPARISONS — no page is a dead end. */}
      <Section className="!py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-lg font-bold">Other comparisons</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {others.map((o) => (
              <Link key={o.slug} to={`/compare/${o.slug}`}
                className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-fg-muted transition hover:border-brand/50 hover:text-brand">
                TryNoBot vs {o.name}
              </Link>
            ))}
            <Link to="/compare"
              className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-fg-muted transition hover:border-brand/50 hover:text-brand">
              All comparisons
            </Link>
          </div>
        </div>
      </Section>

      <Section className="!pt-0">
        <div className="hero-band relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="binary-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Try it on your own traffic for 7 days
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              No credit card. See what's actually hitting your landing pages, then decide.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to={cta.signupHref} size="lg">{cta.label("Start free")} <IArrow width={18} /></Button>
              <Button to="/pricing" variant="light" size="lg">View pricing</Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

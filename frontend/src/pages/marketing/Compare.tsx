import { Link } from "react-router-dom";
import { useSeo } from "../../lib/seo";
import { useCta } from "../../lib/useCta";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section, SectionHead } from "../../components/ui/Section";
import ComparisonTable from "../../components/marketing/ComparisonTable";
import { COMPARISONS } from "../../data/comparisons";
import { IArrow } from "../../components/ui/icons";
import JsonLd from "../../components/marketing/JsonLd";
import { abs, breadcrumbs, graph } from "../../lib/schema";

const COMPARE_JSONLD = graph(
  {
    "@type": "CollectionPage",
    name: "Compare TryNoBot with the alternatives",
    url: abs("/compare"),
    hasPart: COMPARISONS.map((c) => ({
      "@type": "WebPage",
      name: c.title,
      url: abs(`/compare/${c.slug}`),
      description: c.metaDescription,
    })),
  },
  breadcrumbs([{ name: "Home", path: "/" }, { name: "Compare", path: "/compare" }]),
);

/** Comparison hub: the entry point for "<competitor> alternative" searches,
 *  and the page the individual comparisons link back to. */
export default function Compare() {
  const cta = useCta();
  useSeo(
    "Compare TryNoBot with the alternatives",
    "Honest head-to-head comparisons of TryNoBot against ClickCease, Fraud Blocker and ClickPatrol — published prices, included volume, detection depth, and where each of them wins.",
  );

  return (
    <>
      <JsonLd data={COMPARE_JSONLD} />
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Comparisons</Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            How TryNoBot compares
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Prices read from each vendor's own pricing page, units quoted as they state them, and a
            plain note on each page about where the other product is the better buy. We would rather
            lose a sale than win one you cancel in a month.
          </p>
        </div>
      </section>

      <Section>
        <SectionHead eyebrow="At a glance" title="Entry tiers, side by side"
          sub="The plans buyers actually shortlist, at the prices each vendor publishes." />
        <div className="mt-12"><ComparisonTable /></div>
      </Section>

      <Section className="bg-bg-soft rounded-none">
        <SectionHead eyebrow="Head to head" title="Full comparisons"
          sub="Each one covers price, metering, detection depth and the gaps on both sides." />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COMPARISONS.map((c) => (
            <Link key={c.slug} to={`/compare/${c.slug}`}
              className="card card-hover shadow-soft group flex flex-col p-6">
              <h2 className="text-lg font-bold transition-colors group-hover:text-brand">
                TryNoBot vs {c.name}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">{c.verdict}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                Read the comparison <IArrow width={15} />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section>
        <div className="hero-band relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="binary-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Check your own traffic before you decide
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Run the free exposure check on your site, or start a 7-day trial and watch real traffic
              get scored. No credit card either way.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to={cta.signupHref} size="lg">{cta.label("Start free")} <IArrow width={18} /></Button>
              <Button to="/bot-check" variant="light" size="lg">Run a free check</Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

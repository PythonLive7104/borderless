import { Link } from "react-router-dom";
import { useSeo } from "../../lib/seo";
import { useCta } from "../../lib/useCta";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section } from "../../components/ui/Section";
import { postsByDate } from "../../data/posts";
import { IArrow } from "../../components/ui/icons";

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

export default function Blog() {
  const cta = useCta();
  const posts = postsByDate();
  useSeo(
    "Blog — ad traffic, bots and click fraud",
    "Practical writing on ad traffic quality: how to diagnose invalid clicks yourself, what datacenter IPs and TLS fingerprints actually tell you, and what to compare when buying click-fraud protection.",
  );

  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Blog</Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Ad traffic, bots and what the signals mean
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            How to diagnose your own traffic before buying anything, how the detection techniques
            actually work, and where their limits are.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.slug} to={`/blog/${p.slug}`}
              className="card card-hover shadow-soft group flex flex-col p-7">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
                <span>{p.tag}</span>
                <span className="text-fg-dim">·</span>
                <span className="font-medium normal-case tracking-normal text-fg-dim">
                  {p.readMinutes} min read
                </span>
              </div>
              <h2 className="mt-3 text-xl font-bold leading-snug transition-colors group-hover:text-brand">
                {p.title}
              </h2>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-fg-muted">{p.description}</p>
              <div className="mt-5 flex items-center justify-between">
                <time dateTime={p.date} className="text-xs text-fg-dim">{fmt(p.date)}</time>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                  Read <IArrow width={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="!pt-0">
        <div className="hero-band relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="binary-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Or just check your own site
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              The free exposure check reads only what's publicly visible and takes about ten seconds.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/bot-check" size="lg">Run a free check <IArrow width={18} /></Button>
              <Button to={cta.signupHref} variant="light" size="lg">{cta.label("Start free")}</Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

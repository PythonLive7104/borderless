import type { ComponentType, SVGProps } from "react";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import { Section, SectionHead } from "../ui/Section";
import { ICheck, IArrow } from "../ui/icons";

type Block = { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; desc: string };

export default function FeaturePage({
  eyebrow, title, sub, blocks, bullets, ctaTitle = "Ready to see it on your own traffic?",
}: {
  eyebrow: string; title: string; sub: string; blocks: Block[]; bullets?: string[]; ctaTitle?: string;
}) {
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">{eyebrow}</Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">{sub}</p>
          <div className="mt-8 flex justify-center gap-3">
            <Button to="/signup" size="lg">Start Free <IArrow width={18} /></Button>
            <Button to="/pricing" variant="light" size="lg">View pricing</Button>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((b) => (
            <div key={b.title} className="card card-hover shadow-soft p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand"><b.icon width={22} /></div>
              <h3 className="mt-4 text-lg font-bold">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{b.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {bullets && (
        <Section className="bg-bg-soft rounded-none">
          <SectionHead eyebrow="What's included" title="Built to be transparent and fast" center={false} />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {bullets.map((x) => (
              <div key={x} className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-soft">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand/10 text-brand"><ICheck width={13} /></span>
                <span className="text-sm text-fg">{x}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <div className="hero-band relative overflow-hidden rounded-3xl px-8 py-14 text-center">
          <div className="binary-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{ctaTitle}</h2>
            <div className="mt-8 flex justify-center gap-3">
              <Button to="/signup" size="lg">Get started free <IArrow width={18} /></Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

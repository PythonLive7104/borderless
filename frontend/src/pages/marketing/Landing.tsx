import { useSeo } from "../../lib/seo";
import Button from "../../components/ui/Button";
import { Section, SectionHead } from "../../components/ui/Section";
import LogoStrip from "../../components/marketing/LogoStrip";
import DashboardPreview from "../../components/marketing/DashboardPreview";
import HeroCarousel, { type Slide } from "../../components/marketing/HeroCarousel";
import { BRAND } from "../../lib/brand";
import { IRadar, IShield, IGauge, IChart, ITarget, IBolt, IArrow } from "../../components/ui/icons";

const FEATURES = [
  { icon: IRadar, title: "Traffic Intelligence", desc: "See every visitor and session with rich device, network and geo signals in real time." },
  { icon: IShield, title: "Fraud Detection", desc: "Catch bots, datacenter IPs, proxies and automation before they burn your budget." },
  { icon: IGauge, title: "Risk Scoring", desc: "Every click gets a transparent 0–100 score with the exact signals that drove it." },
  { icon: IChart, title: "Campaign Analytics", desc: "Break down quality, sources, geos and devices with fast, filterable reports." },
  { icon: ITarget, title: "Conversion Tracking", desc: "Attribute conversions and revenue back to campaigns and traffic quality." },
  { icon: IBolt, title: "Real-Time Monitoring", desc: "A live traffic feed with instant classification and rule actions as clicks land." },
];

const STEPS = [
  ["Connect your website", "Add a site and get a unique tracking ID in seconds."],
  ["Install tracking", "Drop one async script tag — it never blocks page load."],
  ["Analyze traffic", "We extract 40+ signals from every visit and session."],
  ["Score visitors", "Each visitor is scored and classified in milliseconds."],
  ["Protect campaigns", "Apply rules: allow, review, block or tag automatically."],
  ["Measure conversions", "Tie revenue back to the traffic that actually converts."],
];

const METRICS = [
  ["120M+", "Visitors analyzed"],
  ["3.4B", "Signals processed"],
  ["<8ms", "Avg processing time"],
  ["92.7%", "Median traffic quality"],
];

const SLIDES: Slide[] = [
  {
    badge: "Real-time traffic intelligence",
    title: (<>See every visitor.<br />Score every click.<br /><span className="text-gradient">Protect every campaign.</span></>),
    subtitle: BRAND.subtitle,
  },
  {
    badge: "Fraud detection",
    title: (<>Stop paying<br />for <span className="text-gradient">bot traffic.</span></>),
    subtitle: "Detect datacenter IPs, proxies, VPNs and automation before they drain your ad budget — with transparent, explainable scoring.",
  },
  {
    badge: "Explainable risk scoring",
    title: (<>Know your traffic<br />quality <span className="text-gradient">in real time.</span></>),
    subtitle: "Every visit is scored 0–100 and classified as Human, Suspicious, Bot or Fraud, with the exact signals that drove the decision.",
  },
  {
    badge: "Conversion tracking",
    title: (<>Measure what<br />actually <span className="text-gradient">converts.</span></>),
    subtitle: "Attribute conversions and revenue back to campaigns, sources and traffic quality — and double down on what works.",
  },
];

export default function Landing() {
  useSeo("Real-time traffic intelligence & bot detection", "Score every visitor, block bots and fraud, and protect your ad campaigns in real time with TrackAudit.");
  return (
    <>
      {/* HERO BAND */}
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <HeroCarousel slides={SLIDES} />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/signup" size="lg">Start Free <IArrow width={18} /></Button>
              <Button href="#demo" variant="light" size="lg">View Demo</Button>
            </div>
            <p className="mt-4 text-sm text-slate-400">No credit card required · 14-day trial · Cancel anytime</p>
          </div>
          <div id="demo" className="fade-up lg:pl-4"><DashboardPreview /></div>
        </div>
      </section>

      {/* LOGO STRIP */}
      <div className="border-b border-line bg-white"><LogoStrip /></div>

      {/* METRICS */}
      <Section className="!py-16">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRICS.map(([v, k]) => (
            <div key={k} className="card shadow-soft px-6 py-7 text-center">
              <div className="text-3xl font-extrabold tracking-tight text-fg">{v}</div>
              <div className="mt-1 text-sm text-fg-muted">{k}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* FEATURES */}
      <Section className="bg-bg-soft rounded-none">
        <SectionHead eyebrow="Platform" title="Everything you need to trust your traffic"
          sub="One platform to analyze, score, protect and measure the traffic hitting your campaigns." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card card-hover shadow-soft p-6">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
                <f.icon width={22} />
              </div>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* HOW IT WORKS */}
      <Section>
        <SectionHead eyebrow="How it works" title="From first click to measured conversion"
          sub="Go live in minutes. No infrastructure to run, no data pipelines to build." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="card shadow-soft relative p-6">
              <div className="absolute right-5 top-5 text-4xl font-black text-line">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-sm font-bold text-brand">Step {i + 1}</div>
              <h3 className="mt-2 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div className="hero-band relative overflow-hidden rounded-3xl px-8 py-16 text-center">
          <div className="binary-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Start understanding your traffic today.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Join marketers and agencies protecting their budgets with real-time traffic intelligence.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button to="/signup" size="lg">Create an account <IArrow width={18} /></Button>
              <Button to="/pricing" variant="light" size="lg">View pricing</Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

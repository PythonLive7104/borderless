import { Link } from "react-router-dom";
import { useSeo } from "../../lib/seo";
import { useCta } from "../../lib/useCta";
import LiveScore from "../../components/marketing/LiveScore";
import { useReveal } from "../../lib/useReveal";
import Button from "../../components/ui/Button";
import { Section, SectionHead } from "../../components/ui/Section";
import LogoStrip from "../../components/marketing/LogoStrip";
import Testimonials from "../../components/marketing/Testimonials";
import ReferralBand from "../../components/marketing/ReferralBand";
import JsonLd from "../../components/marketing/JsonLd";
import { graph, reviews } from "../../lib/schema";
import { AVERAGE_RATING, TESTIMONIALS } from "../../data/testimonials";

// Review markup, and only when there are real reviews to mark up. reviews()
// returns an empty list with none, so this is an empty graph that renders
// nothing rather than a rating we invented.
const REVIEW_NODES = reviews(
  TESTIMONIALS.map((t) => ({ quote: t.quote, name: t.name, rating: t.rating })),
  AVERAGE_RATING,
);
const LANDING_JSONLD = REVIEW_NODES.length ? graph(...REVIEW_NODES) : "";
import DashboardPreview from "../../components/marketing/DashboardPreview";
import HeroCarousel, { type Slide } from "../../components/marketing/HeroCarousel";
import { BRAND } from "../../lib/brand";
import { IRadar, IShield, IGauge, IChart, ITarget, IBolt, IArrow, IServer, ILock, IKey, IShieldGold, ICheck, IFunnel } from "../../components/ui/icons";

// Ordered for the buyer the paid campaigns are aimed at: an advertiser who
// has just worked out that some of their ad spend is buying automation. The
// first six answer "does this stop that"; the depth comes after.
//
// Redirect filtering, deep targeting and private domains are real features and
// stay on /features and in the docs — but they are not the shop window. Led
// with, they describe a traffic-shaping tool rather than a fraud-detection one,
// which is the wrong product to the buyer we want and the wrong signal to the
// reviewer deciding whether our own ads run.
const FEATURES = [
  { icon: IShield, title: "Click Fraud Protection", desc: "Catch bots, datacenter IPs, proxies and automation before they burn your Google, Microsoft or Meta ad budget — and remember an IP once it's caught, everywhere." },
  { icon: IGauge, title: "Explainable Risk Scoring", desc: "Every click gets a transparent 0–100 score with the exact signals that drove it. Never a verdict you can't audit." },
  { icon: IServer, title: "Server-Side Shield", desc: "Block bots before your page even loads — enforce your rules at your server or edge with a drop-in snippet for PHP, Django, nginx, Cloudflare or Node. Catches automation that never runs JavaScript." },
  { icon: IKey, title: "TLS Fingerprinting", desc: "Identify automated clients by their JA3/JA4 TLS signature, not just their user-agent — bots can't hide behind a fresh IP and a borrowed browser string." },
  { icon: IShieldGold, title: "Live IP Reputation", desc: "Real-time fraud scoring, proxy/VPN and recent-abuse checks on every IP, so a clean-looking address that's already known bad still gets caught." },
  { icon: IRadar, title: "Traffic Intelligence", desc: "See every visitor and session with rich device, network and geo signals in real time." },
  { icon: IBolt, title: "Real-Time Monitoring", desc: "A live traffic feed with instant classification and rule actions as clicks land." },
  { icon: IChart, title: "Campaign Analytics", desc: "Break down quality, sources, geos and devices with fast, filterable reports." },
  { icon: ITarget, title: "Conversion Tracking", desc: "Attribute conversions and revenue back to campaigns and traffic quality." },
  { icon: ICheck, title: "Silent Browser Check", desc: "A split-second, no-click \"checking your browser\" step that catches headless and automated browsers real people never use." },
  { icon: ILock, title: "Folder Guard", desc: "Lock down sensitive pages like /admin, /wp-login or /downloads so bots and fraud can't reach them at all." },
  { icon: IFunnel, title: "Filtering Funnel", desc: "See exactly how much traffic was checked, how much reached your page, and why the rest was turned away." },
];

const STEPS = [
  ["Connect your website", "Add a site and get a unique tracking ID in seconds."],
  ["Install tracking", "Drop one async script tag — it never blocks page load."],
  ["Analyze traffic", "We extract 40+ signals from every visit and session."],
  ["Score visitors", "Each visitor is scored and classified in milliseconds."],
  ["Protect campaigns", "Apply rules: allow, review, block or tag automatically."],
  ["Measure conversions", "Tie revenue back to the traffic that actually converts."],
];

// What the product does, not how much of it we've done. Volume and "median
// quality" numbers can't be substantiated on request — and an unsupported
// performance claim is the kind of thing the ASA, FTC, ACCC and the Competition
// Bureau act on, quite apart from what it does to a Google Ads review.
const METRICS = [
  ["<10ms", "Decision latency"],
  ["0–100", "Risk score per visit"],
  ["JA3 + JA4", "TLS fingerprinting"],
  ["4", "Verdicts: human, suspicious, bot, fraud"],
];

// Carousel order is the positioning. Slide one has to name the buyer's problem
// in their words — paying for clicks that were never people — before any claim
// about how we detect it.
const SLIDES: Slide[] = [
  {
    badge: "Click fraud protection",
    title: (<>Stop paying for<br />clicks that were<br /><span className="text-gradient">never people.</span></>),
    subtitle: BRAND.subtitle,
  },
  {
    badge: "Explainable risk scoring",
    title: (<>Know your traffic<br />quality <span className="text-gradient">in real time.</span></>),
    subtitle: "Every visit is scored 0–100 and classified as Human, Suspicious, Bot or Fraud, with the exact signals that drove the decision — so you can audit it, not just trust it.",
  },
  {
    badge: "Behavioral detection",
    title: (<>Catch bots that pass<br />every <span className="text-gradient">fingerprint check.</span></>),
    subtitle: "We score how real visitors move, scroll and type. Script-driven and synthetic interaction gives automation away — even on a clean IP with a perfect user-agent.",
  },
  {
    badge: "Server-side defense",
    title: (<>Block bots before<br />your page <span className="text-gradient">even loads.</span></>),
    subtitle: "A JavaScript tag only sees clients that run JavaScript. The server-side Shield scores the request first — from PHP, Django, Node, nginx or a Cloudflare Worker — so scripted traffic never reaches your landing page.",
  },
  {
    badge: "Network defense",
    title: (<>One customer's attacker<br />is <span className="text-gradient">everyone's known bot.</span></>),
    subtitle: "A fingerprint caught attacking any site on the network becomes known to all of them. Bot farms rotate IPs — but reuse the same fingerprint, and that's what gives them away, everywhere at once.",
  },
  {
    badge: "Ad-review transparency",
    title: (<>See which clicks were<br /><span className="text-gradient">the ad platform reviewing.</span></>),
    subtitle: "We verify and label Google Ads, AdSense and Bing Ads review bots — and show them the same page real visitors see, never a different one. Your click quality reflects real people, not the platform's own automated checks.",
  },
  {
    badge: "Conversion tracking",
    title: (<>Measure what<br />actually <span className="text-gradient">converts.</span></>),
    subtitle: "Attribute conversions and revenue back to campaigns, sources and traffic quality — and double down on what works.",
  },
];

export default function Landing() {
  const cta = useCta();
  useSeo("Stop paying for bot clicks on your ads", "Protect your Google and Microsoft Ads budget: every visitor scored 0-100 in real time, bots and click fraud blocked before they cost you, with the exact signals behind every decision.");
  useReveal();
  return (
    <>
      {LANDING_JSONLD && <JsonLd data={LANDING_JSONLD} />}
      {/* HERO BAND */}
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative grid items-center gap-12 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <HeroCarousel slides={SLIDES} />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to={cta.signupHref} size="lg">{cta.label("Start Free")} <IArrow width={18} /></Button>
              <Button href="#demo" variant="light" size="lg">View Demo</Button>
            </div>
            <p className="mt-4 text-sm text-slate-400">No credit card required · 7-day trial · Cancel anytime</p>
          </div>
          <div id="demo" className="fade-up lg:pl-4"><DashboardPreview /></div>
        </div>
      </section>

      {/* LIVE SCORE — the product demonstrating itself on the reader.
          Placed immediately after the hero because it is the fastest proof we
          have that any of the claims above are real: no signup, no input, ~2s. */}
      <Section className="!py-14">
        <div className="mx-auto max-w-2xl">
          <SectionHead eyebrow="Live" title="See it work on yourself"
            sub="You are a visitor. Here's exactly what our engine sees — scored in real time, nothing stored." />
          <div className="mt-8"><LiveScore /></div>
        </div>
      </Section>

      {/* LOGO STRIP */}
      <div className="border-b border-line bg-white"><LogoStrip /></div>

      {/* METRICS */}
      <Section className="!py-16">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRICS.map(([v, k], i) => (
            <div key={k} className="card card-hover shadow-soft reveal group px-6 py-7 text-center" style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="text-3xl font-extrabold tracking-tight text-fg transition-colors group-hover:text-brand">{v}</div>
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
          {FEATURES.map((f, i) => (
            <div key={f.title} className="feature-card card card-hover shadow-soft reveal group relative overflow-hidden p-6" style={{ transitionDelay: `${i * 60}ms` }}>
              <span className="feature-glow" aria-hidden="true" />
              <div className="relative grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-brand transition-all duration-300 group-hover:scale-110 group-hover:bg-brand group-hover:text-white group-hover:shadow-lg group-hover:shadow-brand/30">
                <f.icon width={22} />
              </div>
              <h3 className="relative mt-4 text-lg font-bold transition-colors group-hover:text-brand">{f.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-fg-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* TESTIMONIALS — renders nothing until there is a real one to show. */}
      <Testimonials />

      {/* HOW IT WORKS */}
      <Section>
        <SectionHead eyebrow="How it works" title="From first click to measured conversion"
          sub="Go live in minutes. No infrastructure to run, no data pipelines to build." />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="card card-hover shadow-soft reveal group relative p-6" style={{ transitionDelay: `${i * 60}ms` }}>
              <div className="absolute right-5 top-5 text-4xl font-black text-line transition-colors group-hover:text-brand/30">{String(i + 1).padStart(2, "0")}</div>
              <div className="text-sm font-bold text-brand">Step {i + 1}</div>
              <h3 className="mt-2 text-lg font-bold">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* REFERRALS — a reason to sign up before you need the product. */}
      <ReferralBand />

      {/* CTA */}
      <Section>
        <div className="hero-band relative overflow-hidden rounded-3xl px-8 py-16 text-center">
          <div className="binary-grid absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Find out what you're paying for.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Run the free exposure check on your site, or start a 7-day trial and watch real clicks
              get scored. No credit card either way.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to={cta.signupHref} size="lg">{cta.label("Create an account")} <IArrow width={18} /></Button>
              <Button to="/bot-check" variant="light" size="lg">Run a free check</Button>
            </div>
            {/* Internal links to the two surfaces that earn search traffic.
                Both need to be reachable from the home page to get indexed
                and to pick up any authority the home page has. */}
            <p className="mt-6 text-sm text-slate-400">
              Shopping around?{" "}
              <Link to="/compare" className="font-semibold text-white underline decoration-white/40 hover:decoration-white">
                See how we compare
              </Link>{" "}
              or{" "}
              <Link to="/blog" className="font-semibold text-white underline decoration-white/40 hover:decoration-white">
                read how the detection works
              </Link>.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}

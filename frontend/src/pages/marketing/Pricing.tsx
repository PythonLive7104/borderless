import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section, SectionHead } from "../../components/ui/Section";
import { ICheck } from "../../components/ui/icons";
import CryptoIcons from "../../components/marketing/CryptoIcons";

type Group = { label?: string; items: string[]; added?: boolean };
type Plan = {
  name: string; price: number; tag: string; cta: string;
  highlight?: boolean; ribbon?: string; warning?: string;
  campaignLimit: string; clickLimit: string;
  groups: Group[];
};

const BASE: string[] = [
  "Real-time bot & fraud scoring",
  "JS + TLS/JA3 fingerprinting",
  "Traffic rules: country, device, OS, browser",
  "IP allow / deny lists",
];
const GROWTH_ADD: string[] = [
  "A/B split testing with per-variant conversion rates",
  "Destination URL threat scanning",
  "Webhooks & full REST API",
  "Priority email support",
];
const ADVANCED: string[] = [
  "Guest access to statistics",
  "Higher rate limits",
  "Dedicated onboarding",
];

const PLANS: Plan[] = [
  {
    name: "Starter", price: 29, tag: "Detect click fraud in contextual & display ads",
    cta: "Buy this tariff", campaignLimit: "20", clickLimit: "no limit",
    groups: [{ items: BASE }],
  },
  {
    name: "Growth", price: 99, tag: "For scaling media buyers & teams",
    cta: "Buy this tariff", highlight: true, campaignLimit: "50", clickLimit: "no limit",
    groups: [{ items: BASE }, { label: "Everything in Starter, plus:", items: GROWTH_ADD, added: true }],
  },
  {
    name: "Business", price: 299, tag: "Advanced protection & API for agencies",
    cta: "Buy this tariff", ribbon: "TOP VALUE", campaignLimit: "unlimited", clickLimit: "no limit",
    groups: [
      { items: BASE },
      { label: "Everything in Growth, plus:", items: GROWTH_ADD, added: true },
      { label: "Plus advanced:", items: ADVANCED, added: true },
    ],
  },
];

const FAQ = [
  ["How do I pay?", "We accept major cryptocurrencies (BTC, ETH, USDT, USDC, TON) as well as cards. Crypto keeps billing private and borderless."],
  ["What are campaign and click limits?", "Each plan allows a number of concurrent campaigns; clicks processed through the traffic engine are unlimited on every tier."],
  ["Can I change plans later?", "Yes — upgrade or downgrade anytime. Changes are prorated to your current billing cycle."],
  ["What happens if I exceed my limit?", "You'll get usage alerts at 70%, 85% and 100%. We prompt you to upgrade rather than cut you off mid-campaign."],
];

function Cart() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.3a1 1 0 0 0 1 .8h8.5a1 1 0 0 0 1-.8L21 7H6"/></svg>);
}

function FeatureItem({ label, added }: { label: string; added?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${added ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}>
        <ICheck width={12} />
      </span>
      <span className={added ? "font-medium text-brand" : "text-fg-muted"}>{label}</span>
    </li>
  );
}

function PlusDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="grid h-7 w-7 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export default function Pricing() {
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Simple, transparent pricing</Badge>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Tariffs & payment</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Pay with crypto or card. Every plan includes real-time filtering, scoring and analytics.
          </p>
        </div>
      </section>

      <div className="border-b border-line bg-white">
        <div className="container-page py-10 text-center">
          <p className="text-sm font-semibold text-fg-muted">We accept cryptocurrency to keep your billing private</p>
          <div className="mt-5"><CryptoIcons /></div>
        </div>
      </div>

      <Section className="!pt-20">
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name}
              className={`card relative flex flex-col p-7 ${
                p.ribbon ? "overflow-hidden" : ""
              } ${p.highlight ? "ring-2 ring-brand shadow-[0_24px_60px_-24px_rgba(37,99,235,.5)]" : "shadow-soft"}`}>

              {p.ribbon && (
                <div className="pointer-events-none absolute -right-12 top-6 z-10 rotate-45 bg-warning px-14 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow">
                  {p.ribbon}
                </div>
              )}
              {p.highlight && (
                <span className="absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,.7)]">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-bold">{p.name}</h3>
              <p className="mt-1 text-sm text-fg-muted">{p.tag}</p>
              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-extrabold tracking-tight">${p.price}</span>
                <span className="pb-1 text-sm text-fg-dim">/month</span>
              </div>

              <div className="mt-6 text-xs font-bold uppercase tracking-wider text-fg-dim">Key features</div>
              <div className="mt-3">
                {p.groups.map((g, gi) => (
                  <div key={gi}>
                    {gi > 0 && <PlusDivider />}
                    {g.label && <div className="mb-3 text-xs font-semibold text-fg-muted">{g.label}</div>}
                    <ul className="space-y-3">
                      {g.items.map((f) => <FeatureItem key={f} label={f} added={g.added} />)}
                    </ul>
                  </div>
                ))}
              </div>

              {p.warning && (
                <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 px-3 py-2.5 text-xs font-medium text-red-600">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
                  {p.warning}
                </div>
              )}

              {/* limits + CTA pinned to bottom for card alignment */}
              <div className="mt-6 flex-1" />
              <div className="border-t border-line pt-5 text-sm">
                <div className="flex justify-between"><span className="text-fg-dim">Campaign limit</span><span className="font-semibold">{p.campaignLimit}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-fg-dim">Click limit</span><span className="font-semibold">{p.clickLimit}</span></div>
              </div>
              <Button to="/signup" variant={p.highlight ? "primary" : "outline"} className="mt-5 w-full"><Cart /> {p.cta}</Button>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-fg-dim">
          All plans include SSL, GDPR-friendly data controls, and CSV export. Prices in USD, payable in crypto or card.
        </p>
      </Section>

      <Section className="bg-bg-soft rounded-none">
        <SectionHead eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-line">
          {FAQ.map(([q, a]) => (
            <div key={q} className="py-6">
              <h3 className="font-bold">{q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{a}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

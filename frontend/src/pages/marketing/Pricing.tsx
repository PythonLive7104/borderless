import { useSeo } from "../../lib/seo";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section, SectionHead } from "../../components/ui/Section";
import { ICheck } from "../../components/ui/icons";
import CryptoIcons from "../../components/marketing/CryptoIcons";

type Group = { label?: string; items: string[]; added?: boolean };
type Plan = {
  name: string; price: number; tag: string; cta: string;
  highlight?: boolean; ribbon?: string; warning?: string;
  redirects: string; domains: string; access: string;
  groups: Group[];
};

const BASE: string[] = [
  "Smart redirects with bot detection on every click",
  "Full anti-bot engine included",
  "Smart shortlinks + custom domain redirects",
  "IP allow / deny rules",
  "Domain health + ownership checks",
];
const PLUS_ADD: string[] = [
  "More redirects & domains",
  "Priority support",
];
const PRO_ADD: string[] = [
  "Highest redirect & domain limits",
  "Dedicated support",
];

const PLANS: Plan[] = [
  {
    name: "Basic", price: 25, tag: "Smart redirects with bot detection, for solo buyers",
    cta: "Get Basic", redirects: "2", domains: "5", access: "7 days of access",
    groups: [{ items: BASE }],
  },
  {
    name: "Plus", price: 40, tag: "More links & domains for growing campaigns",
    cta: "Get Plus", highlight: true, redirects: "5", domains: "10", access: "7 days of access",
    groups: [{ items: BASE }, { label: "Everything in Basic, plus:", items: PLUS_ADD, added: true }],
  },
  {
    name: "Pro", price: 70, tag: "Top limits & dedicated support for agencies",
    cta: "Get Pro", ribbon: "TOP VALUE", redirects: "10", domains: "20", access: "7 days of access",
    groups: [
      { items: BASE },
      { label: "Everything in Plus, plus:", items: PRO_ADD, added: true },
    ],
  },
];

const FAQ = [
  ["How do I pay?", "We accept major cryptocurrencies (BTC, ETH, USDT, USDC, TON) as well as cards. Crypto keeps billing private and borderless."],
  ["What are redirects and domains?", "'Redirects' are the smart short links you create — each click is bot-scored and routed. 'Domains' are the websites you protect. Each tier includes a set number of both."],
  ["How does weekly billing work?", "Every plan gives 7 days of access. Renew when it runs out. Any days you have left are added on top of whatever you buy next, so renewing early or switching tier never loses you time."],
  ["Can I change plans later?", "Yes — upgrade or downgrade anytime. Your unused days carry over to the new tier."],
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
  useSeo("Pricing", "Simple weekly plans for smart redirects with real-time bot and fraud detection. Pay by card, mobile money or crypto.");
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Simple, weekly pricing</Badge>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Tariffs & payment</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            7 days of access on every plan — renew when it runs out, and unused days roll over. Pay with crypto or card.
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
                <span className="pb-1 text-sm text-fg-dim">/week</span>
              </div>
              <div className="mt-0.5 text-xs text-fg-dim">{p.access}</div>

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

              {/* limits + CTA pinned to bottom for card alignment */}
              <div className="mt-6 flex-1" />
              <div className="border-t border-line pt-5 text-sm">
                <div className="flex justify-between"><span className="text-fg-dim">Redirects</span><span className="font-semibold">{p.redirects}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-fg-dim">Domains</span><span className="font-semibold">{p.domains}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-fg-dim">Access</span><span className="font-semibold">Weekly</span></div>
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

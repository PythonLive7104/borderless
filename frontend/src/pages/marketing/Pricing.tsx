import { useEffect, useState } from "react";
import { useSeo } from "../../lib/seo";
import { trackPricingView } from "../../lib/analytics";
import { useCta } from "../../lib/useCta";
import IntervalToggle from "../../components/ui/IntervalToggle";
import type { BillingInterval } from "../../lib/api";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section, SectionHead } from "../../components/ui/Section";
import { ICheck } from "../../components/ui/icons";
import { PLAN_ADD, PLAN_BASE, PLAN_ROLLUP } from "../../data/plans";
import ComparisonTable from "../../components/marketing/ComparisonTable";
import ReferralBand from "../../components/marketing/ReferralBand";
import JsonLd from "../../components/marketing/JsonLd";
import { breadcrumbs, graph, softwareApplication } from "../../lib/schema";
import PaymentMethods from "../../components/marketing/PaymentMethods";
import { feeLine, feeNote, usePaymentMethods } from "../../lib/usePaymentMethods";

type Group = { label?: string; items: string[]; added?: boolean };
type Plan = {
  name: string; price: number; priceMonthly: number; priceYearly: number;
  tag: string; cta: string;
  // Each longer window buys a bigger allowance as well as more time.
  redirectsMonthly: string; domainsMonthly: string;
  redirectsYearly: string; domainsYearly: string;
  highlight?: boolean; ribbon?: string; warning?: string;
  redirects: string; domains: string; access: string;
  /** Paid ad clicks included per MONTH. Weekly shows a quarter and yearly
   *  twelve times, matching Plan.ad_clicks_for() on the server. */
  adClicks: number;
  groups: Group[];
};


const PLANS: Plan[] = [
  {
    name: "Basic", price: 25, priceMonthly: 69, priceYearly: 690, tag: "Smart redirects with bot detection, for solo buyers",
    cta: "Get Basic", adClicks: 10000, redirects: "2", domains: "5", redirectsMonthly: "5", domainsMonthly: "10", redirectsYearly: "10", domainsYearly: "20", access: "7 days of access",
    groups: [{ items: PLAN_BASE }],
  },
  {
    name: "Plus", price: 40, priceMonthly: 119, priceYearly: 1190, tag: "More links & domains for growing campaigns",
    cta: "Get Plus", highlight: true, adClicks: 50000, redirects: "5", domains: "10", redirectsMonthly: "10", domainsMonthly: "20", redirectsYearly: "20", domainsYearly: "40", access: "7 days of access",
    groups: [{ items: PLAN_BASE },
             { label: `${PLAN_ROLLUP.plus}, plus:`, items: PLAN_ADD.plus, added: true }],
  },
  {
    name: "Pro", price: 70, priceMonthly: 199, priceYearly: 1990, tag: "Top limits & dedicated support for agencies",
    cta: "Get Pro", ribbon: "TOP VALUE", adClicks: 150000, redirects: "10", domains: "20", redirectsMonthly: "20", domainsMonthly: "40", redirectsYearly: "40", domainsYearly: "80", access: "7 days of access",
    groups: [
      { items: PLAN_BASE },
      { label: `${PLAN_ROLLUP.pro}, plus:`, items: PLAN_ADD.pro, added: true },
    ],
  },
];

const INCLUDED = [
  "Real-time bot & fraud scoring (0-100) with the exact reasons",
  "Branded redirect links that screen every click",
  "Deep filters: connection type, ISP/ASN, device, OS, browser, language, country",
  "TLS fingerprinting (JA3 & JA4)",
  "Live IP reputation: proxy/VPN, datacenter and recent-abuse checks",
  "One-click block for datacenter & hosting traffic",
  "Silent \"checking your browser\" deep check for headless bots",
  "Human check (press-and-hold, tick-a-box or slide)",
  "Cross-surface bot memory — caught once, flagged everywhere",
  "Filtering funnel & per-campaign analytics with CSV export",
  "Server-side Shield (PHP, Django, nginx, Cloudflare, Node)",
  "Google Safe Browsing monitoring for your sites",
  "Private domains available as an add-on",
];

function faqs(fee: string): [string, string][] {
  return [
  ["How do I pay?", "Card (Visa, Mastercard, American Express) or major cryptocurrencies — BTC, ETH, USDT, USDC and TON — through our hosted checkout. Prices are in USD. Card availability is shown on this page; whatever you see there is what checkout accepts."],
  ["Are there any extra charges?", fee
    ? `The payment processor adds ${fee} on top of the plan price. The exact amount and your total are shown beside each price above, and itemised again at checkout before you pay. Nothing else: no setup fee, no overage billing, no automatic renewal.`
    : "No. The price you see is the price you pay — we cover the payment processing fee ourselves. There's no setup fee, no overage billing, and no automatic renewal."],
  ["What counts as an ad click?", "One visit that arrived from a paid ad — we read the click identifier the ad network adds to your landing URL (Google's gclid, Microsoft's msclkid and the rest), or a paid utm_medium. It's counted once per visitor session, not per page: someone who clicks your ad and then reads six pages is one ad click. Organic, direct and email traffic is still scored and shown in your dashboard, but never counted against this allowance."],
  ["What are redirects and antibot sites?", "'Redirects' are the smart short links you create — each click is bot-scored and routed. 'Antibot sites' are the websites you protect with the tracking snippet. Each tier includes a set number of both. (These are NOT private short domains — a private domain is an optional paid add-on.)"],
  ["How does weekly billing work?", "Every plan gives 7 days of access. Renew when it runs out. Any days you have left are added on top of whatever you buy next, so renewing early or switching tier never loses you time."],
  ["Can I change plans later?", "Yes — upgrade or downgrade anytime. Your unused days carry over to the new tier."],
  ];
}

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

/** What one tier costs and includes on a given interval.
 *
 *  Replaces the old `monthly` boolean. With three intervals a boolean silently
 *  made "not monthly" mean weekly, so adding yearly would have shown weekly
 *  prices under a yearly heading — the kind of bug that charges people the
 *  wrong amount rather than merely looking wrong.
 */
function forInterval(p: Plan, interval: BillingInterval) {
  if (interval === "yearly") {
    return {
      price: p.priceYearly, noun: "year", access: "365 days of access",
      redirects: p.redirectsYearly, domains: p.domainsYearly,
      adClicks: p.adClicks * 12,
      // Against twelve months bought one at a time, which is the comparison an
      // annual buyer is actually making.
      saving: p.priceMonthly * 12 - p.priceYearly, savingUnit: "yr", versus: "monthly",
    };
  }
  if (interval === "monthly") {
    return {
      price: p.priceMonthly, noun: "month", access: "30 days of access",
      redirects: p.redirectsMonthly, domains: p.domainsMonthly,
      adClicks: p.adClicks,
      saving: p.price * 4 - p.priceMonthly, savingUnit: "mo", versus: "weekly",
    };
  }
  return {
    price: p.price, noun: "week", access: p.access,
    redirects: p.redirects, domains: p.domains,
    adClicks: Math.ceil(p.adClicks / 4),
    saving: 0, savingUnit: "wk", versus: "",
  };
}

/** Badge copy per interval: the best saving any tier achieves on it.
 *  Derived rather than hand-written — the old badge said "up to 46%", a number
 *  someone would have had to remember to update on every reprice. */
function savingBadges(plans: Plan[]): Partial<Record<BillingInterval, string>> {
  const pct = (f: (p: Plan) => number) =>
    Math.floor(Math.max(...plans.map(f)) * 100);
  return {
    monthly: `Save up to ${pct((p) => 1 - p.priceMonthly / (p.price * 4))}%`,
    yearly: `Save up to ${pct((p) => 1 - p.priceYearly / (p.priceMonthly * 12))}%`,
  };
}

// Every tier on every interval, so "what does TryNoBot cost" has one answer
// with real numbers behind it rather than a range scraped out of the page.
const PRICING_JSONLD = graph(
  softwareApplication(
    PLANS.flatMap((p) => [
      { name: `${p.name} (weekly)`, price: p.price, duration: "P7D",
        description: `${p.redirects} redirects, ${p.domains} sites, ${Math.ceil(p.adClicks / 4).toLocaleString()} ad clicks` },
      { name: `${p.name} (monthly)`, price: p.priceMonthly, duration: "P1M",
        description: `${p.redirectsMonthly} redirects, ${p.domainsMonthly} sites, ${p.adClicks.toLocaleString()} ad clicks` },
      { name: `${p.name} (yearly)`, price: p.priceYearly, duration: "P1Y",
        description: `${p.redirectsYearly} redirects, ${p.domainsYearly} sites, ${(p.adClicks * 12).toLocaleString()} ad clicks` },
    ]),
  ),
  breadcrumbs([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]),
);

export default function Pricing() {
  const cta = useCta();
  useSeo("Pricing", "10,000 ad clicks and 10 sites protected from $69/month, or $690/year. Weekly, monthly or yearly — nothing auto-renews. Start free, no credit card.");
  // Highest-intent step before signup, and the audience worth remarketing to.
  useEffect(() => { trackPricingView(); }, []);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  // Any fee the buyer pays on top is disclosed next to the price rather than
  // sprung at checkout. Empty while the fee is absorbed merchant-side, which
  // is the current setting — see PAYMENT_FEE_PCT in settings.
  const payMethods = usePaymentMethods();
  const fee = feeNote(payMethods);
  return (
    <>
      <JsonLd data={PRICING_JSONLD} />
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Simple, prepaid pricing</Badge>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Tariffs & payment</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Weekly, monthly or yearly access — renew when it runs out, and unused days roll over. No auto-charge, cancel by simply not renewing.
            {fee && <> All prices are in USD, plus {fee} at checkout.</>}
          </p>
        </div>
      </section>

      <div className="border-b border-line bg-white">
        <div className="container-page py-10 text-center">
          <PaymentMethods />
        </div>
      </div>

      <Section className="!pt-20">
        <div className="mb-10 flex justify-center">
          <IntervalToggle value={interval} onChange={setInterval} savings={savingBadges(PLANS)} />
        </div>
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((p) => {
            const t = forInterval(p, interval);
            return (
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
                <span className="text-4xl font-extrabold tracking-tight">
                  ${t.price.toLocaleString()}
                </span>
                <span className="pb-1 text-sm text-fg-dim">/{t.noun}</span>
              </div>
              <div className="mt-0.5 text-xs text-fg-dim">
                {t.access}
                {t.saving > 0 && <span className="ml-1 font-semibold text-success">
                  · save ${t.saving.toLocaleString()}/{t.savingUnit} vs {t.versus}
                </span>}
              </div>
              {feeLine(payMethods, t.price) && (
                <div className="mt-1 text-xs text-fg-dim">
                  {feeLine(payMethods, t.price)}
                </div>
              )}

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
                <div className="flex justify-between">
                  <span className="text-fg-dim">Ad clicks protected</span>
                  <span className="font-semibold">{t.adClicks.toLocaleString()}</span>
                </div>
                <div className="mt-1 flex justify-between"><span className="text-fg-dim">Redirects</span><span className="font-semibold">{t.redirects}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-fg-dim">Antibot sites</span><span className="font-semibold">{t.domains}</span></div>
                <div className="mt-1 flex justify-between"><span className="text-fg-dim">Access</span><span className="font-semibold capitalize">{interval}</span></div>
              </div>
              <Button to={cta.pricingHref} variant={p.highlight ? "primary" : "outline"} className="mt-5 w-full"><Cart /> {cta.authed ? "Manage plan" : p.cta}</Button>
            </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-fg-dim">
          All plans include SSL, GDPR-friendly data controls, and CSV export. Prices in USD{fee ? `, plus ${fee} at checkout` : ""}.
        </p>
      </Section>

      <Section className="bg-bg-soft rounded-none">
        <SectionHead eyebrow="Included" title="Every plan comes with the full toolkit"
          sub="Detection, filtering and protection aren't split across tiers — you get all of it. Plans differ only by volume, retention and limits." />
        <div className="mx-auto mt-10 grid max-w-4xl gap-x-8 gap-y-3 sm:grid-cols-2">
          {INCLUDED.map((f) => (
            <div key={f} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 text-brand"><ICheck /></span>
              <span className="text-fg-muted">{f}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead eyebrow="Compare" title="How the entry plans line up"
          sub="Same job, same buyer — here is what each one includes at its cheapest paid tier." />
        <div className="mt-12"><ComparisonTable /></div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-fg-muted">
          The difference that isn't in the table: TryNoBot fingerprints TLS (JA3 and JA4) and
          shares confirmed bot fingerprints across every customer, so an attacker caught on one
          site is known on all of them. Bot farms rotate IPs — the fingerprint is what gives them
          away. You also get branded redirect links that bot-score every click before forwarding
          it — a second place to catch fraud, before it ever reaches your site.
        </p>
      </Section>

      <ReferralBand />

      <Section className="bg-bg-soft rounded-none">
        <SectionHead eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-line">
          {faqs(fee).map(([q, a]) => (
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

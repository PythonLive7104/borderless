import { useState } from "react";
import { Section, SectionHead } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";

const QA = [
  ["What is TryNoBot?", "A traffic-intelligence platform that analyzes, scores and classifies your incoming traffic in real time so you can detect fraud, protect campaigns and measure conversions."],
  ["Do you deceive ad networks or hide content from reviewers?", "No. TryNoBot is built for legitimate traffic-quality, fraud detection and analytics. We don't provide ad-reviewer deception or platform-policy evasion."],
  ["How does risk scoring work?", "Each visitor is evaluated against weighted signals (datacenter IP, proxy, automation, abnormal request rate and more), normalized to a 0–100 score, and classified as Human, Suspicious, Bot or Fraud. Every score lists its contributing signals."],
  ["How does TryNoBot detect bots that pass fingerprint checks?", "Beyond network and fingerprint signals, TryNoBot analyzes behavior: how a visitor moves the pointer, scrolls and types. Script-dispatched (synthetic) events — a hallmark of automation — are flagged, while genuine human interaction corroborates real visitors and lowers their risk score. This catches automation that looks clean on IP and user-agent alone."],
  ["Does behavioral detection block real visitors?", "No. Behavioral signals are collected passively and are never held against a first-time visitor: the initial pageview carries no interaction, so absence of it is never treated as suspicious. Observed human behavior only helps a real person clear faster; it can never be used to penalize one."],
  ["Do all customers benefit from bots caught on other sites?", "Yes. TryNoBot runs a shared threat corpus: an IP or fingerprint (JA3/JA4/browser) confirmed bad on any site becomes known across the network. Bot farms rotate IP addresses but reuse the same fingerprint, so the network recognizes them the moment they reappear elsewhere. The more traffic the network sees, the stronger every customer's protection gets."],
  ["Could the shared corpus flag a legitimate visitor?", "No — that's designed out. A fingerprint is never flagged from a single sighting, because real users share fingerprints. It is only treated as automation after it has appeared across multiple distinct, independently-confirmed bad IP addresses — a pattern legitimate visitors never produce. The threshold is the safeguard, and it can never be lowered to one."],
  ["Can I tell which clicks were ad-platform review bots?", "Yes. TryNoBot verifies ad-network review crawlers — Google Ads, AdSense and Bing Ads — by reverse DNS, then labels and counts them separately from real human clicks. Advertisers get click-quality numbers that reflect actual people, not the platform's own automated landing-page checks."],
  ["Do you show ad reviewers a different page to avoid disapproval?", "Never. A verified review bot is shown exactly the same page a real visitor sees — showing it anything different is cloaking, which gets ads disapproved and domains flagged. We identify reviewers only to report them transparently, never to deceive the ad network."],
  ["How do I install tracking?", "Add a website in your dashboard, copy the async script tag, and paste it before </head>. Installation is auto-detected once the first event arrives."],
  ["What data do you collect?", "Only the traffic signals needed to score visits. Sensitive fields can be masked in the UI, retention is configurable, and data deletion is supported."],
  ["Can I use the API and webhooks?", "Yes. Create API keys, call the REST endpoints, and subscribe to signed webhooks for events like traffic.classified and conversion.created."],
  ["Is there a free trial?", "Every plan includes a 7-day free trial with no credit card required."],
];

// FAQPage structured data. Rendered into the markup (not injected via effect)
// so it is present in the prerendered HTML, where search engines and AI answer
// engines actually read it — a client-only script would be missed by most.
const FAQ_JSONLD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: QA.map(([q, a]) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
});

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: FAQ_JSONLD }} />
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">FAQ</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Frequently asked questions</h1>
        </div>
      </section>
      <Section>
        <div className="mx-auto max-w-3xl space-y-3">
          {QA.map(([q, a], i) => (
            <div key={q} className="card shadow-soft overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                <span className="font-bold">{q}</span>
                <span className={`shrink-0 text-brand transition ${open === i ? "rotate-45" : ""}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              </button>
              {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-fg-muted">{a}</p>}
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

import { useState } from "react";
import { Section, SectionHead } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";

const QA = [
  ["What is TrackAudit?", "A traffic-intelligence platform that analyzes, scores and classifies your incoming traffic in real time so you can detect fraud, protect campaigns and measure conversions."],
  ["Do you deceive ad networks or hide content from reviewers?", "No. TrackAudit is built for legitimate traffic-quality, fraud detection and analytics. We don't provide ad-reviewer deception or platform-policy evasion."],
  ["How does risk scoring work?", "Each visitor is evaluated against weighted signals (datacenter IP, proxy, automation, abnormal request rate and more), normalized to a 0–100 score, and classified as Human, Suspicious, Bot or Fraud. Every score lists its contributing signals."],
  ["How do I install tracking?", "Add a website in your dashboard, copy the async script tag, and paste it before </head>. Installation is auto-detected once the first event arrives."],
  ["What data do you collect?", "Only the traffic signals needed to score visits. Sensitive fields can be masked in the UI, retention is configurable, and data deletion is supported."],
  ["Can I use the API and webhooks?", "Yes. Create API keys, call the REST endpoints, and subscribe to signed webhooks for events like traffic.classified and conversion.created."],
  ["Is there a free trial?", "Every plan includes a 7-day free trial with no credit card required."],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <>
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

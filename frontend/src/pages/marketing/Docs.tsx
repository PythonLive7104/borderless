import { Section, SectionHead } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
import { Link } from "react-router-dom";
const GROUPS = [
  ["Getting started", ["Create your workspace", "Add a website", "Install the tracking script", "Verify installation"]],
  ["Tracking", ["JavaScript SDK reference", "Pageview & custom events", "Conversion events", "Server-side ingestion"]],
  ["Traffic engine", ["How risk scoring works", "Signals reference", "Classifications", "Traffic rules"]],
  ["Developers", ["Authentication & API keys", "REST API reference", "Webhooks & signatures", "Rate limits"]],
];
export default function Docs() {
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Documentation</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Everything you need to integrate</h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">Guides for installing tracking, understanding scores, and building on the API.</p>
        </div>
      </section>
      <Section>
        <div className="grid gap-5 sm:grid-cols-2">
          {GROUPS.map(([title, items]) => (
            <div key={title as string} className="card shadow-soft p-6">
              <h3 className="text-lg font-bold">{title as string}</h3>
              <ul className="mt-3 space-y-2">
                {(items as string[]).map((i) => (
                  <li key={i}><Link to="/docs" className="text-sm text-fg-muted hover:text-brand">{i}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

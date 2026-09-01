import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Section, SectionHead } from "../../components/ui/Section";
import { IArrow } from "../../components/ui/icons";

const ENDPOINTS = [
  ["POST", "/api/v1/conversions", "Record a conversion with revenue"],
  ["GET", "/api/v1/visitors", "List analyzed visitors"],
  ["GET", "/api/v1/traffic", "Query classified traffic events"],
  ["GET", "/api/v1/campaigns", "List campaigns"],
  ["POST", "/api/v1/traffic-rules", "Create a traffic rule"],
  ["GET", "/api/v1/reports", "Pull analytics reports"],
];

const SAMPLE = `POST /api/v1/conversions
Authorization: Bearer tq_live_••••••••

{
  "visitor_id": "visitor_123",
  "campaign_id": "campaign_123",
  "event": "purchase",
  "revenue": 49.99,
  "currency": "USD"
}`;

export default function ApiPage() {
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Developer API</Badge>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            A clean REST API for traffic & conversions
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Manage everything programmatically. Authenticate with API keys, receive signed webhooks.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button to="/signup" size="lg">Get API key <IArrow width={18} /></Button>
            <Button to="/docs" variant="light" size="lg">Read the docs</Button>
          </div>
        </div>
      </section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <SectionHead center={false} eyebrow="Quickstart" title="Track a conversion in one call"
              sub="Every request is authenticated with a secret API key. Keys are shown once and stored hashed." />
            <div className="mt-6 overflow-hidden rounded-2xl border border-navy-800 bg-navy-900 shadow-soft">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400/70" />
                <span className="h-3 w-3 rounded-full bg-amber-400/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
                <span className="ml-3 text-xs text-slate-400">conversions.sh</span>
              </div>
              <pre className="overflow-x-auto p-5 text-[13px] leading-relaxed text-slate-200"><code>{SAMPLE}</code></pre>
            </div>
          </div>
          <div>
            <SectionHead center={false} eyebrow="Endpoints" title="MVP surface" sub="A focused set of endpoints to cover the full lifecycle." />
            <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white shadow-soft">
              {ENDPOINTS.map(([m, p, d]) => (
                <div key={p} className="flex items-center gap-3 px-4 py-3">
                  <span className={`w-14 shrink-0 rounded-md px-2 py-1 text-center text-[11px] font-bold ${m === "GET" ? "bg-emerald-50 text-emerald-700" : "bg-brand/10 text-brand"}`}>{m}</span>
                  <code className="text-sm font-semibold text-fg">{p}</code>
                  <span className="ml-auto hidden text-xs text-fg-dim sm:block">{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
const SYSTEMS = [
  ["Traffic engine (Go)", "Operational"],
  ["Ingestion API", "Operational"],
  ["Dashboard & API (Django)", "Operational"],
  ["Webhooks delivery", "Operational"],
  ["Analytics pipeline", "Operational"],
];
export default function Status() {
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">System status</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">All systems operational</h1>
        </div>
      </section>
      <Section>
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-success" /> 99.98% uptime over the last 90 days
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white shadow-soft">
            {SYSTEMS.map(([name, state]) => (
              <div key={name} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold">{name}</span>
                <span className="inline-flex items-center gap-2 text-sm text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-success" /> {state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

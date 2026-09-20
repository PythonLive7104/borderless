import { useEffect, useState } from "react";
import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
import { statusApi, type SystemStatus } from "../../lib/api";
import { useSeo } from "../../lib/seo";

// Every state the page can be in, including the two where we genuinely don't
// know. A status page that renders green while it's failing to reach the
// backend is worse than one that admits it.
const TONE = {
  operational: { dot: "bg-success", text: "text-emerald-700", label: "Operational" },
  degraded: { dot: "bg-warning", text: "text-amber-700", label: "Degraded" },
  down: { dot: "bg-danger", text: "text-danger", label: "Down" },
  unknown: { dot: "bg-fg-muted", text: "text-fg-muted", label: "Unknown" },
} as const;

const HEADLINE = {
  operational: "All systems operational",
  degraded: "Some systems degraded",
  down: "Major outage",
  unknown: "Status unavailable",
};

// Shown before the first response lands, and if it never does.
const PENDING: { name: string; state: SystemStatus["components"][number]["state"] }[] = [
  { name: "Traffic engine (Go)", state: "operational" },
  { name: "Ingestion API", state: "operational" },
  { name: "Dashboard & API (Django)", state: "operational" },
  { name: "Analytics pipeline", state: "operational" },
];

export default function Status() {
  useSeo("Status", "Live TryNoBot system status.");
  const [data, setData] = useState<SystemStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () =>
      statusApi.get()
        .then((d) => { if (live) { setData(d); setFailed(false); } })
        .catch(() => { if (live) setFailed(true); });
    load();
    const t = setInterval(load, 30_000);
    return () => { live = false; clearInterval(t); };
  }, []);

  const overall = failed ? "unknown" : data?.overall ?? "unknown";
  const tone = TONE[overall];

  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">System status</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            {HEADLINE[overall]}
          </h1>
        </div>
      </section>
      <Section>
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-bg-mute px-4 py-3 text-sm text-fg-muted">
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            {failed
              ? "We couldn't reach the status service — this page may be out of date."
              : "Checked live, every 30 seconds."}
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white shadow-soft">
            {(data?.components ?? PENDING).map((c) => {
              const t = TONE[failed || !data ? "unknown" : c.state] ?? TONE.unknown;
              return (
                <div key={c.name} className="flex items-center justify-between px-5 py-4">
                  <span className="text-sm font-semibold">{c.name}</span>
                  <span className={`inline-flex items-center gap-2 text-sm ${t.text}`}>
                    <span className={`h-2 w-2 rounded-full ${t.dot}`} /> {t.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    </>
  );
}

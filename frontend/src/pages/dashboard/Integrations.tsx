import { Link } from "react-router-dom";
import PageNote from "../../components/dashboard/PageNote";

const CARDS = [
  { title: "JavaScript Tracker", desc: "The snippet you paste into your website to start collecting traffic.", to: "/dashboard/websites", cta: "Manage websites", status: "Set up per website" },
  { title: "REST API", desc: "Create API keys to record conversions and read data from your own systems.", to: "/dashboard/api", cta: "Manage API keys", status: "Key-based" },
  { title: "Webhooks", desc: "Get real-time notifications when bots are caught or sales happen.", to: "/dashboard/webhooks", cta: "Manage webhooks", status: "Signed & retried" },
];

export default function Integrations() {
  return (
    <div>
      <PageNote id="integrations">
        Integrations are the ways TrackAudit connects to your website and your other tools. Most people start with the <b>JavaScript Tracker</b>; developers can also use the <b>REST API</b> and <b>Webhooks</b>.
      </PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Integrations</h1>
      <p className="mt-1 text-sm text-fg-muted">Connect TrackAudit to your site and systems.</p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.title} className="card card-hover shadow-soft flex flex-col p-6">
            <h3 className="text-lg font-bold">{c.title}</h3>
            <p className="mt-2 flex-1 text-sm text-fg-muted">{c.desc}</p>
            <span className="mt-3 inline-block w-fit rounded-full bg-bg-mute px-2.5 py-1 text-xs font-semibold text-fg-muted">{c.status}</span>
            <Link to={c.to} className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-600">{c.cta} →</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

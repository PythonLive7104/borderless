import { useEffect, useState } from "react";
import PageNote from "../../components/dashboard/PageNote";
import { Link, useParams } from "react-router-dom";
import { websiteApi, type Website } from "../../lib/api";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";

// Turn the absence of a warning into an actual answer: clean / flagged / not
// yet checked, rather than leaving silence to be read as "fine".
function SafeBrowsing({ site, onChecked }: { site: Website; onChecked: () => void }) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState("");

  async function check() {
    setChecking(true); setNote("");
    try {
      const r = await websiteApi.checkSafeBrowsing(site.id);
      setNote(r.message);
      onChecked();
    } catch {
      setNote("Couldn't run the check just now — try again shortly.");
    } finally { setChecking(false); }
  }

  const when = site.safe_browsing_checked_at
    ? new Date(site.safe_browsing_checked_at).toLocaleString()
    : null;

  const checkBtn = (
    <button type="button" onClick={check} disabled={checking}
      className="mt-1 block text-xs font-semibold text-brand hover:underline disabled:opacity-60">
      {checking ? "Checking…" : "Check now"}
    </button>
  );

  if (site.safe_browsing_flagged) {
    const threats = (site.safe_browsing_threats || [])
      .map((t) => t.replace(/_/g, " ").toLowerCase()).join(", ");
    return (
      <span className="inline-block max-w-[16rem]">
        <span className="font-semibold text-red-600">⚠ Flagged by Google</span>
        {threats && <span className="block text-xs text-fg-muted">{threats}</span>}
        <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer"
          className="mt-0.5 block text-xs text-brand underline">Request a review →</a>
        {checkBtn}
        {note && <span className="block text-xs text-fg-muted">{note}</span>}
      </span>
    );
  }
  if (!when) {
    return (
      <span className="inline-block">
        <span className="text-fg-muted">Not checked yet</span>
        {checkBtn}
        {note && <span className="block text-xs text-fg-muted">{note}</span>}
      </span>
    );
  }
  return (
    <span className="inline-block">
      <span className="font-semibold text-emerald-700">✓ Clean</span>
      <span className="block text-xs text-fg-muted">checked {when}</span>
      {checkBtn}
      {note && <span className="block text-xs text-fg-muted">{note}</span>}
    </span>
  );
}

export default function WebsiteDetail() {
  const { id } = useParams();
  const [site, setSite] = useState<Website | null>(null);
  const [copied, setCopied] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function load() { setSite(await websiteApi.get(Number(id))); }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function copy() {
    if (!site) return;
    navigator.clipboard?.writeText(site.snippet);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  async function verify() {
    setVerifying(true); setVerifyMsg(null);
    try {
      const r = await websiteApi.verify(Number(id));
      setVerifyMsg({ ok: r.installed, text: r.message });
      load();
    } finally { setVerifying(false); }
  }

  if (!site) return <div className="grid place-items-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>;

  return (
    <div>
      <PageNote id="website-detail">Copy the snippet below and paste it into your website (just before the <code className="rounded bg-white px-1">&lt;/head&gt;</code> tag), then click <b>Verify installation</b>. Not sure how? Send this page to whoever manages your site.</PageNote>
      <Link to="/dashboard/websites" className="text-sm text-fg-muted hover:text-brand">← Websites</Link>
      <div className="mt-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{site.name}</h1>
          <p className="text-sm text-fg-muted">{site.domain}</p>
        </div>
        <StatusBadge status={site.live_state} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        {/* install */}
        <div className="card shadow-soft p-6 lg:col-span-2">
          <h2 className="text-lg font-bold">Install tracking</h2>
          <p className="mt-1 text-sm text-fg-muted">Paste this snippet before the closing <code>&lt;/head&gt;</code> tag on every page.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-navy-800 bg-navy-900">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
              <span className="text-xs text-slate-400">tracking snippet</span>
              <button onClick={copy} className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20">
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-200"><code>{site.snippet}</code></pre>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={verify}>{verifying ? "Checking…" : "Verify installation"}</Button>
            {verifyMsg && (
              <span className={`text-sm ${verifyMsg.ok ? "text-emerald-700" : "text-amber-700"}`}>{verifyMsg.text}</span>
            )}
          </div>
        </div>

        {/* details */}
        <div className="card shadow-soft p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">Details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-fg-muted">Tracking ID</dt><dd><code className="rounded bg-bg-mute px-1.5 py-0.5">{site.tracking_id}</code></dd></div>
            <div className="flex justify-between"><dt className="text-fg-muted">Status</dt><dd><StatusBadge status={site.live_state} /></dd></div>
            <div className="flex justify-between"><dt className="text-fg-muted">Last event</dt><dd>{site.last_event_at ? new Date(site.last_event_at).toLocaleString() : "—"}</dd></div>
            <div className="flex justify-between"><dt className="text-fg-muted">Created</dt><dd>{new Date(site.created_at).toLocaleDateString()}</dd></div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-fg-muted">Google Safe Browsing</dt>
              <dd className="text-right"><SafeBrowsing site={site} onChecked={load} /></dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Step 2: nudge new sites to set up protection so bad traffic doesn't just flood in. */}
      <div className="card shadow-soft mt-5 flex flex-wrap items-center justify-between gap-3 border-brand/30 bg-brand/5 p-5">
        <div>
          <h2 className="font-bold">Next: protect this traffic</h2>
          <p className="mt-1 max-w-xl text-sm text-fg-muted">Detection alone won't turn bad visitors away. Set up Traffic Rules to redirect fraud &amp; bots and flag suspicious visitors — one click applies our recommended protection.</p>
        </div>
        <Button to="/dashboard/traffic-rules">Set up protection →</Button>
      </div>
    </div>
  );
}

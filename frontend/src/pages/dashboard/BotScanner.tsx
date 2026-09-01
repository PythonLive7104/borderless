import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { botCheckApi, websiteApi, type BotCheckResult, type Website } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import PageNote from "../../components/dashboard/PageNote";
import Button from "../../components/ui/Button";

const gradeTone: Record<string, string> = {
  A: "bg-emerald-500", B: "bg-emerald-500", C: "bg-amber-500", D: "bg-orange-500", F: "bg-red-500",
};
const findTone: Record<string, { ring: string; icon: string }> = {
  good: { ring: "text-emerald-600", icon: "M20 6L9 17l-5-5" },
  warn: { ring: "text-amber-600", icon: "M12 9v4m0 4h.01" },
  bad: { ring: "text-red-600", icon: "M18 6L6 18M6 6l12 12" },
};

export default function BotScanner() {
  const { current } = useWorkspace();
  const [sites, setSites] = useState<Website[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BotCheckResult | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!current) return;
    websiteApi.list(current.id).then((r) => setSites(r.results)).catch(() => {});
  }, [current?.id]);

  async function scan(target?: string) {
    const t = (target ?? url).trim();
    if (!t) return;
    setUrl(t); setBusy(true); setErr(""); setRes(null);
    try {
      const r = await botCheckApi.run(t);
      if (!r.ok) setErr(r.error || "Something went wrong.");
      else setRes(r);
    } catch (e: any) {
      setErr(e?.data?.error || "That check couldn't be completed. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageNote id="bot-scanner">Paste any website (or pick one of yours) to see how exposed it is to bots — HTTPS, firewall, bot protection, security headers and more. It reads only public information, so you can scan sites you don't own too.</PageNote>
      <h1 className="text-2xl font-extrabold tracking-tight">Bot exposure scanner</h1>
      <p className="mt-1 text-sm text-fg-muted">Check how well a site is protected against automated traffic.</p>

      <form onSubmit={(e) => { e.preventDefault(); scan(); }} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourwebsite.com"
          className="flex-1 rounded-full border border-line bg-white px-5 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        <Button type="submit" disabled={busy}>{busy ? "Scanning…" : "Scan site"}</Button>
      </form>

      {sites.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-fg-dim">Your sites:</span>
          {sites.map((s) => (
            <button key={s.id} onClick={() => scan(s.domain)}
              className="rounded-full border border-line bg-white px-3 py-1 text-xs text-fg-muted hover:border-brand/40 hover:text-brand">
              {s.domain}
            </button>
          ))}
        </div>
      )}

      {err && <p className="mt-4 rounded-lg bg-danger/5 px-4 py-2 text-sm text-red-600">{err}</p>}

      {res?.ok && (
        <div className="mt-6 max-w-2xl">
          <div className="card shadow-soft overflow-hidden">
            <div className="flex flex-wrap items-center gap-5 border-b border-line p-6">
              <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl text-4xl font-black text-white ${gradeTone[res.grade!]}`}>{res.grade}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-fg-muted">Scanned <span className="font-mono text-fg">{res.url}</span></div>
                <div className="mt-1 text-lg font-bold">{res.summary}</div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-fg-dim"><span>Bot exposure</span><span>{res.exposure}%</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-bg-mute">
                    <div className={`h-full rounded-full ${gradeTone[res.grade!]}`} style={{ width: `${res.exposure}%` }} />
                  </div>
                </div>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {res.findings!.map((f, i) => {
                const t = findTone[f.status];
                return (
                  <li key={i} className="flex gap-3 p-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={`mt-0.5 shrink-0 ${t.ring}`}><path d={t.icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
                    <div>
                      <div className="text-sm font-semibold">{f.label}</div>
                      <div className="text-sm text-fg-muted">{f.detail}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="mt-4 rounded-xl bg-bg-soft p-4 text-sm text-fg-muted">
            Want Borderless to actually filter this traffic? <Link to="/dashboard/websites" className="font-semibold text-brand hover:underline">Add the site & install the tracker →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

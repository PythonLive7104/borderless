import { useSeo } from "../../lib/seo";
import { useState } from "react";
import { botCheckApi, type BotCheckResult } from "../../lib/api";
import Button from "../../components/ui/Button";

const gradeTone: Record<string, string> = {
  A: "bg-emerald-500", B: "bg-emerald-500", C: "bg-amber-500", D: "bg-orange-500", F: "bg-red-500",
};
const findTone: Record<string, { ring: string; icon: string }> = {
  good: { ring: "text-emerald-600", icon: "M20 6L9 17l-5-5" },
  warn: { ring: "text-amber-600", icon: "M12 9v4m0 4h.01" },
  bad: { ring: "text-red-600", icon: "M18 6L6 18M6 6l12 12" },
};

export default function BotCheck() {
  useSeo("Free bot exposure check", "Scan any website in 10 seconds and see how exposed it is to bots — free, no signup.");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BotCheckResult | null>(null);
  const [err, setErr] = useState("");

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setErr(""); setRes(null);
    try {
      const r = await botCheckApi.run(url.trim());
      if (!r.ok) setErr(r.error || "Something went wrong.");
      else setRes(r);
    } catch (e: any) {
      setErr(e?.data?.error || "That check couldn't be completed. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="container-page py-14">
      <div className="mx-auto max-w-2xl text-center">
        <span className="inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand">Free bot exposure check</span>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">How many <span className="text-brand">bots</span> can reach your site?</h1>
        <p className="mx-auto mt-4 max-w-xl text-fg-muted">Run a free 10-second scan and see how exposed your site is to automated traffic — and how to close the gaps. We only read what's publicly visible; no signup needed.</p>

        <form onSubmit={scan} className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="yourwebsite.com"
            className="flex-1 rounded-full border border-line bg-white px-5 py-3.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <Button type="submit" size="lg" disabled={busy}>{busy ? "Scanning…" : "Scan my site"}</Button>
        </form>
        {err && <p className="mt-4 rounded-lg bg-danger/5 px-4 py-2 text-sm text-red-600">{err}</p>}
      </div>

      {res?.ok && (
        <div className="mx-auto mt-12 max-w-2xl">
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

          <div className="mt-6 rounded-2xl bg-navy-900 p-7 text-center text-white">
            <h3 className="text-xl font-bold">Close these gaps with TrackAudit</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/70">TrackAudit scores every visitor in real time, blocks bots and fraud, and shows you exactly what's hitting your site — free to start.</p>
            <div className="mt-5 flex justify-center gap-2">
              <Button to="/signup" size="lg">Start free</Button>
              <Button to="/pricing" variant="light" size="lg">View pricing</Button>
            </div>
          </div>
        </div>
      )}

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-fg-dim">This check reads only publicly available information (response headers, homepage HTML and robots.txt). It does not log in, probe private endpoints, or store your site's content.</p>
    </div>
  );
}

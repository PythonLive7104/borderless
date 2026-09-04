import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { http, errText } from "../../lib/api";

const REASONS = [
  ["phishing", "Phishing / fake login page"],
  ["malware", "Malware or harmful download"],
  ["spam", "Spam (unsolicited email or SMS)"],
  ["scam", "Scam or fraud"],
  ["other", "Something else"],
] as const;

type Result = { id: number; matched: boolean; disabled: boolean };

export default function ReportAbuse() {
  const [params] = useSearchParams();
  const [url, setUrl] = useState("");
  const [reason, setReason] = useState<string>("phishing");
  const [details, setDetails] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  // Bot pages link here as /report?url=<the link they landed on>, so the
  // reporter doesn't have to copy anything by hand.
  useEffect(() => {
    const u = params.get("url");
    if (u) setUrl(u);
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setResult(await http.post<Result>("/v1/abuse/", { url, reason, details, email }, false));
    } catch (err: any) {
      setError(errText(err?.data, "We couldn't file that report. Please email us instead."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Abuse</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Report a redirect link
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Received a link from us that looks like phishing, malware or spam? Tell us here.
            We re-check the destination the moment you submit, disable it straight away if
            the threat is confirmed, and put everything else in front of a human.
          </p>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-xl">
          {result ? (
            <div className="card shadow-soft p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h3 className="mt-4 text-lg font-bold">
                {result.disabled ? "Link disabled" : "Report received"}
              </h3>
              <p className="mt-2 text-sm text-fg-muted">
                {result.disabled
                  ? "We've confirmed the problem and the link no longer redirects anyone."
                  : result.matched
                    ? "Our automated scan couldn't confirm a threat, so a person is reviewing it now."
                    : "We couldn't match that to one of our links, but we've logged it for review."}
              </p>
              <p className="mt-4 text-xs text-fg-muted">Reference #{result.id}</p>
            </div>
          ) : (
            <form className="card shadow-soft space-y-4 p-7" onSubmit={submit}>
              <div>
                <label className="mb-1.5 block text-sm font-semibold">The link you received</label>
                <input
                  required value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://trynb.cc/aB3xK9"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <p className="mt-1.5 text-xs text-fg-muted">
                  Paste the whole link. Don't visit it again to check.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">What's wrong with it?</label>
                <select
                  value={reason} onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Anything else? <span className="font-normal text-fg-muted">(optional)</span>
                </label>
                <textarea
                  rows={4} value={details} onChange={(e) => setDetails(e.target.value)}
                  placeholder="Where you received it, what brand it impersonates, what the page asked for…"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold">
                  Your email <span className="font-normal text-fg-muted">(optional)</span>
                </label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                <p className="mt-1.5 text-xs text-fg-muted">
                  Leave it and we'll tell you what we did about this report.
                </p>
              </div>

              {error && <p className="text-sm font-medium text-danger">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Checking the link…" : "Report this link"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-fg-muted">
            Security teams and researchers: reports sent here are actioned automatically and
            reach our abuse team directly.
          </p>
        </div>
      </Section>
    </>
  );
}

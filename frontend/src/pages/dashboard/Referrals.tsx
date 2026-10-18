import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { referralApi, type CreditEntryRow, type ReferralSummary } from "../../lib/api";
import PageNote from "../../components/dashboard/PageNote";
import Button from "../../components/ui/Button";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function Referrals() {
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [ledger, setLedger] = useState<CreditEntryRow[]>([]);
  const [showLedger, setShowLedger] = useState(false);
  const [copied, setCopied] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    referralApi.me()
      .then((d) => { if (live) setData(d); })
      .catch(() => { if (live) setErr("Couldn't load your referrals."); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!showLedger || ledger.length) return;
    referralApi.ledger().then(setLedger).catch(() => { /* non-critical */ });
  }, [showLedger, ledger.length]);

  if (err) return <div className="card shadow-soft p-6 text-sm text-red-600">{err}</div>;
  if (!data) return <div className="card shadow-soft p-6 text-sm text-fg-muted">Loading…</div>;

  const link = `${window.location.origin}/?ref=${data.code}`;
  const reward = usd(data.reward_cents);

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 1800);
    } catch { /* clipboard blocked — the value is on screen to select by hand */ }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Refer a friend</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Earn {reward} every time someone you referred pays — not just the first time.
      </p>

      <PageNote id="referrals">
        Share your link. When someone signs up through it and pays for a plan, you get
        <b> {reward} in credit</b>. Every renewal they pay earns you {reward} again. Once your
        balance covers a plan, you can use it to buy or renew without paying anything.
      </PageNote>

      {/* balance + link */}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="card shadow-soft p-6">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Credit balance</div>
          <div className="mt-2 text-4xl font-extrabold tracking-tight text-brand">
            {usd(data.balance_cents)}
          </div>
          <div className="mt-1 text-xs text-fg-dim">
            {usd(data.earned_cents)} earned in total
          </div>
          {data.balance_cents > 0 && (
            <Link to="/dashboard/billing"
              className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
              Use it on a plan →
            </Link>
          )}
        </div>

        <div className="card shadow-soft p-6 lg:col-span-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Your referral link</div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-line bg-bg-soft px-3 py-2 font-mono text-xs outline-none" />
            <Button onClick={() => copy(link, "link")} className="shrink-0">
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <span>Or share your code:</span>
            <button onClick={() => copy(data.code, "code")}
              className="rounded-lg border border-line bg-bg-soft px-3 py-1 font-mono font-bold tracking-widest text-fg hover:border-brand/40">
              {data.code}
            </button>
            {copied === "code" && <span className="text-xs text-success">Copied</span>}
          </div>
        </div>
      </div>

      {/* counts */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Signed up</div>
          <div className="mt-1 text-2xl font-extrabold">{data.referred_count}</div>
        </div>
        <div className="card shadow-soft p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Paying</div>
          <div className="mt-1 text-2xl font-extrabold">{data.paying_count}</div>
          <div className="mt-0.5 text-xs text-fg-dim">You only earn once they pay</div>
        </div>
      </div>

      {/* who */}
      <div className="card shadow-soft mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-bg-soft text-left text-xs uppercase tracking-wide text-fg-dim">
            <tr>
              <th className="px-4 py-3">Friend</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.referrals.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-fg-muted">
                Nobody yet. Share your link above.
              </td></tr>
            )}
            {data.referrals.map((r, i) => (
              <tr key={i} className="hover:bg-bg-soft">
                <td className="px-4 py-3 font-mono text-xs">{r.masked_email}</td>
                <td className="px-4 py-3 text-fg-muted">{new Date(r.joined_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {r.has_paid
                    ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">Paying</span>
                    : <span className="rounded-full bg-bg-mute px-2 py-0.5 text-xs font-semibold text-fg-dim">Signed up</span>}
                </td>
                <td className="px-4 py-3 font-semibold">{r.rewards}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ledger — a balance nobody can account for is a support ticket */}
      <button onClick={() => setShowLedger(!showLedger)}
        className="mt-5 text-sm font-semibold text-brand hover:underline">
        {showLedger ? "Hide" : "Show"} credit history
      </button>
      {showLedger && (
        <div className="card shadow-soft mt-3 divide-y divide-line">
          {ledger.length === 0 && (
            <div className="p-5 text-sm text-fg-muted">No movements yet.</div>
          )}
          {ledger.map((e, i) => (
            <div key={i} className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <div className="font-semibold capitalize">{e.kind}</div>
                {e.note && <div className="truncate text-xs text-fg-muted">{e.note}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className={`font-bold ${e.amount_cents >= 0 ? "text-emerald-700" : "text-fg"}`}>
                  {e.amount_cents >= 0 ? "+" : "−"}{usd(Math.abs(e.amount_cents))}
                </span>
                <span className="text-xs text-fg-dim">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

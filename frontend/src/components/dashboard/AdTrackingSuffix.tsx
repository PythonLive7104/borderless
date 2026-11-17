import { useState } from "react";

/* The one-off setup that lets us tell Google which campaign a bad click came
 * from.
 *
 * Background, because the instruction looks arbitrary otherwise: a Google Ads
 * IP exclusion attaches to a single campaign, addressed by Google's own numeric
 * id. We never see that id — `utm_campaign` is a name the advertiser typed, and
 * the gclid can only be resolved to a campaign by asking Google, which costs an
 * API round trip per click.
 *
 * ValueTrack costs nothing. Google substitutes the real values into the URL on
 * every click, so the id arrives in the landing URL our tracker already sends.
 * Paste once, applies to the whole account, no API, no extra tags.
 */
const SUFFIX = "tnb_cid={campaignid}&tnb_gid={gclid}";

export default function AdTrackingSuffix() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SUFFIX);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (insecure context, permissions): the field is
         selectable, so they can still copy it by hand. Saying nothing beats a
         scary error for something that is not broken. */
    }
  }

  return (
    <section className="card shadow-soft mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Google Ads campaign tracking</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            Optional, and it takes a minute. Paste this into your Google Ads account
            so we can tell you which campaign each suspicious click came from —
            and, later, exclude the worst addresses from that campaign directly.
          </p>
        </div>
        <span className="rounded-full bg-bg-mute px-2.5 py-1 text-xs font-semibold text-fg-muted">
          One-time setup
        </span>
      </div>

      <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-fg-dim"
        htmlFor="tnb-suffix">
        Final URL suffix
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <input id="tnb-suffix" readOnly value={SUFFIX}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-line bg-bg-mute px-3 py-2 font-mono text-sm" />
        <button onClick={copy}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <ol className="mt-5 space-y-1.5 text-sm text-fg-muted">
        <li><b className="text-fg">1.</b> In Google Ads, open <b>Settings → Account settings</b>.</li>
        <li><b className="text-fg">2.</b> Expand <b>Tracking</b> and find <b>Final URL suffix</b>.</li>
        <li><b className="text-fg">3.</b> Paste the text above and save.</li>
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-fg-dim">
        Setting it at account level covers every campaign at once. If you already use
        a final URL suffix, add <code className="rounded bg-bg-mute px-1">&amp;</code> and
        then this text rather than replacing what is there. It adds two parameters to
        your landing page URLs and changes nothing about how your ads run or how they
        are charged.
      </p>
    </section>
  );
}

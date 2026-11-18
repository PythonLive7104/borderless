import { useEffect, useState } from "react";
import { googleAdsApi, type GoogleAdsStatus } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";

/* Connect a Google Ads account so blocked IPs can be excluded from campaigns.
 *
 * Why it exists: blocking a visitor at the website doesn't stop the advertiser
 * being charged for the click — only writing the address into the ad account as
 * a campaign exclusion does. This is the consent step that lets us do that.
 *
 * The whole card hides itself when the integration isn't configured on the
 * server (status.enabled === false), so nothing half-wired is ever shown. The
 * callback returns the user here with ?google_ads=<result>, which we surface as
 * a toast and then clean out of the URL.
 */
export default function GoogleAdsConnect({ orgId, canManage }: { orgId: number; canManage: boolean }) {
  const { confirm, notify } = useDialog();
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setStatus(await googleAdsApi.status(orgId)); } catch { /* ignore */ }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  // Surface the OAuth outcome the callback redirected back with, once.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const result = p.get("google_ads");
    if (!result) return;
    const msg: Record<string, [string, "success" | "danger"]> = {
      connected: ["Google Ads connected.", "success"],
      denied: ["Google Ads connection was cancelled.", "danger"],
      no_refresh: ["Google didn't return a refresh token — try again and allow offline access.", "danger"],
      exchange_failed: ["Couldn't complete the connection with Google. Please try again.", "danger"],
      forbidden: ["Only Owners and Admins can connect Google Ads.", "danger"],
      invalid: ["That connection link was invalid or expired. Please try again.", "danger"],
    };
    const m = msg[result];
    if (m) notify(m[0], m[1]);
    p.delete("google_ads");
    const qs = p.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    load();
    /* eslint-disable-next-line */
  }, []);

  if (!status || !status.enabled) return null;   // feature off → show nothing

  async function connect() {
    setBusy(true);
    try {
      const { authorize_url } = await googleAdsApi.connectUrl(orgId);
      window.location.href = authorize_url;        // hand off to Google's consent screen
    } catch (e: any) {
      notify(e?.data?.detail || "Couldn't start the connection.", "danger");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!(await confirm({ title: "Disconnect Google Ads?", tone: "danger", confirmLabel: "Disconnect" }))) return;
    setBusy(true);
    try { await googleAdsApi.disconnect(orgId); await load(); }
    catch (e: any) { notify(e?.data?.detail || "Couldn't disconnect.", "danger"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card shadow-soft mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Google Ads</h2>
          <p className="mt-1 max-w-2xl text-sm text-fg-muted">
            Connect your Google Ads account so the worst offending IP addresses can be
            excluded from your campaigns — stopping you paying for those clicks at the
            source, not just blocking them at your site.
          </p>
        </div>
        {status.connected
          ? <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">✓ Connected</span>
          : <span className="rounded-full bg-bg-mute px-2.5 py-1 text-xs font-semibold text-fg-muted">Not connected</span>}
      </div>

      {status.connected ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-fg-muted">
            {status.customer_id ? <>Account <span className="font-mono">{status.customer_id}</span></> : "Account connected"}
          </span>
          <button onClick={disconnect} disabled={busy} className="text-sm text-red-500 hover:underline">Disconnect</button>
          {!status.live_push && (
            <span className="rounded-full bg-warning/10 px-2.5 py-1 text-xs font-semibold text-amber-700">
              Preview mode — exclusions are shown, not yet pushed
            </span>
          )}
        </div>
      ) : canManage ? (
        <button onClick={connect} disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
          {busy ? "Opening Google…" : "Connect Google Ads"}
        </button>
      ) : (
        <p className="mt-4 text-sm text-fg-dim">Only Owners and Admins can connect Google Ads.</p>
      )}
    </div>
  );
}

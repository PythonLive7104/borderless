import { useEffect, useState } from "react";
import { telegramApi, type TelegramStatus } from "../../lib/api";
import Button from "../ui/Button";
import { useDialog } from "../../context/DialogContext";

/* Connecting is a one-time code, not a password: the dashboard mints a link
   that expires in 15 minutes and can only be spent once, so a copied link
   can't be used later to attach someone else's Telegram to this workspace. */
export default function TelegramConnect({ orgId }: { orgId: number }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [deepLink, setDeepLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const { confirm, notify } = useDialog();

  async function load() {
    try { setStatus(await telegramApi.status(orgId)); }
    catch { setStatus(null); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  async function generate() {
    setBusy(true); setErr("");
    try {
      const r = await telegramApi.connect(orgId);
      setDeepLink(r.deep_link);
      if (!r.deep_link) setErr("The bot's username isn't configured yet, so a link can't be built.");
    } catch (e: any) {
      setErr(e?.data?.detail || "Could not create a connect link.");
    } finally { setBusy(false); }
  }

  async function disconnect() {
    if (!(await confirm({
      title: "Disconnect Telegram?",
      message: "The bot will stop responding in that chat. You can reconnect any time.",
      confirmLabel: "Disconnect",
    }))) return;
    await telegramApi.disconnect(orgId);
    setDeepLink("");
    notify("Telegram disconnected.");
    load();
  }

  // Nothing configured server-side — don't advertise a feature that can't work.
  if (!status || !status.enabled) return null;

  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-1">
          <div className="text-sm font-semibold">Telegram bot</div>
          <div className="mt-0.5 text-xs text-fg-muted">
            Create redirects and check your traffic from a chat, with the same plan limits as here.
          </div>
        </div>

        <div className="sm:col-span-2">
          {status.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                Connected{status.username ? ` · @${status.username}` : ""}
              </span>
              <button onClick={disconnect} className="text-xs font-semibold text-red-500 hover:underline">
                Disconnect
              </button>
            </div>
          ) : deepLink ? (
            <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
              <p className="text-sm font-semibold">Open this link to finish connecting</p>
              <a href={deepLink} target="_blank" rel="noreferrer"
                 className="mt-2 block break-all font-mono text-sm text-brand hover:underline">
                {deepLink}
              </a>
              <p className="mt-2 text-xs text-fg-muted">
                It works once and expires in 15 minutes. Come back and refresh this page after tapping Start.
              </p>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(deepLink); notify("Link copied."); }}>
                  Copy link
                </Button>
                <Button variant="outline" onClick={load}>I've connected</Button>
              </div>
            </div>
          ) : (
            <Button onClick={generate} disabled={busy}>
              {busy ? "Creating…" : "Connect Telegram"}
            </Button>
          )}
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        </div>
      </div>
    </div>
  );
}

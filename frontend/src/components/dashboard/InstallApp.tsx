import { useEffect, useState } from "react";
import { canInstall, isIOS, isStandalone, onInstallable, promptInstall } from "../../lib/pwa";

const DISMISSED = "tnb_install_dismissed";

/** "Add TryNoBot to your home screen."
 *
 *  Shown in the dashboard rather than on the marketing site: someone who has
 *  signed in has a reason to come back, which is the only reason to install
 *  anything. Dismissed once, it stays dismissed.
 *
 *  Two paths, because the platforms differ. Chrome and Edge hand us an install
 *  event and we can do it in one tap. iOS has no such event — installing is a
 *  manual Share-sheet step — so there it has to be instructions, and offering a
 *  button that cannot work would be worse than saying nothing.
 */
export default function InstallApp() {
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(true);
  const ios = isIOS();

  useEffect(() => {
    if (isStandalone()) return;              // already installed
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch { /* private mode: treat as not dismissed */ }
    setHidden(false);
    return onInstallable(setReady);
  }, []);

  if (hidden) return null;
  // On everything except iOS, wait for the browser to say it is installable.
  // Showing it earlier produces a button that does nothing when tapped.
  if (!ios && !ready && !canInstall()) return null;

  function dismiss() {
    setHidden(true);
    try { localStorage.setItem(DISMISSED, "1"); } catch { /* nothing to do */ }
  }

  async function install() {
    const accepted = await promptInstall();
    if (accepted) setHidden(true);
  }

  return (
    <div className="card shadow-soft mt-6 flex flex-wrap items-center gap-4 border-brand/30 p-4">
      <img src="/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
      <div className="min-w-0 flex-1 basis-56">
        <div className="text-sm font-bold">Keep TryNoBot on your home screen</div>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
          {ios ? (
            <>
              Tap <b>Share</b> at the bottom of Safari, then <b>Add to Home Screen</b>.
              It opens full screen, without the address bar.
            </>
          ) : (
            <>
              Opens full screen from an icon, like an app — same account, nothing to download.
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!ios && (
          <button onClick={install}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600">
            Install
          </button>
        )}
        <button onClick={dismiss} className="text-xs font-semibold text-fg-dim hover:text-fg">
          Not now
        </button>
      </div>
    </div>
  );
}

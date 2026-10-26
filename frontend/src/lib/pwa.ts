/** Installability: service worker registration and the install prompt.
 *
 *  The dashboard is the same React build whether it is opened in a tab or from
 *  a home-screen icon. All this adds is the ability to install it — no second
 *  codebase, no app store, no developer account.
 */

/** The event Chrome fires when a site becomes installable. Not in lib.dom. */
export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<(ready: boolean) => void>();

function announce() {
  for (const fn of listeners) fn(deferred !== null);
}

/** Subscribe to "the browser will let us show an install prompt". */
export function onInstallable(fn: (ready: boolean) => void): () => void {
  listeners.add(fn);
  fn(deferred !== null);
  return () => { listeners.delete(fn); };
}

export function canInstall(): boolean {
  return deferred !== null;
}

/** Show the browser's own install dialog. Returns whether they accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  // Single-use: the browser refuses a second prompt() on the same event, and
  // keeping a spent one around leaves a button that silently does nothing.
  deferred = null;
  announce();
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

/** Already running from the home screen rather than in a tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
      // Safari's own flag, which predates the standard and is still the only
      // way to tell on an iPhone.
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** iOS has no beforeinstallprompt — installing is a manual Share-sheet step,
 *  so the UI has to tell people where to look instead of offering a button. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
      // iPadOS reports itself as a Mac; the touch points give it away.
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function initPWA(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("beforeinstallprompt", (e) => {
    // Stop Chrome's own mini-infobar so the prompt appears where we choose,
    // at a moment that makes sense rather than on first paint.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    announce();
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    announce();
  });

  if (!("serviceWorker" in navigator)) return;

  // Production only. A service worker in front of the Vite dev server caches
  // modules that are meant to be hot-swapped, and the resulting "why is my
  // change not showing" is a bad hour for whoever hits it.
  // Same shape the rest of the codebase uses: this tsconfig has no
  // vite/client types, so import.meta.env is reached through a cast.
  if (!(import.meta as any).env?.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Unsupported, blocked by policy, or private browsing. The site works
      // exactly as it always did — installability is the only thing lost.
    });
  });
}

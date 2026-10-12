/**
 * Loads TryNoBot's own tracker on trynobot.com — we should be running the thing
 * we sell, and the live score panel needs the fingerprint and behaviour signals
 * it collects.
 *
 * Inert unless VITE_SELF_SITE_ID is set, so dev and any fork stay clean.
 *
 * Loaded WITHOUT data-strict on purpose. Strict mode hides the page until the
 * verdict arrives; on a marketing site a blank screen, even briefly, costs more
 * visitors than it could ever save. We want observation here, not enforcement.
 */
const SITE_ID = ((import.meta as any).env?.VITE_SELF_SITE_ID as string | undefined) || "";

export function initSelfTracker() {
  if (typeof document === "undefined") return; // SSR/prerender
  if (!SITE_ID) return;
  if (document.querySelector("script[data-site-id]")) return; // already on

  const s = document.createElement("script");
  s.async = true;
  s.src = `${window.location.origin}/bl.js`;
  s.setAttribute("data-site-id", SITE_ID);
  document.head.appendChild(s);
}

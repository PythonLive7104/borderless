/** Light / dark theme.
 *
 *  Dark is the default, set as `data-theme="dark"` on <html> in index.html so
 *  the pre-rendered HTML paints dark on the first byte. The inline script in
 *  that file flips to light before paint when the visitor has chosen it. This
 *  module is only for reading and changing that choice at runtime — it never
 *  needs to apply the default, which is already in the markup.
 *
 *  The preference is deliberately NOT behind cookie consent: it is a display
 *  setting the visitor asked for, stores nothing identifying, and is never read
 *  by anything but the stylesheet.
 */
export type Theme = "light" | "dark";

export const THEME_KEY = "tnb_theme";
export const DEFAULT_THEME: Theme = "dark";

/** What is actually applied right now, read from the DOM rather than storage —
 *  the attribute is the source of truth, because the boot script may have set
 *  it from a value storage no longer has. */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

/** The visitor's stored choice, or null if they have never expressed one. */
export function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // private mode / blocked storage — the default still applies
  }
}

/** Apply a theme and remember it. */
export function setTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
  // Keep the browser chrome (mobile address bar, PWA splash) in step, or the
  // page looks correct while the surround still shows the other theme.
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0a0f1d" : "#ffffff");
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

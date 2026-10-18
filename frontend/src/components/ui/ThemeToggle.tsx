import { useEffect, useState } from "react";
import { currentTheme, toggleTheme, type Theme } from "../../lib/theme";

/** Light / dark switch.
 *
 *  The icon is resolved in an effect rather than during render on purpose.
 *  Marketing pages are pre-rendered on the server, where there is no document
 *  and therefore no theme to read — rendering the icon from `currentTheme()`
 *  directly would bake one guess into the static HTML and mismatch on hydration
 *  for everyone on the other theme. Rendering a stable placeholder first and
 *  correcting after mount keeps the server and client markup identical.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => { setThemeState(currentTheme()); }, []);

  const label = theme === "light" ? "Switch to dark theme" : "Switch to light theme";

  return (
    <button
      type="button"
      onClick={() => setThemeState(toggleTheme())}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 place-items-center rounded-full text-fg-muted transition hover:bg-bg-mute hover:text-fg ${className}`}
    >
      {/* Before mount the theme is unknown, so neither icon is correct. The
          moon is the default theme's icon and matches what the markup ships. */}
      {theme === "light" ? (
        // Sun — currently light, click for dark
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Moon — currently dark, click for light
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

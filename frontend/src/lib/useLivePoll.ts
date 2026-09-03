import { useEffect, useRef } from "react";

// Keeps a page's data fresh without a manual refresh: runs `load(false)` on mount
// and on dependency change (may show a spinner), then `load(true)` on an interval
// and whenever the tab regains focus — a silent refresh that updates data in place.
// Pass the same deps you'd give a load useEffect.
export function useLivePoll(load: (silent: boolean) => void, deps: any[], intervalMs = 15000) {
  const saved = useRef(load);
  saved.current = load;
  useEffect(() => {
    saved.current(false);
    const iv = setInterval(() => saved.current(true), intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") saved.current(true); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

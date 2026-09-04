import { useRef, useEffect } from "react";
function useLivePoll(load, deps, intervalMs = 15e3) {
  const saved = useRef(load);
  saved.current = load;
  useEffect(() => {
    saved.current(false);
    const iv = setInterval(() => saved.current(true), intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") saved.current(true);
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(iv);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, deps);
}
export {
  useLivePoll as u
};

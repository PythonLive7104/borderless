import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { linkApi, websiteApi } from "../../lib/api";
import { IGlobe, ILink } from "../ui/icons";

/* First-run fork. New users kept asking support "which of these do I need
   before my link works?" — the answer is one of two paths, and neither needs
   the other. Ask once, up front, and send them straight down one.

   It disappears on its own once the workspace has a website or a redirect, so
   it never nags an established account; dismissing is just for people who
   want it gone before then. */

const dismissKey = (orgId: number) => `bl_getstarted_${orgId}`;

export default function GetStarted({ orgId }: { orgId: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    let dismissed = false;
    try { dismissed = localStorage.getItem(dismissKey(orgId)) === "1"; } catch { /* private mode */ }
    if (dismissed) return;

    // Only for a workspace that has neither path set up yet.
    Promise.all([websiteApi.list(orgId), linkApi.list(orgId)])
      .then(([w, l]) => { if (alive) setShow(w.results.length === 0 && l.results.length === 0); })
      .catch(() => { /* never let this block the dashboard */ });
    return () => { alive = false; };
  }, [orgId]);

  if (!show) return null;

  function dismiss() {
    try { localStorage.setItem(dismissKey(orgId), "1"); } catch { /* ignore */ }
    setShow(false);
  }

  return (
    <div className="card shadow-soft mb-6 border-brand/30 bg-brand/5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">What do you want to protect?</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Pick one to get started — you don't need both, and neither depends on the other.
          </p>
        </div>
        <button onClick={dismiss} className="rounded-lg p-1.5 text-fg-dim hover:bg-bg-mute" aria-label="Dismiss">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Link to="/dashboard/websites" onClick={dismiss}
          className="group rounded-2xl border border-line bg-white p-5 transition hover:border-brand/50 hover:shadow-soft">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><IGlobe width={20} /></span>
          <h3 className="mt-3 text-sm font-bold group-hover:text-brand">A website I own</h3>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Filter bots out of your own site or landing page. Add the site, set your Traffic Rules,
            then install the Shield for hard server-side blocking.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-brand">Add a website →</span>
        </Link>

        <Link to="/dashboard/links" onClick={dismiss}
          className="group rounded-2xl border border-line bg-white p-5 transition hover:border-brand/50 hover:shadow-soft">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><ILink width={20} /></span>
          <h3 className="mt-3 text-sm font-bold group-hover:text-brand">A link I share</h3>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            Put a short link in front of your ads or campaigns. Bot filtering works immediately —
            nothing to install, and you don't need to add a website first.
          </p>
          <span className="mt-3 inline-block text-xs font-semibold text-brand">Create a redirect →</span>
        </Link>
      </div>
    </div>
  );
}

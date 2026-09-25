import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { notifyApi } from "../../lib/api";

/** Nav bell with an unread count. Polls a lightweight count endpoint and links
 *  to Settings → Notify API, where the feed and mark-read live. Refreshes when
 *  the tab regains focus so a badge doesn't sit stale after you've been away. */
export default function NotifyBell() {
  const { current } = useWorkspace();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!current) { setUnread(0); return; }
    let live = true;
    const poll = () => notifyApi.unreadCount(current.id)
      .then((r) => { if (live) setUnread(r.unread); })
      .catch(() => { /* a failed poll just leaves the last count */ });
    poll();
    timer.current = window.setInterval(poll, 30_000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => { live = false; clearInterval(timer.current); window.removeEventListener("focus", onFocus); };
  }, [current?.id]);

  if (!current) return null;
  const shown = unread > 99 ? "99+" : String(unread);

  return (
    <button
      onClick={() => nav("/dashboard/settings?tab=notify")}
      title={unread ? `${unread} unread notification${unread === 1 ? "" : "s"}` : "Notifications"}
      className="relative rounded-lg p-2 text-fg-muted hover:bg-bg-mute hover:text-fg">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.7 21a2 2 0 0 1-3.4 0" />
      </svg>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-[18px] text-white">
          {shown}
        </span>
      )}
    </button>
  );
}

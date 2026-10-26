import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../../context/WorkspaceContext";
import { notifyApi, type NotifyItem } from "../../lib/api";

/** Nav bell with an unread count and the notices behind it.
 *
 *  It used to navigate to Settings → Notify API instead of opening anything.
 *  Two problems with that. A bell that moves you to a settings page abandons
 *  whatever you were doing to read a one-line notice — and, worse, if you were
 *  already ON Settings the route didn't change enough to remount the page, so
 *  the tab never switched and clicking the bell did visibly nothing at all.
 *  That is the bug people reported: a red "1" that leads nowhere.
 *
 *  Now the notices open in place. Settings keeps the full history, paging and
 *  channel management; this is for reading the thing and getting back to work.
 */
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export default function NotifyBell() {
  const { current } = useWorkspace();
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifyItem[] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const box = useRef<HTMLDivElement | null>(null);

  const poll = useCallback(() => {
    if (!current) return;
    notifyApi.unreadCount(current.id)
      .then((r) => setUnread(r.unread))
      .catch(() => { /* a failed poll just leaves the last count */ });
  }, [current?.id]);

  useEffect(() => {
    if (!current) { setUnread(0); return; }
    poll();
    timer.current = window.setInterval(poll, 30_000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer.current); window.removeEventListener("focus", onFocus); };
  }, [current?.id, poll]);

  // Close on an outside click or Escape — a panel you can't dismiss without
  // finding the same small button again is its own annoyance.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Loaded when the panel opens, not on every poll: the count endpoint is
  // cheap and runs every 30s, the feed is not and runs when someone looks.
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || !current) return;
    try {
      const r = await notifyApi.feed(current.id, 1);
      setItems(r.results.slice(0, 8));
      setUnread(r.unread);
    } catch {
      setItems([]);
    }
  }

  async function markAllRead() {
    if (!current) return;
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    setUnread(0);
    try { await notifyApi.markRead(current.id); } catch { poll(); }
  }

  if (!current) return null;
  const shown = unread > 99 ? "99+" : String(unread);

  return (
    <div className="relative" ref={box}>
      <button
        onClick={toggle}
        aria-haspopup="true"
        aria-expanded={open}
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

      {open && (
        // Anchored right and width-capped to the viewport, so it can't push the
        // page sideways on a phone the way a fixed-width panel would.
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-card shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[22rem] overflow-y-auto">
            {items === null && (
              <div className="px-4 py-6 text-center text-sm text-fg-muted">Loading…</div>
            )}
            {items?.length === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="text-sm font-semibold">Nothing yet</div>
                <p className="mx-auto mt-1 max-w-[16rem] text-xs leading-relaxed text-fg-muted">
                  We'll tell you here when something needs you — a redirect switched
                  off, or a safety scan flagging one of your links.
                </p>
              </div>
            )}
            {items?.map((n) => (
              <div key={n.id}
                className={`border-b border-line px-4 py-3 last:border-0 ${n.read ? "" : "bg-brand/5"}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-bold leading-snug">{n.title || n.channel_name}</span>
                  <span className="shrink-0 text-[10px] text-fg-dim">{ago(n.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-fg-muted">
                  {n.message}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={() => { setOpen(false); nav("/dashboard/settings?tab=notify"); }}
            className="block w-full border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-brand hover:bg-bg-soft">
            See all notifications
          </button>
        </div>
      )}
    </div>
  );
}

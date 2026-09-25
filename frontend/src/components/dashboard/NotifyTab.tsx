import { useEffect, useState } from "react";
import {
  notifyApi, type NotifyChannel, type NotifyFeed, type NotifyItem, type NotifyQuota,
} from "../../lib/api";
import Button from "../../components/ui/Button";

const input = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function QuotaBadge({ q }: { q: NotifyQuota }) {
  if (q.unlimited) return <span className="text-xs font-semibold text-emerald-700">Unlimited</span>;
  const label = q.mode === "daily"
    ? `${q.used.toLocaleString()} / ${q.limit.toLocaleString()} today`
    : `${q.used} / ${q.limit} credits used`;
  const low = q.remaining !== null && q.remaining <= Math.max(1, Math.floor(q.limit * 0.1));
  return <span className={`text-xs font-semibold ${low ? "text-amber-700" : "text-fg-muted"}`}>{label}</span>;
}

/** A newly created channel: the key is shown once, here, then never again. */
function NewKeyCard({ ch, onDone }: { ch: NotifyChannel & { key: string }; onDone: () => void }) {
  const url = notifyApi.publishUrl(ch.key);
  const [copied, setCopied] = useState("");
  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 1500);
  };
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
      <div className="text-sm font-bold">Save your publish URL now</div>
      <p className="mt-1 text-xs text-fg-muted">
        This is shown once. Paste it into your form, survey or any tool that can POST a webhook —
        anything sent to it lands in the feed below. Anyone with this URL can post to it, so keep it private.
      </p>
      <label className="mt-3 block text-xs font-semibold text-fg-dim">Publish URL</label>
      <div className="mt-1 flex gap-2">
        <input readOnly value={url} className={`${input} font-mono text-xs`} onFocus={(e) => e.target.select()} />
        <Button variant="outline" onClick={() => copy(url, "url")}>{copied === "url" ? "Copied" : "Copy"}</Button>
      </div>
      <div className="mt-3 rounded-lg bg-navy-900/90 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
        <div className="text-slate-400"># send a notification</div>
        curl -d "New lead from your form" {url}
      </div>
      <button onClick={onDone} className="mt-3 text-xs font-semibold text-brand hover:underline">
        I've saved it — done
      </button>
    </div>
  );
}

export default function NotifyTab({ orgId }: { orgId: number }) {
  const [channels, setChannels] = useState<NotifyChannel[]>([]);
  const [feed, setFeed] = useState<NotifyFeed | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<(NotifyChannel & { key: string }) | null>(null);
  const [err, setErr] = useState("");
  const [page, setPage] = useState(1);

  async function load(p = page) {
    const [chs, fd] = await Promise.all([notifyApi.channels(orgId), notifyApi.feed(orgId, p)]);
    setChannels(chs); setFeed(fd); setPage(fd.page);
  }
  useEffect(() => { load(1).catch(() => setErr("Couldn't load your channels.")); /* eslint-disable-next-line */ }, [orgId]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setErr("");
    try {
      const ch = await notifyApi.createChannel(orgId, name.trim());
      setFresh(ch); setName(""); await load();
    } catch (e: any) {
      setErr(e?.data?.detail || e?.message || "Couldn't create the channel.");
    } finally { setCreating(false); }
  }

  async function toggle(ch: NotifyChannel) {
    await notifyApi.setActive(ch.id, !ch.active); load(page);
  }
  async function remove(ch: NotifyChannel) {
    if (!confirm(`Delete "${ch.name}"? Its publish URL stops working and its history is removed.`)) return;
    await notifyApi.deleteChannel(ch.id); load(1);
  }
  async function markAllRead() {
    await notifyApi.markRead(orgId); load(page);
  }
  async function removeNote(id: number) {
    await notifyApi.deleteNote(id);
    // If we just emptied the page (and it isn't the first), step back one.
    load(feed && feed.results.length === 1 && page > 1 ? page - 1 : page);
  }

  return (
    <div className="space-y-6">
      <div className="card shadow-soft p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Notification channels</h3>
          {feed && <QuotaBadge q={feed.quota} />}
        </div>
        <p className="mt-1 text-sm text-fg-muted">
          Create a channel to get a private publish URL. Drop it into a campaign form, a survey,
          or any webhook, and every POST or PUT shows up in your feed below.
        </p>

        {err && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{err}</p>}

        {/* The one-time key card sits ABOVE the form, not in place of it, so it's
            always obvious you can create another channel. */}
        {fresh && <div className="mt-4"><NewKeyCard ch={fresh} onDone={() => setFresh(null)} /></div>}

        <form onSubmit={create} className="mt-4 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Contact form leads, Survey replies…" className={input} maxLength={120} />
          <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create channel"}</Button>
        </form>
        <p className="mt-2 text-xs text-fg-dim">Create as many channels as you like — one per form, survey or source you want to track separately.</p>

        {channels.length > 0 && (
          <div className="mt-5 divide-y divide-line rounded-xl border border-line">
            {channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="truncate">{ch.name}</span>
                    {!ch.active && <span className="rounded-full bg-fg/10 px-2 py-0.5 text-[10px] font-bold uppercase text-fg-dim">Paused</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-fg-dim">
                    {ch.prefix}…{ch.last_used ? ` · last used ${new Date(ch.last_used).toLocaleDateString()}` : " · never used"}
                  </div>
                </div>
                <div className="flex shrink-0 gap-3 text-xs font-semibold">
                  <button onClick={() => toggle(ch)} className="text-fg-muted hover:text-fg">
                    {ch.active ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(ch)} className="text-danger hover:underline">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card shadow-soft p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Recent notifications{feed && feed.unread > 0 ? ` · ${feed.unread} new` : ""}</h3>
          {feed && feed.unread > 0 && (
            <button onClick={markAllRead} className="text-xs font-semibold text-brand hover:underline">Mark all read</button>
          )}
        </div>
        {!feed || feed.results.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">Nothing yet. Once something posts to a channel, it'll appear here.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {feed.results.map((n: NotifyItem) => (
              <li key={n.id} className={`rounded-xl border px-4 py-3 ${n.read ? "border-line" : "border-brand/30 bg-brand/5"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{n.title}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-fg-dim">{new Date(n.created_at).toLocaleString()}</span>
                    <button onClick={() => removeNote(n.id)} title="Delete"
                      className="grid h-6 w-6 place-items-center rounded-md text-fg-dim hover:bg-danger/10 hover:text-danger">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
                <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-fg-muted">{n.message}</div>
                <div className="mt-1 text-[11px] text-fg-dim">{n.channel_name}</div>
              </li>
            ))}
          </ul>
        )}

        {feed && (feed.has_prev || feed.has_next) && (
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-fg-dim">
              Showing {(feed.page - 1) * feed.page_size + 1}–{Math.min(feed.page * feed.page_size, feed.total)} of {feed.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button disabled={!feed.has_prev} onClick={() => load(feed.page - 1)}
                className="rounded-lg border border-line px-3 py-1.5 font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-40 hover:border-brand/40 hover:text-brand">Previous</button>
              <button disabled={!feed.has_next} onClick={() => load(feed.page + 1)}
                className="rounded-lg border border-line px-3 py-1.5 font-semibold text-fg disabled:cursor-not-allowed disabled:opacity-40 hover:border-brand/40 hover:text-brand">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

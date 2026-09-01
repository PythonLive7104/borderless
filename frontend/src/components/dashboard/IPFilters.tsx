import { useEffect, useState } from "react";
import { ipFilterApi, type IPListEntry, type IPKind } from "../../lib/api";
import Button from "../ui/Button";

export default function IPFilters({ orgId, canManage }: { orgId: number; canManage: boolean }) {
  const [entries, setEntries] = useState<IPListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<IPKind>("deny");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    setLoading(true);
    try { setEntries((await ipFilterApi.list(orgId)).results); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  async function add(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    if (!value.trim()) { setErr("Enter an IP address or CIDR range."); return; }
    setBusy(true);
    try {
      await ipFilterApi.create({ organization: orgId, value: value.trim(), kind, note: note.trim() });
      setValue(""); setNote(""); await load();
    } catch (e: any) {
      setErr(e.data?.value?.[0] || e.data?.detail || "Could not add the entry.");
    } finally { setBusy(false); }
  }
  async function del(entry: IPListEntry) {
    if (!confirm(`Remove ${entry.value}?`)) return;
    await ipFilterApi.remove(entry.id); await load();
  }
  async function toggle(entry: IPListEntry) {
    await ipFilterApi.update(entry.id, { active: !entry.active }); await load();
  }

  const deny = entries.filter((e) => e.kind === "deny");
  const allow = entries.filter((e) => e.kind === "allow");

  return (
    <div className="mt-6 space-y-6">
      <p className="text-sm text-fg-muted">
        Block or always-allow specific IPs and ranges. Enforced instantly on every request:
        a <b>blocked</b> IP is stopped outright, an <b>allowed</b> IP always passes (it beats every
        other rule). Accepts an exact IP (<code className="rounded bg-bg-mute px-1">1.2.3.4</code>)
        or a CIDR range (<code className="rounded bg-bg-mute px-1">10.0.0.0/8</code>).
      </p>

      {canManage && (
        <form onSubmit={add} className="card shadow-soft flex flex-wrap items-end gap-3 p-4">
          <label className="min-w-[180px] flex-1">
            <span className="mb-1 block text-xs font-semibold text-fg-dim">IP or CIDR</span>
            <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="1.2.3.4 or 10.0.0.0/8"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-fg-dim">List</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as IPKind)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand">
              <option value="deny">Block (blacklist)</option>
              <option value="allow">Allow (whitelist)</option>
            </select>
          </label>
          <label className="min-w-[160px] flex-1">
            <span className="mb-1 block text-xs font-semibold text-fg-dim">Note (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="why?"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand" />
          </label>
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</Button>
          {err && <p className="w-full text-sm text-red-600">{err}</p>}
        </form>
      )}

      {loading ? (
        <div className="grid place-items-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {([["deny", "Blocked IPs", deny], ["allow", "Allowed IPs", allow]] as const).map(([k, title, list]) => (
            <div key={k} className="card shadow-soft p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <span className={`inline-block h-2 w-2 rounded-full ${k === "deny" ? "bg-red-500" : "bg-emerald-500"}`} />
                {title} <span className="text-fg-dim">({list.length})</span>
              </h3>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-fg-muted">Nothing here yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {list.map((e) => (
                    <li key={e.id} className={`flex items-center justify-between py-2.5 ${!e.active ? "opacity-50" : ""}`}>
                      <div>
                        <div className="font-mono text-sm">{e.value}</div>
                        {e.note && <div className="text-xs text-fg-dim">{e.note}</div>}
                      </div>
                      {canManage && (
                        <div className="flex items-center gap-3">
                          <button onClick={() => toggle(e)} className="text-xs text-fg-muted hover:text-brand">
                            {e.active ? "Pause" : "Resume"}
                          </button>
                          <button onClick={() => del(e)} className="text-xs text-red-600 hover:underline">Remove</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

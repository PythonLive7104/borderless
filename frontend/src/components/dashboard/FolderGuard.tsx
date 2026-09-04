import { useEffect, useState } from "react";
import { ruleApi, type TrafficRule } from "../../lib/api";
import Button from "../ui/Button";
import { useDialog } from "../../context/DialogContext";

// Folder Guard is a friendly wrapper over path-based block rules: each guarded
// path is a rule "IF path contains X THEN block", enforced by the Shield.
export default function FolderGuard({ orgId, canManage }: { orgId: number; canManage: boolean }) {
  const { confirm } = useDialog();
  const [rules, setRules] = useState<TrafficRule[]>([]);
  const [path, setPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const all = (await ruleApi.list(orgId)).results;
    setRules(all.filter((r) => r.conditions.length === 1 && r.conditions[0].field === "path"));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    let p = path.trim();
    if (!p) return;
    if (!p.startsWith("/")) p = "/" + p;
    setBusy(true); setErr("");
    try {
      await ruleApi.create({
        organization: orgId, name: `Guard ${p}`, priority: 5, action: "block",
        redirect_url: "", tag: "",
        conditions: [{ field: "path", operator: "contains", value: p }],
      });
      setPath(""); load();
    } catch (e: any) { setErr(e.data?.detail || e.message); } finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!(await confirm({
      title: "Stop guarding this path?",
      message: "Requests to it will no longer be screened by the bot engine.",
      confirmLabel: "Stop guarding",
    }))) return;
    await ruleApi.remove(id); load();
  }

  return (
    <div className="card shadow-soft mt-6 p-6">
      <h2 className="text-lg font-bold">Folder Guard</h2>
      <p className="mt-1 max-w-2xl text-sm text-fg-muted">
        Lock down specific pages or folders — like <code className="rounded bg-bg-mute px-1">/admin</code>,{" "}
        <code className="rounded bg-bg-mute px-1">/wp-login</code> or <code className="rounded bg-bg-mute px-1">/downloads</code> —
        so bots and fraud can't reach them. Guarded paths are blocked by the Shield <b>before the page loads</b>,
        so they need the Shield snippet installed (below).
      </p>

      {canManage && (
        <form onSubmit={add} className="mt-4 flex flex-wrap gap-2">
          <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/admin"
            className="w-56 rounded-xl border border-line bg-white px-4 py-2 text-sm outline-none focus:border-brand" />
          <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Guard this path"}</Button>
        </form>
      )}
      {err && <div className="mt-2 rounded-lg bg-danger/5 px-3 py-2 text-sm text-red-600">{err}</div>}

      <div className="mt-4 space-y-2">
        {rules.length === 0 ? (
          <p className="text-sm text-fg-dim">No guarded paths yet. Add one above (e.g. <code className="rounded bg-bg-mute px-1">/admin</code>).</p>
        ) : rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-xl border border-line bg-bg-soft px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-md bg-danger/10 px-2 py-0.5 text-xs font-semibold text-red-600">Blocked</span>
              <code className="font-mono">{r.conditions[0]?.value}</code>
              {!r.active && <span className="text-xs text-fg-dim">(paused)</span>}
            </div>
            {canManage && <button onClick={() => remove(r.id)} className="text-sm text-red-500 hover:underline">Remove</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

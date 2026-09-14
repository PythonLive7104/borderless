import { useEffect, useState } from "react";
import { linkApi, type CustomDomain } from "../../lib/api";
import { useDialog } from "../../context/DialogContext";
import Button from "../ui/Button";

/**
 * Bring-your-own-domain: a customer points their own domain at us and serves
 * redirects on it. Kept deliberately step-by-step because the DNS part trips up
 * non-technical users — add, copy two records, verify.
 */
export default function CustomDomainPanel({ orgId, canManage, onChanged }: {
  orgId: number; canManage: boolean; onChanged: () => void;
}) {
  const { confirm, notify } = useDialog();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    try { setDomains((await linkApi.customDomains(orgId)).domains); } catch { /* ignore */ }
  }
  useEffect(() => { if (canManage) load(); /* eslint-disable-next-line */ }, [orgId, canManage]);

  async function add() {
    setErr(""); setBusy(true);
    try {
      await linkApi.addCustomDomain(orgId, host.trim());
      setHost(""); load();
    } catch (e: any) { setErr(e?.data?.detail || "Could not add that domain."); }
    finally { setBusy(false); }
  }

  async function verify(d: CustomDomain) {
    setBusy(true);
    try {
      const r = await linkApi.verifyCustomDomain(d.id);
      notify(r.message, r.verified ? "success" : "danger");
      load(); onChanged();
    } catch (e: any) { notify(e?.data?.message || e?.data?.detail || "Verification failed.", "danger"); }
    finally { setBusy(false); }
  }

  async function remove(d: CustomDomain) {
    if (!(await confirm({ title: `Remove ${d.host}?`, tone: "danger", confirmLabel: "Remove" }))) return;
    try { await linkApi.removeCustomDomain(d.id); load(); onChanged(); }
    catch (e: any) { notify(e?.data?.detail || "Could not remove it.", "danger"); }
  }

  if (!canManage) return null;

  return (
    <div className="card shadow-soft mt-5 p-5">
      <div className="text-sm font-bold">Use your own domain</div>
      <p className="mt-1 text-sm text-fg-muted">
        Prefer your own brand? Point a domain you own (like <span className="font-mono">go.yourbrand.com</span>)
        at us and run redirects on it. Its reputation is entirely yours — free, no monthly rental.
      </p>

      {domains.length > 0 && (
        <div className="mt-3 space-y-3">
          {domains.map((d) => (
            <div key={d.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{d.host}</span>
                  {d.verified
                    ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ Verified</span>
                    : <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-semibold text-amber-700">Awaiting DNS</span>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {!d.verified && <button onClick={() => verify(d)} disabled={busy} className="font-semibold text-brand hover:underline">Verify</button>}
                  <button onClick={() => remove(d)} className="text-red-500 hover:underline">Remove</button>
                </div>
              </div>
              {!d.verified && (
                <div className="mt-3 space-y-2 rounded-lg bg-bg-soft p-3 text-xs">
                  <div className="font-semibold text-fg">Add these two DNS records at your domain provider:</div>
                  <DnsRow label="1. TXT record (proves it's yours)" name={d.verify.txt_name} value={d.verify.txt_value} />
                  <DnsRow label="2. CNAME (points the domain at us)" name={d.host} value={d.verify.cname_target} />
                  <div className="text-fg-dim">DNS can take a few minutes. Once it's live, click <b>Verify</b>. HTTPS is set up for you automatically.</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="go.yourbrand.com"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
        <Button onClick={add} disabled={busy || !host.trim()} variant="outline">
          {busy ? "…" : "Add domain"}
        </Button>
      </div>
      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
    </div>
  );
}

function DnsRow({ label, name, value }: { label: string; name: string; value: string }) {
  const [copied, setCopied] = useState("");
  const copy = (t: string, which: string) => {
    navigator.clipboard?.writeText(t); setCopied(which); setTimeout(() => setCopied(""), 1200);
  };
  return (
    <div>
      <div className="text-fg-muted">{label}</div>
      <div className="mt-1 grid gap-1 sm:grid-cols-2">
        <button onClick={() => copy(name, "n")} className="truncate rounded bg-white px-2 py-1 text-left font-mono hover:ring-1 hover:ring-brand/30" title={name}>
          <span className="text-fg-dim">Name:</span> {name} {copied === "n" && <span className="text-emerald-600">✓</span>}
        </button>
        <button onClick={() => copy(value, "v")} className="truncate rounded bg-white px-2 py-1 text-left font-mono hover:ring-1 hover:ring-brand/30" title={value}>
          <span className="text-fg-dim">Value:</span> {value} {copied === "v" && <span className="text-emerald-600">✓</span>}
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  variantApi, campaignApi,
  type CampaignVariant, type VariantStats,
} from "../../lib/api";
import Button from "../ui/Button";
import { useDialog } from "../../context/DialogContext";

type Props = { campaignId: number; canManage: boolean };

export default function CampaignVariants({ campaignId, canManage }: Props) {
  const { confirm } = useDialog();
  const [variants, setVariants] = useState<CampaignVariant[]>([]);
  const [stats, setStats] = useState<VariantStats | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [weight, setWeight] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const [v, s] = await Promise.all([
      variantApi.list(campaignId),
      campaignApi.variantStats(campaignId),
    ]);
    setVariants(v.results); setStats(s);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [campaignId]);

  const totalWeight = variants.filter(v => v.active && v.weight > 0)
    .reduce((a, v) => a + v.weight, 0) || 1;
  const statById = Object.fromEntries((stats?.variants || []).map(r => [r.id, r]));

  async function add() {
    setErr("");
    if (!label.trim() || !url.trim()) { setErr("Give the variant a name and a destination URL."); return; }
    setBusy(true);
    try {
      await variantApi.create({ campaign: campaignId, label, destination_url: url, weight });
      setLabel(""); setUrl(""); setWeight(50); setAdding(false);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Could not add the variant.");
    } finally { setBusy(false); }
  }
  async function toggle(v: CampaignVariant) {
    await variantApi.update(v.id, { active: !v.active }); await load();
  }
  async function setW(v: CampaignVariant, w: number) {
    await variantApi.update(v.id, { weight: Math.max(0, w) }); await load();
  }
  async function del(v: CampaignVariant) {
    if (!(await confirm({
      title: "Delete this variant?",
      message: `"${v.label}" and its traffic split will be removed.`,
      confirmLabel: "Delete variant",
    }))) return;
    await variantApi.remove(v.id); await load();
  }

  return (
    <div className="mt-6 card shadow-soft p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fg-dim">A/B split testing</h2>
        {canManage && !adding && (
          <Button variant="outline" onClick={() => setAdding(true)}>+ Add variant</Button>
        )}
      </div>
      <p className="mt-2 text-sm text-fg-muted">
        Send real visitors to different landing pages and compare which converts best.
        Each visitor is stuck to one variant, so results stay consistent. Bots and fraud
        are excluded from the test automatically.
      </p>

      {variants.length === 0 && !adding && (
        <p className="mt-4 rounded-lg bg-bg-mute px-4 py-3 text-sm text-fg-muted">
          No variants yet. Add two or more to start an A/B test — traffic is split by weight.
        </p>
      )}

      {variants.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-fg-dim">
                <th className="py-2 pr-4">Variant</th>
                <th className="py-2 pr-4">Split</th>
                <th className="py-2 pr-4">Visitors</th>
                <th className="py-2 pr-4">Conversions</th>
                <th className="py-2 pr-4">CVR</th>
                {canManage && <th className="py-2" />}
              </tr>
            </thead>
            <tbody>
              {variants.map(v => {
                const share = v.active && v.weight > 0 ? Math.round((v.weight / totalWeight) * 100) : 0;
                const st = statById[v.id];
                return (
                  <tr key={v.id} className={`border-b border-line/60 ${!v.active ? "opacity-50" : ""}`}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold">{v.label}</div>
                      <a href={v.destination_url} target="_blank" rel="noreferrer"
                         className="text-xs text-brand hover:underline">{v.destination_url}</a>
                    </td>
                    <td className="py-3 pr-4">
                      {canManage ? (
                        <input type="number" min={0} value={v.weight}
                          onChange={e => setW(v, Number(e.target.value))}
                          className="w-16 rounded border border-line px-2 py-1" />
                      ) : v.weight}
                      <span className="ml-2 text-xs text-fg-muted">{share}%</span>
                    </td>
                    <td className="py-3 pr-4">{st?.visitors ?? 0}</td>
                    <td className="py-3 pr-4">{st?.conversions ?? 0}</td>
                    <td className="py-3 pr-4 font-semibold">{st ? `${(st.cvr * 100).toFixed(1)}%` : "0.0%"}</td>
                    {canManage && (
                      <td className="py-3 text-right">
                        <button onClick={() => toggle(v)} className="mr-3 text-xs text-fg-muted hover:text-brand">
                          {v.active ? "Pause" : "Resume"}
                        </button>
                        <button onClick={() => del(v)} className="text-xs text-red-600 hover:underline">Delete</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="mt-4 rounded-lg border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <input placeholder="Variant name (e.g. Control)" value={label}
              onChange={e => setLabel(e.target.value)}
              className="rounded border border-line px-3 py-2 text-sm" />
            <input placeholder="https://your-page.com/a" value={url}
              onChange={e => setUrl(e.target.value)}
              className="rounded border border-line px-3 py-2 text-sm sm:col-span-2" />
            <label className="text-sm text-fg-muted">Weight
              <input type="number" min={0} value={weight}
                onChange={e => setWeight(Number(e.target.value))}
                className="ml-2 w-20 rounded border border-line px-2 py-1" />
            </label>
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <div className="mt-3 flex gap-2">
            <Button onClick={add} disabled={busy}>{busy ? "Adding…" : "Add variant"}</Button>
            <button onClick={() => { setAdding(false); setErr(""); }}
              className="rounded-full px-4 py-2 text-sm text-fg-muted hover:text-fg">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

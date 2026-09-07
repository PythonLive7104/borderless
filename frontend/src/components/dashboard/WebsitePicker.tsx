import { useEffect, useState } from "react";
import { websiteApi, type Website } from "../../lib/api";

/* Scopes a page to one website. Only renders once a workspace actually has
   more than one site — with a single site there is nothing to choose, and an
   "All websites" dropdown showing one entry is just noise. */
export default function WebsitePicker({ orgId, value, onChange, onMulti }: {
  orgId: number;
  value: string;
  onChange: (websiteId: string) => void;
  /** Told whether this workspace has more than one site, so a page can add a
   *  "which site?" column only when one is actually needed. */
  onMulti?: (multi: boolean) => void;
}) {
  const [sites, setSites] = useState<Website[]>([]);

  useEffect(() => {
    let alive = true;
    websiteApi.list(orgId)
      .then((r) => { if (alive) { setSites(r.results); onMulti?.(r.results.length > 1); } })
      .catch(() => { /* the filter is optional; never block the page */ });
    return () => { alive = false; };
  }, [orgId]);

  if (sites.length < 2) return null;

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      aria-label="Filter by website"
      className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
      <option value="">All websites</option>
      {sites.map((s) => <option key={s.id} value={s.id}>{s.name || s.domain}</option>)}
    </select>
  );
}

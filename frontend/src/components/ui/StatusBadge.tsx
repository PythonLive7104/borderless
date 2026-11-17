import type { WebsiteState } from "../../lib/api";

const map: Record<WebsiteState, { label: string; cls: string; dot: string }> = {
  active: { label: "Protected", cls: "bg-success/10 text-emerald-700", dot: "bg-success" },
  // Our tag is on the page, but nobody has visited yet. A separate badge from
  // "waiting" on purpose: the customer has finished their side of the install
  // and telling them they are still waiting on themselves is what made
  // verification feel endless. They are waiting on a visitor, which is not
  // something they can do anything about.
  installed: { label: "Installed — waiting for traffic", cls: "bg-brand/10 text-brand", dot: "bg-brand" },
  waiting: { label: "Waiting for first visitor", cls: "bg-warning/10 text-amber-700", dot: "bg-warning" },
  idle: { label: "No recent traffic", cls: "bg-warning/10 text-amber-700", dot: "bg-warning" },
  error: { label: "Error", cls: "bg-danger/10 text-red-600", dot: "bg-danger" },
};

export default function StatusBadge({ status }: { status: WebsiteState }) {
  const s = map[status] ?? map.waiting;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
}

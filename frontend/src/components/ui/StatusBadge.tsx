import type { WebsiteStatus } from "../../lib/api";
const map: Record<WebsiteStatus, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-success/10 text-emerald-700", dot: "bg-success" },
  detected: { label: "Detected", cls: "bg-brand/10 text-brand", dot: "bg-brand" },
  not_installed: { label: "Not installed", cls: "bg-bg-mute text-fg-muted", dot: "bg-fg-dim" },
  error: { label: "Error", cls: "bg-danger/10 text-red-600", dot: "bg-danger" },
};
export default function StatusBadge({ status }: { status: WebsiteStatus }) {
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
}

export default function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "brand" | "green" | "amber" | "red" }) {
  const bar: Record<string, string> = { brand: "bg-brand", green: "bg-success", amber: "bg-warning", red: "bg-danger" };
  return (
    <div className="card shadow-soft relative overflow-hidden p-5">
      {tone && <span className={`absolute left-0 top-0 h-full w-1 ${bar[tone]}`} />}
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{label}</div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-fg-dim">{sub}</div>}
    </div>
  );
}

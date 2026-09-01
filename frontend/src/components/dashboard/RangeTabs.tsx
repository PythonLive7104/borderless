const RANGES = [["today", "Today"], ["7d", "7d"], ["30d", "30d"], ["90d", "90d"]];
export default function RangeTabs({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-0.5">
      {RANGES.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${value === v ? "bg-brand text-white" : "text-fg-muted hover:text-fg"}`}>{l}</button>
      ))}
    </div>
  );
}

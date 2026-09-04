import type { BillingInterval } from "../../lib/api";

/** Weekly / Monthly switch. Monthly is the cheaper per-day option on every
 *  tier, so it carries the savings badge rather than being a neutral choice. */
export default function IntervalToggle({ value, onChange, savings, dark = false }: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  savings?: string;
  dark?: boolean;
}) {
  const track = dark ? "border-white/20 bg-white/10" : "border-line bg-bg-mute";
  const on = dark ? "bg-white text-navy-900" : "bg-white text-fg shadow-soft";
  const off = dark ? "text-slate-300 hover:text-white" : "text-fg-muted hover:text-fg";

  return (
    <div className="inline-flex items-center gap-3">
      <div className={`inline-flex rounded-full border p-1 ${track}`} role="group" aria-label="Billing interval">
        {(["weekly", "monthly"] as BillingInterval[]).map((v) => (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${value === v ? on : off}`}>
            {v}
          </button>
        ))}
      </div>
      {savings && value === "monthly" && (
        <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
          {savings}
        </span>
      )}
    </div>
  );
}

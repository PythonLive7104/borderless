import type { BillingInterval } from "../../lib/api";

const OPTIONS: BillingInterval[] = ["weekly", "monthly", "yearly"];

/** Weekly / Monthly / Yearly switch.
 *
 *  The savings badge follows the selected interval rather than being pinned to
 *  one of them: each longer window is better value per day than the one below
 *  it, so hard-coding the badge to "monthly" would have understated yearly the
 *  moment it was added. Callers pass the copy for whichever intervals they want
 *  to advertise a saving on, and intervals they omit simply show no badge.
 */
export default function IntervalToggle({ value, onChange, savings, dark = false }: {
  value: BillingInterval;
  onChange: (v: BillingInterval) => void;
  /** Badge copy per interval, e.g. { monthly: "Save 15%", yearly: "2 months free" }. */
  savings?: Partial<Record<BillingInterval, string>>;
  dark?: boolean;
}) {
  const track = dark ? "border-white/20 bg-white/10" : "border-line bg-bg-mute";
  const on = dark ? "bg-white text-navy-900" : "bg-white text-fg shadow-soft";
  const off = dark ? "text-slate-300 hover:text-white" : "text-fg-muted hover:text-fg";
  const badge = savings?.[value];

  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-3">
      <div className={`inline-flex rounded-full border p-1 ${track}`} role="group" aria-label="Billing interval">
        {OPTIONS.map((v) => (
          <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold capitalize transition ${value === v ? on : off}`}>
            {v}
          </button>
        ))}
      </div>
      {badge && (
        <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
          {badge}
        </span>
      )}
    </div>
  );
}

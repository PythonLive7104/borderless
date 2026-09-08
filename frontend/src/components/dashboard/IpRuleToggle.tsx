import type { IPKind } from "../../lib/api";

/* Three states, so a segmented control rather than an on/off switch:

     Block · Auto · Allow

   "Auto" means no entry — the visitor is judged by the normal rules. Block and
   Allow both override those rules outright in the engine, which is why the
   active state is coloured rather than merely highlighted. */
export default function IpRuleToggle({ value, busy, onChange }: {
  value: IPKind | null;                    // null = auto
  busy?: boolean;
  onChange: (next: IPKind | null) => void;
}) {
  const seg = (key: IPKind | null, label: string, active: string) => {
    const on = value === key;
    return (
      <button
        key={label}
        type="button"
        disabled={busy}
        aria-pressed={on}
        onClick={() => onChange(on ? null : key)}
        className={`px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
          on ? active : "text-fg-dim hover:bg-bg-mute hover:text-fg"}`}>
        {label}
      </button>
    );
  };

  return (
    <span className={`inline-flex overflow-hidden rounded-full border border-line bg-white ${busy ? "opacity-60" : ""}`}
          role="group" aria-label="IP rule">
      {seg("deny", "Block", "bg-danger text-white")}
      <span className="w-px bg-line" aria-hidden="true" />
      {seg(null, "Auto", "bg-bg-mute text-fg")}
      <span className="w-px bg-line" aria-hidden="true" />
      {seg("allow", "Allow", "bg-success text-white")}
    </span>
  );
}

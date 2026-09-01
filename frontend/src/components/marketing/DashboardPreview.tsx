// A polished mock of the product dashboard, shown in the hero.
const bars = [38, 52, 44, 61, 55, 72, 66, 80, 74, 88, 83, 95];
export default function DashboardPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-800/70 p-3 shadow-2xl backdrop-blur">
      <div className="rounded-xl bg-white p-4 text-fg shadow-soft">
        {/* top row */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-dim">Live overview</div>
            <div className="text-sm font-bold">Traffic quality — last 24h</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Live
          </span>
        </div>
        {/* stat tiles */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { k: "Visitors", v: "48,201", d: "+12.4%", tone: "text-emerald-600" },
            { k: "Quality", v: "92.7%", d: "+3.1%", tone: "text-emerald-600" },
            { k: "Fraud blocked", v: "1,842", d: "+8.0%", tone: "text-brand" },
          ].map((s) => (
            <div key={s.k} className="rounded-lg border border-line bg-bg-soft p-2.5">
              <div className="text-[10px] font-medium text-fg-dim">{s.k}</div>
              <div className="text-base font-extrabold leading-tight">{s.v}</div>
              <div className={`text-[10px] font-semibold ${s.tone}`}>{s.d}</div>
            </div>
          ))}
        </div>
        {/* chart */}
        <div className="mt-3 flex h-24 items-end gap-1.5 rounded-lg border border-line bg-bg-soft px-3 pb-3 pt-2">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand/40 to-brand" style={{ height: `${h}%` }} />
          ))}
        </div>
        {/* classified rows */}
        <div className="mt-3 space-y-1.5">
          {[
            { c: "US · Chrome · Desktop", s: 12, t: "Human", cls: "bg-success/10 text-emerald-700" },
            { c: "DE · Headless · Datacenter", s: 88, t: "Bot", cls: "bg-danger/10 text-red-600" },
            { c: "BR · Safari · Mobile", s: 47, t: "Suspicious", cls: "bg-warning/10 text-amber-700" },
          ].map((r) => (
            <div key={r.c} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 text-[11px]">
              <span className="text-fg-muted">{r.c}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono font-bold">{r.s}</span>
                <span className={`rounded-full px-2 py-0.5 font-semibold ${r.cls}`}>{r.t}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

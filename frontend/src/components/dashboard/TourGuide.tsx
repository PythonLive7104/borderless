import { useEffect, useState } from "react";

export type TourStep = { icon: string; title: string; body: string };

export default function TourGuide({ steps, open, onClose }: { steps: TourStep[]; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (open) setI(0); }, [open]);
  if (!open) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)]">
        <div className="flex items-start justify-between">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand/10 text-2xl">{step.icon}</div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-fg-dim hover:bg-bg-mute hover:text-fg" aria-label="Close tour">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <h2 className="mt-4 text-xl font-extrabold tracking-tight">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.body}</p>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5">
            {steps.map((_, j) => (
              <span key={j} className={`h-1.5 rounded-full transition-all ${j === i ? "w-5 bg-brand" : "w-1.5 bg-line"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="rounded-full px-4 py-2 text-sm font-semibold text-fg-muted hover:text-fg">Back</button>
            )}
            {last ? (
              <button onClick={onClose} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">Get started</button>
            ) : (
              <button onClick={() => setI(i + 1)} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600">Next</button>
            )}
          </div>
        </div>
        {!last && (
          <button onClick={onClose} className="mt-3 block w-full text-center text-xs text-fg-dim hover:text-fg-muted">Skip the tour</button>
        )}
      </div>
    </div>
  );
}

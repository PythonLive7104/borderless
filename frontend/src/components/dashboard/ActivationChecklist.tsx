import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { orgApi, type ActivationState } from "../../lib/api";

/* Setup progress, for as long as setup is unfinished.
 *
 * The problem it solves is the one that kills trials: someone registers, lands
 * on an empty dashboard, and cannot tell whether the product is broken, still
 * waiting, or missing a step they were supposed to do. GetStarted asks the
 * fork question once and then removes itself as soon as a website row exists —
 * which is the moment the snippet is still uninstalled and there is still
 * nothing to look at. So the guidance disappears exactly when it starts to
 * matter.
 *
 * Three things it deliberately does not do:
 *
 *   - It is not dismissible. Everything here is real, unfinished setup, and a
 *     customer who hides it is left with the empty dashboard that caused the
 *     confusion. It removes itself when the work is genuinely done, which is
 *     the only exit that is good for them.
 *   - It never shows a tick the server did not give it. Progress is derived
 *     from real data (our tag seen on the page, events received, visitors
 *     flagged), never from local state about what the user clicked.
 *   - It stays quiet about optional work. The Shield is listed, but it is not
 *     the "next step" and it is not in the count, so a complete setup reads as
 *     complete.
 */
export default function ActivationChecklist({ orgId }: { orgId: number }) {
  const [state, setState] = useState<ActivationState | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    orgApi.activation(orgId, ac.signal)
      .then(setState)
      .catch(() => { /* never let the checklist break the dashboard */ });
    return () => ac.abort();
  }, [orgId]);

  // Nothing to say while loading, and nothing to say once they are set up.
  // Finished customers get their dashboard back rather than a permanent
  // "well done" banner taking up the top of it.
  if (!state || state.complete) return null;

  // Hand off cleanly to GetStarted rather than competing with it. That card
  // asks the one question this list cannot — website or short link, two paths
  // that do not depend on each other — and it shows on exactly the condition
  // below. Rendering both would ask the same thing twice in two different
  // shapes; this takes over the moment they have picked.
  const target = state.steps.find((s) => s.key === "target");
  if (target && !target.done) return null;

  const nextKey = state.next?.key;

  return (
    <section className="card shadow-soft mb-6 border-brand/30 bg-brand/5 p-6"
      aria-labelledby="activation-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="activation-heading" className="text-lg font-extrabold tracking-tight">
            Finish setting up
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {state.completed === 0
              ? "Three short steps until you can see which of your visitors are real."
              : `${state.completed} of ${state.total} done — ${state.next?.title.toLowerCase()} next.`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums">{state.percent}%</div>
          <div className="text-xs text-fg-dim">complete</div>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-mute"
        role="progressbar" aria-valuenow={state.percent} aria-valuemin={0} aria-valuemax={100}
        aria-label="Setup progress">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500"
          style={{ width: `${state.percent}%` }} />
      </div>

      <ol className="mt-5 space-y-2">
        {state.steps.map((step) => {
          const isNext = step.key === nextKey;
          return (
            <li key={step.key}
              className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${
                step.done
                  ? "border-line/60 bg-white/50"
                  : isNext
                    ? "border-brand/50 bg-white shadow-soft"
                    : "border-line bg-white/40"
              }`}>
              <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                step.done ? "bg-emerald-600 text-white"
                  : isNext ? "bg-brand text-white"
                    : "border border-line bg-white text-fg-dim"
              }`}>
                {step.done ? "✓" : ""}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-sm font-bold ${step.done ? "text-fg-muted line-through" : ""}`}>
                    {step.title}
                  </span>
                  {step.optional && !step.done && (
                    <span className="rounded-full bg-bg-mute px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-fg-dim">
                      Optional
                    </span>
                  )}
                </div>
                {!step.done && (
                  <p className="mt-1 text-xs leading-relaxed text-fg-muted">{step.detail}</p>
                )}
                {step.done && step.at && (
                  <p className="mt-1 text-xs text-fg-dim">
                    Done {new Date(step.at).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* Only the step they should do next gets a button. Buttons on
                  every row turn a sequence into a menu, and the point of this
                  panel is to answer "what now" with one answer. */}
              {isNext && step.cta_path && (
                <Link to={step.cta_path}
                  className="shrink-0 self-center rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90">
                  {step.cta_label} →
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

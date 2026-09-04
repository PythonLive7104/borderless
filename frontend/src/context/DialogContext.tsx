import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";

/* Replaces the browser's native confirm()/alert(), which render as an
   unstyled "trynobot.com says" box, can't be branded, and read as a phishing
   prompt to anyone who's been trained to distrust them.

   confirm() returns a promise so call sites stay a one-line change:
       if (!(await confirm({ title: "Delete this redirect?" }))) return;      */

type Tone = "danger" | "brand";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
};

type Toast = { id: number; message: string; tone: "success" | "danger" };

type DialogApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  notify: (message: string, tone?: Toast["tone"]) => void;
};

const DialogContext = createContext<DialogApi | null>(null);

/** Falls back to the native dialogs when no provider is mounted (SSR, tests). */
export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  return ctx ?? {
    confirm: async (o) => (typeof window === "undefined" ? false : window.confirm(o.title)),
    notify: (m) => { if (typeof window !== "undefined") window.alert(m); },
  };
}

const TONES: Record<Tone, { btn: string; ring: string; icon: string }> = {
  danger: {
    btn: "bg-danger text-white hover:bg-red-700",
    ring: "focus-visible:ring-danger/40",
    icon: "bg-danger/10 text-danger",
  },
  brand: {
    btn: "bg-brand text-white hover:bg-brand-600",
    ring: "focus-visible:ring-brand/40",
    icon: "bg-brand/10 text-brand",
  },
};

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<Element | null>(null);
  const toastId = useRef(0);

  const confirm = useCallback((opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      restoreFocus.current = typeof document !== "undefined" ? document.activeElement : null;
      setPending({ ...opts, resolve });
    }), []);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const close = useCallback((result: boolean) => {
    setPending((p) => { p?.resolve(result); return null; });
    // Send focus back where it came from, so keyboard users aren't dumped at
    // the top of the document after every confirmation.
    const el = restoreFocus.current as HTMLElement | null;
    if (el?.focus) setTimeout(() => el.focus(), 0);
  }, []);

  // Escape cancels, Enter confirms — the shortcuts the native dialog had.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(false); }
      if (e.key === "Enter") { e.preventDefault(); close(true); }
    };
    window.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    // Stop the page behind the dialog scrolling under it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [pending, close]);

  const api = useMemo(() => ({ confirm, notify }), [confirm, notify]);
  const tone = TONES[pending?.tone ?? "danger"];

  return (
    <DialogContext.Provider value={api}>
      {children}

      {pending && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="alertdialog"
             aria-modal="true" aria-labelledby="dialog-title">
          <div className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center shadow-xl">
            <div className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${tone.icon}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </div>
            <h3 id="dialog-title" className="mt-4 text-lg font-bold tracking-tight">{pending.title}</h3>
            {pending.message && (
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{pending.message}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => close(false)}
                className="flex-1 rounded-full border border-line bg-white px-5 py-2.5 text-sm font-semibold text-fg transition hover:bg-bg-mute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30">
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button type="button" ref={confirmRef} onClick={() => close(true)}
                className={`flex-1 rounded-full px-5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 ${tone.btn} ${tone.ring}`}>
                {pending.confirmLabel ?? "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom-LEFT: the support chat bubble owns the bottom-right corner. */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-5 z-[110] flex flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id}
              className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
                t.tone === "success"
                  ? "border-success/25 bg-white text-fg"
                  : "border-danger/25 bg-white text-fg"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                t.tone === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                     strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {t.tone === "success" ? <path d="M20 6 9 17l-5-5" /> : <path d="M18 6 6 18M6 6l12 12" />}
                </svg>
              </span>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </DialogContext.Provider>
  );
}

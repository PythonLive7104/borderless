import { useEffect, useState } from "react";
import { testimonialApi, type MyTestimonial, type TestimonialDraft } from "../../lib/api";
import { useWorkspace } from "../../context/WorkspaceContext";
import Button from "../ui/Button";

const CONSENT_TEXT =
  "I agree that TryNoBot may publish this testimonial, along with my name, " +
  "role and company, on its website and marketing materials.";

/** Asks a customer for a testimonial, in the dashboard.
 *
 *  Shown on the overview rather than behind a menu, because a review gets
 *  written in the thirty seconds after someone sees their own numbers or not
 *  at all. It hides itself once submitted — nobody should be nagged for
 *  something they already gave.
 *
 *  The consent tick is the point of the whole component. Publishing somebody's
 *  name and employer on a marketing site needs their express permission, and
 *  the server stores the exact wording they agreed to alongside the quote.
 */
export default function TestimonialPrompt() {
  const { current } = useWorkspace();
  const orgId = current?.id;
  const [existing, setExisting] = useState<MyTestimonial | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState<TestimonialDraft>({
    quote: "", author_name: "", author_role: "", author_company: "",
    country: "", rating: 5, consent: false,
  });

  useEffect(() => {
    if (!orgId) return;
    let live = true;
    testimonialApi.mine(orgId)
      .then((r) => { if (live) { setExisting(r.testimonial); setLoaded(true); } })
      .catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [orgId]);

  if (!orgId || !loaded) return null;

  // Already said their piece — thank them, don't ask again.
  if (existing) {
    if (existing.status === "rejected") return null;
    return (
      <div className="card shadow-soft mb-6 flex flex-wrap items-center gap-3 border-l-4 border-l-success p-5">
        <div className="min-w-0 flex-1">
          <div className="font-bold">
            {existing.status === "approved" ? "Your testimonial is live" : "Thanks for your testimonial"}
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {existing.status === "approved"
              ? "It's published on our site. Thank you — it genuinely helps."
              : "We're reviewing it now. It won't be published anywhere until we have."}
          </p>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true); setErr("");
    try {
      const saved = await testimonialApi.submit(orgId, f);
      setExisting(saved);
      setOpen(false);
    } catch (e: any) {
      const d = e?.data;
      setErr(d?.quote?.[0] || d?.consent?.[0] || d?.rating?.[0] || d?.detail
             || "Couldn't send that. Please try again.");
    } finally { setBusy(false); }
  }

  const set = (k: keyof TestimonialDraft) => (v: string | number | boolean) =>
    setF({ ...f, [k]: v } as TestimonialDraft);

  if (!open) {
    return (
      <div className="card shadow-soft mb-6 flex flex-col gap-4 border-l-4 border-l-brand p-5 sm:flex-row sm:items-center">
        {/* Stacked on a phone. As a wrapping row the text column had no width
            basis, so it collapsed to two or three words per line while the
            button sat beside it — which read as broken rather than tight. */}
        <div className="min-w-0 flex-1">
          <div className="font-bold">Is TryNoBot working for you?</div>
          <p className="mt-1 text-sm text-fg-muted">
            If it's saved you money or caught something you'd have missed, a couple of
            sentences would help other advertisers decide. We only publish it with your permission.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full shrink-0 sm:w-auto">
          Write a testimonial
        </Button>
      </div>
    );
  }

  const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

  return (
    <form onSubmit={submit} className="card shadow-soft mb-6 border-l-4 border-l-brand p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="font-bold">Write a testimonial</div>
        <button type="button" onClick={() => setOpen(false)}
          className="text-sm text-fg-dim hover:text-fg">Cancel</button>
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-fg-dim">
        In your own words
      </label>
      <textarea required rows={4} value={f.quote} maxLength={400}
        onChange={(e) => set("quote")(e.target.value)}
        placeholder="What changed since you started using it? Specifics help more than praise."
        className={`mt-1 ${input}`} />
      <div className="mt-1 text-right text-xs text-fg-dim">{f.quote.length}/400</div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-fg-dim">Your name</label>
          <input required value={f.author_name} onChange={(e) => set("author_name")(e.target.value)}
            className={`mt-1 ${input}`} placeholder="Jane Marketer" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-fg-dim">Role</label>
          <input value={f.author_role} onChange={(e) => set("author_role")(e.target.value)}
            className={`mt-1 ${input}`} placeholder="Head of Paid Media" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-fg-dim">Company</label>
          <input value={f.author_company} onChange={(e) => set("author_company")(e.target.value)}
            className={`mt-1 ${input}`} placeholder="Acme Agency" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-fg-dim">Country</label>
          <input value={f.country} onChange={(e) => set("country")(e.target.value)}
            className={`mt-1 ${input}`} placeholder="United Kingdom" />
        </div>
      </div>

      <div className="mt-4">
        <span className="block text-xs font-semibold uppercase tracking-wide text-fg-dim">Rating</span>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => set("rating")(n)}
              aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={f.rating === n}
              className={`text-2xl leading-none transition ${n <= f.rating ? "text-amber-400" : "text-line hover:text-amber-200"}`}>
              ★
            </button>
          ))}
        </div>
      </div>

      <label className="mt-5 flex items-start gap-2.5 rounded-lg bg-bg-soft p-3 text-sm">
        <input type="checkbox" required checked={f.consent}
          onChange={(e) => set("consent")(e.target.checked)} className="mt-0.5" />
        <span className="text-fg-muted">{CONSENT_TEXT}</span>
      </label>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={busy || !f.consent}>
          {busy ? "Sending…" : "Send testimonial"}
        </Button>
        <span className="text-xs text-fg-dim">
          Nothing is published until we've reviewed it.
        </span>
      </div>
    </form>
  );
}

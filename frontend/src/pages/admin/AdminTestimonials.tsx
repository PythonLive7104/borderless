import { useEffect, useState } from "react";
import { testimonialApi, type AdminTestimonial } from "../../lib/api";
import Button from "../../components/ui/Button";

const TABS: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "", label: "All" },
];

/** Moderation queue for customer testimonials.
 *
 *  Approving one is a decision to publish a named person's words on the
 *  marketing site, so the screen shows the consent record next to the quote
 *  rather than leaving it in the database — you should be able to see that
 *  permission exists at the moment you act on it.
 */
export default function AdminTestimonials() {
  const [tab, setTab] = useState("pending");
  const [rows, setRows] = useState<AdminTestimonial[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  function load(status: string) {
    testimonialApi.adminList(status || undefined)
      .then(setRows)
      .catch((e) => setErr(e?.data?.detail || "Couldn't load testimonials."));
  }
  useEffect(() => { load(tab); }, [tab]);

  async function act(t: AdminTestimonial, action: "approve" | "reject" | "feature",
                     extra: Record<string, unknown> = {}) {
    setBusy(t.id); setErr("");
    try {
      await testimonialApi.adminAct(t.id, { action, ...extra } as any);
      load(tab);
    } catch (e: any) {
      setErr(e?.data?.detail || "That didn't work.");
    } finally { setBusy(null); }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Testimonials</h1>
      <p className="mt-1 text-sm text-fg-muted">
        Approve to make a testimonial publishable; feature it to put it in the landing-page
        carousel. Neither appears on the site until <code className="rounded bg-bg-mute px-1.5 py-0.5">
        manage.py export_testimonials</code> is run and the web image is rebuilt.
      </p>

      <div className="mt-5 flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.key ? "bg-brand text-white" : "bg-bg-mute text-fg-muted hover:text-fg"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {err && <p className="mt-4 rounded-lg bg-danger/5 px-4 py-2 text-sm text-red-600">{err}</p>}

      <div className="mt-6 space-y-4">
        {rows.length === 0 && (
          <div className="card shadow-soft p-8 text-center text-sm text-fg-muted">
            Nothing here.
          </div>
        )}

        {rows.map((t) => (
          <div key={t.id} className="card shadow-soft p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">{"★".repeat(t.rating)}<span className="text-line">{"★".repeat(5 - t.rating)}</span></span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  t.status === "approved" ? "bg-success/10 text-emerald-700"
                  : t.status === "rejected" ? "bg-danger/10 text-red-700"
                  : "bg-warning/10 text-amber-700"}`}>{t.status}</span>
                {t.featured && (
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                    Featured
                  </span>
                )}
              </div>
              <span className="text-xs text-fg-dim">
                {new Date(t.created_at).toLocaleDateString()}
              </span>
            </div>

            <blockquote className="mt-3 text-lg font-semibold leading-snug">
              &ldquo;{t.quote}&rdquo;
            </blockquote>

            <div className="mt-3 text-sm text-fg-muted">
              <b className="text-fg">{t.author_name}</b>
              {t.author_role && <>, {t.author_role}</>}
              {t.author_company && <> &middot; {t.author_company}</>}
              {t.country && <> &middot; {t.country}</>}
            </div>
            <div className="mt-1 text-xs text-fg-dim">
              Workspace: {t.organization_name} &middot; {t.author_email || "no email"}
            </div>

            {/* The permission, shown where the decision is made. */}
            <div className={`mt-4 rounded-lg p-3 text-xs ${
              t.consent ? "bg-success/5 text-emerald-800" : "bg-danger/5 text-red-700"}`}>
              {t.consent ? (
                <>
                  <b>Consent given</b>
                  {t.consent_at && <> on {new Date(t.consent_at).toLocaleString()}</>}: &ldquo;{t.consent_text}&rdquo;
                </>
              ) : (
                <b>No consent recorded — this cannot be approved or published.</b>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {t.status !== "approved" && (
                <Button onClick={() => act(t, "approve", { featured: true })}
                  disabled={busy === t.id || !t.consent}>
                  Approve &amp; feature
                </Button>
              )}
              {t.status !== "approved" && (
                <Button variant="outline" onClick={() => act(t, "approve")}
                  disabled={busy === t.id || !t.consent}>
                  Approve only
                </Button>
              )}
              {t.status === "approved" && (
                <Button variant="outline" onClick={() => act(t, "feature", { featured: !t.featured })}
                  disabled={busy === t.id}>
                  {t.featured ? "Remove from carousel" : "Add to carousel"}
                </Button>
              )}
              {t.status !== "rejected" && (
                <Button variant="ghost" onClick={() => act(t, "reject")} disabled={busy === t.id}>
                  Reject
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

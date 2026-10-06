import { useState } from "react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import Field from "../auth/Field";
import { contactApi, errText } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useWorkspace } from "../../context/WorkspaceContext";

/** How quickly we promise to have a requested domain registered and live.
 *  Stated in one place because it appears in the button, the form and the
 *  confirmation — three copies that drift apart are three different promises. */
export const SOURCING_HOURS = 6;

/**
 * "Ask us to get a domain" — the way out of the private-domain dead end.
 *
 * Stock is a fixed list we happen to be holding. Someone whose campaign needs a
 * particular name (or who simply dislikes all six on offer) previously hit a
 * wall: the copy said "ask and we'll source one" without saying where to ask,
 * so the only path was to leave the dashboard and find the contact page.
 *
 * Used only inside the domain picker, deliberately. The picker is the first
 * place anyone can know the list disappoints them, and keeping it off the card
 * leaves that card a single paid CTA with nothing competing against it.
 *
 * This posts to the same public contact endpoint as the marketing form, so the
 * request lands in the one inbox and admin list the team already works from
 * (apps/support). No new backend, no second place to check — and because that
 * endpoint saves the row before it emails, a mail outage can't lose a request
 * we've just promised to fill within SOURCING_HOURS.
 *
 * Deliberately NOT a mailto: this audience runs blockers and privacy shields,
 * and a mailto on a machine with no mail client configured opens nothing at all
 * — a dead button on the one screen where we're asking them to spend money.
 */
export default function RequestDomain({ label, variant = "outline", className }: {
  label?: string;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
}) {
  const { user } = useAuth();
  const { current } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  function close() {
    setOpen(false);
    // Reset only after a success, so a failed attempt keeps what they typed —
    // retyping a domain name because the network blipped is a good way to lose
    // someone at exactly the point they were about to pay.
    if (sent) { setHost(""); setNote(""); setSent(false); setErr(""); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const wanted = host.trim();
    if (!wanted) return;
    setBusy(true); setErr("");
    try {
      // The subject line the team sees is built from `name`, so the request
      // type has to be legible there — these land beside ordinary sales
      // enquiries and are the only ones carrying a few-hour clock.
      const who = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email || "Customer";
      const res = await contactApi.send({
        name: `Domain request — ${who}`,
        email: user?.email || "",
        company: current?.name || "",
        message:
          `PRIVATE DOMAIN REQUEST (promised within ${SOURCING_HOURS}h)\n\n` +
          `Wants: ${wanted}\n` +
          `Workspace: ${current?.name || "—"} (id ${current?.id ?? "—"})\n` +
          `Account: ${user?.email || "—"}\n\n` +
          `Note: ${note.trim() || "—"}\n`,
      });
      if (!res.ok) throw new Error(res.error || "");
      setSent(true);
    } catch (e: any) {
      // Never show "sent" on a failure: this screen promises a reply on a
      // clock, and someone who believes it was sent will simply wait.
      setErr(errText(e?.data, e?.message) ||
        "We couldn't send that. Email support@trynobot.com and we'll pick it up there.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {label ?? "Ask for a specific domain"}
      </Button>

      <Modal open={open} onClose={close} title="Tell us the domain you want">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <h4 className="mt-4 text-base font-bold">We're on it</h4>
            <p className="mt-2 text-sm text-fg-muted">
              We'll register <span className="font-mono font-semibold">{host.trim()}</span> and have it
              ready in your account in <b>under {SOURCING_HOURS} hours</b>. You'll get an email the
              moment it's live — and you're not charged until it is.
            </p>
            <div className="mt-5 flex justify-end">
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-fg-muted">
              Not seeing one you like? Tell us the domain you want for your redirects and we'll
              register it for you — normally in <b>under {SOURCING_HOURS} hours</b>, at the same
              monthly price. Nothing is charged until it's live in your account.
            </p>
            <Field
              label="Domain you want"
              value={host}
              onChange={setHost}
              placeholder="go-acme.com"
              autoComplete="off"
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold">
                Anything else? <span className="font-normal text-fg-dim">(optional)</span>
              </span>
              <textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="A second choice in case it's taken, or the kind of name you're after."
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <p className="text-xs text-fg-dim">
              We'll reply to <b>{user?.email || "your account email"}</b>. If the exact name is
              already taken we'll come back with the closest alternatives.
            </p>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy || !host.trim()}>
                {busy ? "Sending…" : "Send request"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

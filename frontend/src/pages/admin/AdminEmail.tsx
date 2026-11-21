import { useRef, useState } from "react";
import { adminApi } from "../../lib/api";
import Button from "../../components/ui/Button";
import { useDialog } from "../../context/DialogContext";

// Email-safe snippets (inline styles — email clients ignore <style> and classes).
// A styled anchor is the reliable way to get a "button" that renders in Gmail,
// Outlook and Apple Mail alike.
const LINK_SNIPPET = `<a href="https://trynobot.com/OFFER">your link text</a>`;
const BUTTON_SNIPPET = `<p style="text-align:center;margin:28px 0;">
  <a href="https://trynobot.com/dashboard/billing"
     style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:10px;">
    Get the offer
  </a>
</p>`;

const AUDIENCES: { value: string; label: string; hint: string }[] = [
  { value: "test", label: "Just me (test)", hint: "Send only to your own address to check it." },
  { value: "users", label: "All users", hint: "Every registered account." },
  { value: "leads", label: "Bot Check leads", hint: "People who scanned a site and left an email (not yet customers)." },
  { value: "custom", label: "Specific addresses", hint: "Paste addresses below, separated by commas or new lines." },
];

const STARTER = `<p>Hi there,</p>
<p>Write your message here. You can use simple HTML — <b>bold</b>, <a href="https://trynobot.com">links</a>, and paragraphs.</p>
<p>— The TryNoBot team</p>`;

const OFFER_TEMPLATE = `<p>Hi there,</p>
<p>For a limited time, <b>save on TryNoBot</b> — keep more of your ad budget by blocking the bots and fake clicks draining your campaigns.</p>
<p style="text-align:center;margin:28px 0;">
  <a href="https://trynobot.com/dashboard/billing"
     style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 30px;border-radius:10px;">
    Claim this offer
  </a>
</p>
<p>Questions? Just reply to this email.</p>
<p>— The TryNoBot team</p>`;

const TEMPLATES: { label: string; body: string }[] = [
  { label: "Blank", body: STARTER },
  { label: "Promotion / offer", body: OFFER_TEMPLATE },
];

export default function AdminEmail() {
  const { confirm, notify } = useDialog();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(STARTER);
  const [mode, setMode] = useState("test");
  const [emails, setEmails] = useState("");
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Insert a snippet at the cursor (or append), so the admin never hand-types
  // the fiddly inline-styled button HTML.
  function insert(snippet: string) {
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + "\n" + snippet); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    // Put the cursor just after what we inserted.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function refreshPreview() {
    try {
      const r = await adminApi.emailPreview(subject, body);
      setPreview(r.html);
    } catch { setPreview("<p style='padding:1rem;color:#b91c1c'>Preview failed.</p>"); }
  }

  async function send() {
    if (!subject.trim() || !body.trim()) { notify("Subject and body are required."); return; }
    const aud = AUDIENCES.find((a) => a.value === mode)!;
    if (!(await confirm({
      title: `Send to: ${aud.label}?`,
      message: mode === "test"
        ? "This sends only to your own address."
        : `This emails ${aud.label.toLowerCase()}. This cannot be undone — send a test to yourself first if you haven't.`,
      confirmLabel: "Send now",
      cancelLabel: "Cancel",
      tone: mode === "test" ? "brand" : "danger",
    }))) return;
    setBusy(true);
    try {
      const r = await adminApi.sendEmail({ subject, body_html: body, mode, emails });
      notify(`Sent to ${r.sent} of ${r.recipients} recipient(s).`);
    } catch (e: any) {
      notify(e?.data?.detail || "Send failed.");
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">Send an email</h1>
      <p className="mt-1 text-sm text-fg-muted">Compose, preview exactly how it will look in an inbox, then send.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Composer */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)}
              placeholder="Your subject line"
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold">Body (HTML)</label>
              <div className="flex flex-wrap items-center gap-1.5">
                <select onChange={(e) => { const t = TEMPLATES[Number(e.target.value)]; if (t) setBody(t.body); e.currentTarget.selectedIndex = 0; }}
                  defaultValue=""
                  className="rounded-lg border border-line bg-white px-2 py-1 text-xs">
                  <option value="" disabled>Template…</option>
                  {TEMPLATES.map((t, i) => <option key={t.label} value={i}>{t.label}</option>)}
                </select>
                <button type="button" onClick={() => insert(LINK_SNIPPET)}
                  className="rounded-lg border border-line px-2 py-1 text-xs font-semibold hover:border-brand/50">+ Link</button>
                <button type="button" onClick={() => insert(BUTTON_SNIPPET)}
                  className="rounded-lg border border-line px-2 py-1 text-xs font-semibold hover:border-brand/50">+ Offer button</button>
              </div>
            </div>
            <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <p className="mt-1 text-xs text-fg-dim">Simple HTML: paragraphs, bold/italic, links. Use <b>+ Offer button</b> for a tappable call-to-action, then change its link and label. The header, footer and styling are added automatically.</p>
          </div>
          <div>
            <label className="text-sm font-semibold">Audience</label>
            <div className="mt-1 space-y-1.5">
              {AUDIENCES.map((a) => (
                <label key={a.value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 ${mode === a.value ? "border-brand bg-brand/5" : "border-line"}`}>
                  <input type="radio" name="aud" className="mt-1 accent-brand" checked={mode === a.value} onChange={() => setMode(a.value)} />
                  <span><span className="text-sm font-semibold">{a.label}</span><br /><span className="text-xs text-fg-muted">{a.hint}</span></span>
                </label>
              ))}
            </div>
            {mode === "custom" && (
              <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={3}
                placeholder="a@example.com, b@example.com"
                className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={refreshPreview} variant="outline">Update preview</Button>
            <Button onClick={send} disabled={busy}>{busy ? "Sending…" : "Send"}</Button>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold">Inbox preview</span>
            <span className="text-xs text-fg-dim">Exactly what recipients see</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-bg-mute">
            {preview
              ? <iframe title="Email preview" srcDoc={preview} className="h-[560px] w-full border-0 bg-white" />
              : <div className="grid h-[560px] place-items-center text-sm text-fg-dim">Click “Update preview” to render your email.</div>}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900">
        <b>Deliverability:</b> whether these reach the inbox or spam is decided mostly by DNS. Make sure your sending domain has <b>SPF, DKIM and DMARC</b> configured in Resend + Cloudflare. Always “Just me (test)” first, and avoid spammy words in the subject.
      </div>
    </div>
  );
}

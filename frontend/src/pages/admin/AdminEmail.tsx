import { useState } from "react";
import { adminApi } from "../../lib/api";
import Button from "../../components/ui/Button";
import { useDialog } from "../../context/DialogContext";

const AUDIENCES: { value: string; label: string; hint: string }[] = [
  { value: "test", label: "Just me (test)", hint: "Send only to your own address to check it." },
  { value: "users", label: "All users", hint: "Every registered account." },
  { value: "leads", label: "Bot Check leads", hint: "People who scanned a site and left an email (not yet customers)." },
  { value: "custom", label: "Specific addresses", hint: "Paste addresses below, separated by commas or new lines." },
];

const STARTER = `<p>Hi there,</p>
<p>Write your message here. You can use simple HTML — <b>bold</b>, <a href="https://trynobot.com">links</a>, and paragraphs.</p>
<p>— The TryNoBot team</p>`;

export default function AdminEmail() {
  const { confirm, notify } = useDialog();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(STARTER);
  const [mode, setMode] = useState("test");
  const [emails, setEmails] = useState("");
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);

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
            <label className="text-sm font-semibold">Body (HTML)</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12}
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
            <p className="mt-1 text-xs text-fg-dim">Simple HTML only: paragraphs, bold/italic, links. The header, footer and styling are added automatically.</p>
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

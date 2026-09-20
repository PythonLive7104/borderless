import { useState } from "react";
import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import { contactApi, errText } from "../../lib/api";
import { useSeo } from "../../lib/seo";

const FIELDS = [
  { key: "name", label: "Full name", type: "text", placeholder: "Jane Marketer", required: true },
  { key: "email", label: "Work email", type: "email", placeholder: "jane@company.com", required: true },
  { key: "company", label: "Company", type: "text", placeholder: "Acme Media", required: false },
] as const;

type Field = (typeof FIELDS)[number]["key"];

export default function Contact() {
  useSeo("Contact", "Get in touch with the TryNoBot team — questions about plans, onboarding or the API.");
  const [form, setForm] = useState<Record<Field | "message", string>>({
    name: "", email: "", company: "", message: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set = (k: Field | "message") => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await contactApi.send(form);
      if (!res.ok) throw new Error(res.error || "");
      setSent(true);
    } catch (err: any) {
      // Never claim the message was sent when it wasn't — the page promises a
      // reply, so a silent failure is worse than showing the fallback address.
      setError(errText(err?.data, err?.message) ||
        "We couldn't send that. Please email support@trynobot.com directly.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-16 text-center">
          <Badge tone="light">Contact</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">Talk to our team</h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">Questions about plans, onboarding or the API? We usually reply within one business day.</p>
        </div>
      </section>
      <Section>
        <div className="mx-auto max-w-xl">
          {sent ? (
            <div className="card shadow-soft p-8 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <h3 className="mt-4 text-lg font-bold">Message sent</h3>
              <p className="mt-2 text-sm text-fg-muted">Thanks for reaching out — we'll get back to you within one business day.</p>
            </div>
          ) : (
            <form className="card shadow-soft space-y-4 p-7" onSubmit={submit}>
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label htmlFor={f.key} className="mb-1.5 block text-sm font-semibold">{f.label}</label>
                  <input id={f.key} name={f.key} required={f.required} type={f.type}
                    value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder}
                    className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                </div>
              ))}
              <div>
                <label htmlFor="message" className="mb-1.5 block text-sm font-semibold">How can we help?</label>
                <textarea id="message" name="message" required rows={4}
                  value={form.message} onChange={set("message")}
                  placeholder="Tell us about your traffic volume and goals…"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              {error && (
                <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={sending}>
                {sending ? "Sending…" : "Send message"}
              </Button>
              <p className="text-center text-xs text-fg-muted">
                Or email us at{" "}
                <a href="mailto:support@trynobot.com" className="font-semibold text-brand">support@trynobot.com</a>
              </p>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}

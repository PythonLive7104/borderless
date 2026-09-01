import { useState } from "react";
import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

export default function Contact() {
  const [sent, setSent] = useState(false);
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
              <p className="mt-2 text-sm text-fg-muted">Thanks for reaching out — we'll get back to you shortly.</p>
            </div>
          ) : (
            <form className="card shadow-soft space-y-4 p-7" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              {[["Full name", "text", "Jane Marketer"], ["Work email", "email", "jane@company.com"], ["Company", "text", "Acme Media"]].map(([l, t, ph]) => (
                <div key={l}>
                  <label className="mb-1.5 block text-sm font-semibold">{l}</label>
                  <input required type={t} placeholder={ph}
                    className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-sm font-semibold">How can we help?</label>
                <textarea required rows={4} placeholder="Tell us about your traffic volume and goals…"
                  className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
              </div>
              <Button type="submit" className="w-full">Send message</Button>
            </form>
          )}
        </div>
      </Section>
    </>
  );
}

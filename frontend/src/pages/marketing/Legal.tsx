import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";

const CONTENT: Record<string, { title: string; intro: string; sections: [string, string][] }> = {
  terms: {
    title: "Terms of Service",
    intro: "These terms govern your use of the TrackAudit platform. This is placeholder MVP copy — replace with counsel-reviewed terms before launch.",
    sections: [
      ["Acceptable use", "TrackAudit may be used only for legitimate traffic-quality, fraud detection and analytics. Using it to deceive advertising networks or evade platform enforcement is prohibited."],
      ["Accounts", "You are responsible for safeguarding your credentials and API keys, and for all activity under your workspace."],
      ["Billing", "Paid plans are billed monthly. Usage limits and overage behavior are described on the pricing page."],
      ["Termination", "You may cancel anytime. We may suspend accounts that violate the acceptable-use policy."],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: "We take privacy seriously. This is placeholder MVP copy — replace with a counsel-reviewed policy before launch.",
    sections: [
      ["Data we collect", "We process traffic signals needed to score visits: network, device, geo and behavioral data. We minimize collection to what's required."],
      ["How we use data", "To classify traffic, detect fraud, and produce analytics for your workspace. We do not sell personal data."],
      ["Retention & deletion", "Retention is configurable per plan. You can request export or deletion of workspace data."],
      ["Your responsibilities", "As a customer deploying tracking, you are responsible for disclosing tracking to your visitors and honoring applicable data-protection laws."],
    ],
  },
};

export default function Legal({ kind }: { kind: "terms" | "privacy" }) {
  const c = CONTENT[kind];
  return (
    <>
      <section className="hero-band relative overflow-hidden">
        <div className="binary-grid absolute inset-0 opacity-70" />
        <div className="container-page relative py-14 text-center">
          <Badge tone="light">Legal</Badge>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{c.title}</h1>
        </div>
      </section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-fg-muted">{c.intro}</p>
          <div className="mt-8 space-y-8">
            {c.sections.map(([h, b]) => (
              <div key={h}>
                <h2 className="text-lg font-bold">{h}</h2>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

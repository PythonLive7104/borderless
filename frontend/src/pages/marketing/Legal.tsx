import { Section } from "../../components/ui/Section";
import Badge from "../../components/ui/Badge";
import { COMPANY, companyLine } from "../../lib/company";
import { useSeo } from "../../lib/seo";

const ENTITY = COMPANY.legalName || "TryNoBot";
const JURISDICTION = COMPANY.jurisdiction || "the jurisdiction in which TryNoBot is established";

type Content = { title: string; intro: string; sections: [string, string][] };

const CONTENT: Record<string, Content> = {
  terms: {
    title: "Terms of Service",
    intro: `These terms govern your use of TryNoBot, operated by ${ENTITY}. By creating a workspace or using the API you agree to them.`,
    sections: [
      ["The service", "TryNoBot scores incoming web traffic in real time and classifies each visit as human, suspicious, bot or fraud, with the signals behind every score. It is provided as-is for traffic-quality measurement, fraud detection and analytics."],
      ["Acceptable use", "TryNoBot may be used only for legitimate traffic-quality, fraud detection and analytics purposes. Using it to deceive advertising networks, to serve reviewers or crawlers different content from real visitors, or to evade platform enforcement is prohibited and will result in termination without refund. We identify ad-network review bots so you can report on them, never so you can hide from them."],
      ["Your account", "You are responsible for safeguarding your credentials and API keys, and for all activity in your workspace. You must have the right to deploy tracking on any site you add, and you are responsible for disclosing that tracking to your own visitors."],
      ["Plans and billing", "Plans are prepaid for a fixed access period — either one week or one month, chosen at checkout — and are not charged automatically. Payment is taken in cryptocurrency through our payment provider (Bachs). When you renew before your current period ends, unused days carry over. Prices and the limits attached to each plan are set out on the pricing page and may change with notice; a change never alters a period you have already paid for."],
      ["Free trial", "New workspaces get a 14-day trial with full functionality. When the trial ends, access to the dashboard is restricted until a plan is purchased. Your data is retained for the period set out below."],
      ["Cancellation and refunds", "There is nothing to cancel: access simply ends when your paid period runs out, and we never charge you again without an explicit purchase. Because a period is prepaid, we do not pro-rate part-used periods. If something went wrong — a failed payment, a duplicate purchase, a service problem — contact us and we will put it right. Consumers in the United Kingdom and the EU keep any statutory cancellation rights that apply to them; those rights are not affected by this section."],
      ["Availability", "We work to keep the service running continuously and publish live component health on our status page, but we do not offer a contractual uptime guarantee. Scoring is designed to fail open: if the decision service is unreachable, traffic is allowed through rather than blocked."],
      ["Your data", "You own the traffic data in your workspace. We process it to provide the service, as described in the Privacy Policy. You can export or delete it at any time, and we will delete it on request."],
      ["Termination", "You may stop using the service at any time. We may suspend or terminate a workspace that breaches the acceptable-use section, that is used unlawfully, or that puts the service or other customers at risk."],
      ["Liability", "The service is provided without warranties of any kind to the extent the law allows. Nothing in these terms limits liability that cannot lawfully be limited. Otherwise our total liability is limited to the amount you paid us in the three months before the claim arose."],
      ["Governing law", `These terms are governed by the laws of ${JURISDICTION}, and disputes are subject to the courts there.`],
      ["Changes and contact", `We will post any material change to these terms on this page and update the date above. Questions: ${COMPANY.supportEmail}.`],
    ],
  },
  privacy: {
    title: "Privacy Policy",
    intro: `This policy explains what ${ENTITY} does with personal data when you use TryNoBot, and when TryNoBot runs on a site you visit.`,
    sections: [
      ["Our two roles", "For account, billing and support data we are the controller — we decide how it is used. For traffic data collected by the tracker on a customer's website, our customer is the controller and we are their processor: we handle it on their instructions and for no purpose of our own. If you are a visitor to a site running TryNoBot and want your data removed, contact that site's operator; contact us and we will help them act."],
      ["Data we collect about visitors", "To tell a real person from automation we process: IP address and what it resolves to (country, network, whether it is a datacenter, proxy or VPN), user-agent and derived device, browser and OS, a browser fingerprint, TLS fingerprints (JA3/JA4), page and referrer, and interaction signals such as pointer movement, scrolling and typing cadence — recorded as characteristics of the movement, not as the content typed. We do not collect form contents, passwords or payment details through the tracker."],
      ["Data we collect about customers", "Name, email, password hash, workspace and team membership, plan and payment records from our payment provider, support correspondence, and the email address of anyone who requests a Bot Check report."],
      ["Why we are allowed to process it", "Traffic signals are processed on the basis of legitimate interests — our customers' interest in preventing fraud and abuse against their own sites, and ours in running a secure service. We have weighed that against visitors' interests; the data is limited to what detection requires and is never used to build advertising profiles or sold. Account and billing data is processed to perform our contract with you, and marketing email is sent with consent, which you can withdraw at any time."],
      ["Cookies and similar technologies", "The tracker stores an identifier so repeat visits can be recognised — that is what makes bot detection work. On our own marketing site we use analytics and advertising cookies only if you accept them: the consent banner defaults to denied, and declining leaves only what the site needs to function."],
      ["Who we share it with", "Service providers who process data on our behalf, under contract: our hosting and network providers, our email provider (Resend), our payment provider (Bachs), and IP reputation providers used in scoring (including IPQualityScore). We do not sell personal data or share it for cross-context behavioural advertising. We disclose data to authorities only where legally required."],
      ["International transfers", "Our providers may process data outside your country, including in the United States. Where data protected by UK or EU law is transferred, we rely on the appropriate safeguards those laws require, such as standard contractual clauses."],
      ["How long we keep it", "Traffic data is retained for the window attached to the customer's plan, then deleted automatically. Account and billing records are kept while the account is open and afterwards only as long as tax and accounting law requires. Bot Check lead records are kept until you ask us to delete them; an unsubscribe is kept permanently so we can honour it."],
      ["Your rights", "Depending on where you live you may have rights to access, correct, delete or export your data, to object to or restrict processing, and to withdraw consent. UK and EU residents may complain to their supervisory authority — in the UK, the Information Commissioner's Office. Canadian residents have rights under PIPEDA and may complain to the Office of the Privacy Commissioner. Australian residents have rights under the Privacy Act 1988 and may complain to the OAIC. California residents have rights under the CCPA/CPRA, including the right not to be discriminated against for exercising them."],
      ["Marketing email", "If you asked us for a Bot Check report we may follow up about it. Every such email identifies us, carries our postal address and has a working unsubscribe link; one click stops all of it immediately."],
      ["Security", "Data is encrypted in transit. Access to production data is restricted to staff who need it. No system is perfectly secure, and we will notify affected people and regulators where the law requires it."],
      ["Contact", `Privacy questions and rights requests: ${COMPANY.privacyEmail}. Postal: ${companyLine() || "see the contact page"}.`],
    ],
  },
};

export default function Legal({ kind }: { kind: "terms" | "privacy" }) {
  const c = CONTENT[kind];
  useSeo(c.title, kind === "terms"
    ? "The terms that govern use of TryNoBot, including acceptable use, billing and cancellation."
    : "What TryNoBot does with personal data, why, who we share it with and the rights you have.");
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
          <p className="mt-2 text-xs text-fg-dim">Last updated {COMPANY.legalUpdated}</p>
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

import { Section, SectionHead } from "../ui/Section";
import Button from "../ui/Button";
import { useCta } from "../../lib/useCta";
import { IArrow, IUsers, ICard, ICheck } from "../ui/icons";

/** The referral programme, on the marketing site.
 *
 *  Here for two reasons beyond telling existing customers about it. It is a
 *  reason to sign up before you need the product — the credit accrues whether
 *  or not you are paying — and it is one of the few things on this site a
 *  competitor cannot match by shipping a feature.
 *
 *  Every number comes from the backend's own constants (REWARD_CENTS = 200,
 *  Basic at $69/month), so the maths below is checkable rather than aspirational.
 *  If the reward changes, this copy has to change with it.
 */
const STEPS: [typeof IUsers, string, string][] = [
  [IUsers, "Share your link",
   "Every account gets one. It's in your dashboard the moment you sign up — no application, no approval."],
  [ICard, "They pay, you earn",
   "You get $2 in credit each time someone you referred pays. Not just their first payment — every renewal, for as long as they stay."],
  [ICheck, "Spend it on your own plan",
   "Once your balance covers a plan, use it to buy or renew. No payout threshold, no waiting, no invoicing us."],
];

export default function ReferralBand() {
  const cta = useCta();
  return (
    <Section className="bg-bg-soft rounded-none">
      <SectionHead eyebrow="Refer & earn"
        title="Get your protection paid for by your network"
        sub="Refer other advertisers and earn $2 every time one of them pays — then put the credit straight onto your own plan." />

      <div className="mt-14 grid gap-5 lg:grid-cols-3">
        {STEPS.map(([Icon, title, desc], i) => (
          <div key={title} className="card shadow-soft relative p-6">
            <div className="absolute right-5 top-5 text-4xl font-black text-line">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand/10 text-brand">
              <Icon width={22} />
            </div>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{desc}</p>
          </div>
        ))}
      </div>

      {/* The arithmetic, stated plainly. A referral programme that doesn't show
          its own maths invites the reader to assume the worst of it. */}
      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-brand/25 bg-brand/5 p-7 text-center">
        <p className="text-lg font-bold text-fg">
          Refer 35 advertisers who stay on Basic monthly, and your own plan costs you nothing.
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-fg-muted">
          $2 a month each against $69 a month. Agencies and consultants who recommend us to the
          clients they manage tend to get there first — and the credit keeps arriving every month
          those clients renew.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button to={cta.signupHref} size="lg">{cta.label("Start free and get your link")} <IArrow width={18} /></Button>
          <Button to="/pricing" variant="outline" size="lg">See plan prices</Button>
        </div>
        <p className="mt-4 text-xs text-fg-dim">
          Credit is earned on payments only, never on signups, and it can't be earned by referring
          yourself. There's no cap on how much you can earn.
        </p>
      </div>
    </Section>
  );
}

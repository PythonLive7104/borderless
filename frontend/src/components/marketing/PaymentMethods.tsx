import { usePaymentMethods } from "../../lib/usePaymentMethods";

const COINS = [
  { s: "₿", n: "Bitcoin", bg: "#f7931a" },
  { s: "Ξ", n: "Ethereum", bg: "#627eea" },
  { s: "₮", n: "Tether", bg: "#26a17b" },
  { s: "$", n: "USDC", bg: "#2775ca" },
  { s: "◈", n: "TON", bg: "#0098ea" },
];

const CARDS = [
  { n: "Visa", fg: "#1a1f71", label: "VISA" },
  { n: "Mastercard", fg: "#eb001b", label: "MC" },
  { n: "American Express", fg: "#2e77bc", label: "AMEX" },
];

function CardMark({ label, fg }: { label: string; fg: string }) {
  return (
    <span className="grid h-11 min-w-[3.25rem] place-items-center rounded-lg bg-white px-2 text-[11px] font-black tracking-tight shadow-soft ring-1 ring-line"
      style={{ color: fg }}>{label}</span>
  );
}

/** Accepted payment methods, read from the API rather than hard-coded.
 *
 *  Card and crypto both settle through the same Bachs hosted checkout, but
 *  card is a merchant-side switch — so the page asks what checkout can
 *  actually complete instead of promising something it can't honour. While
 *  the answer is in flight we render nothing rather than guessing.
 */
export default function PaymentMethods({ compact = false }: { compact?: boolean }) {
  const methods = usePaymentMethods();
  if (!methods) return null;

  const heading = methods.card
    ? "Pay by card or cryptocurrency"
    : "We accept cryptocurrency";

  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-fg-muted">{heading}</p>
      <div className={`${compact ? "mt-3" : "mt-5"} flex flex-wrap items-center justify-center gap-3`}>
        {methods.card && CARDS.map((c) => <CardMark key={c.n} label={c.label} fg={c.fg} />)}
        {methods.card && methods.crypto && (
          <span className="mx-1 hidden h-8 w-px bg-line sm:block" aria-hidden />
        )}
        {methods.crypto && COINS.map((c) => (
          <span key={c.n} title={c.n}
            className="grid h-11 w-11 place-items-center rounded-full text-lg font-bold text-white shadow-soft ring-4 ring-white"
            style={{ background: c.bg }}>{c.s}</span>
        ))}
      </div>
    </div>
  );
}

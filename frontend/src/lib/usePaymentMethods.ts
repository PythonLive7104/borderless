import { useEffect, useState } from "react";
import { billingApi, type PaymentMethods } from "./api";

/** What checkout can actually complete, asked once per mount.
 *
 *  Returns null until the answer arrives. Callers render nothing (or neutral
 *  wording) while it's null rather than guessing — naming a payment method the
 *  hosted checkout won't offer is the failure this hook exists to prevent.
 */
export function usePaymentMethods(): PaymentMethods | null {
  const [methods, setMethods] = useState<PaymentMethods | null>(null);
  useEffect(() => {
    let live = true;
    billingApi.paymentMethods()
      .then((m) => { if (live) setMethods(m); })
      .catch(() => { /* stay null — say nothing rather than something wrong */ });
    return () => { live = false; };
  }, []);
  return methods;
}

/** "by card or cryptocurrency" / "by card" / "in cryptocurrency", or "" when
 *  we don't know yet — so the sentence around it has to read correctly without. */
export function methodPhrase(m: PaymentMethods | null): string {
  if (!m) return "";
  if (m.card && m.crypto) return " by card or cryptocurrency";
  if (m.card) return " by card";
  if (m.crypto) return " in cryptocurrency";
  return "";
}

/** The processing fee on a given price, to the cent, as checkout charges it.
 *  Returns 0 when there's nothing to disclose or the answer hasn't arrived. */
export function feeOn(m: PaymentMethods | null, price: number): number {
  if (!m || (!m.fee_pct && !m.fee_fixed)) return 0;
  return Math.round((price * m.fee_pct / 100 + m.fee_fixed) * 100) / 100;
}

const usd = (n: number) => `$${n.toFixed(2)}`;

/** "+ $1.65 processing fee · $26.65 total" for one plan price, or "" when
 *  there's no fee. Quoting the amount rather than a rate matters here: the fee
 *  is percent + fixed, so a single percentage is wrong at both ends of the
 *  range — 6.6% on the cheapest plan, 5.27% on the dearest. */
export function feeLine(m: PaymentMethods | null, price: number): string {
  const fee = feeOn(m, price);
  if (!fee) return "";
  return `+ ${usd(fee)} processing fee · ${usd(price + fee)} total`;
}

/** The general statement for the hero, footnote and FAQ, e.g.
 *  "a 5% + $0.40 payment processing fee". "" when there's nothing to say. */
export function feeNote(m: PaymentMethods | null): string {
  if (!m || (!m.fee_pct && !m.fee_fixed)) return "";
  if (!m.fee_fixed) return `a ${m.fee_pct}% payment processing fee`;
  if (!m.fee_pct) return `a ${usd(m.fee_fixed)} payment processing fee`;
  return `a ${m.fee_pct}% + ${usd(m.fee_fixed)} payment processing fee`;
}

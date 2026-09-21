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

/** "plus a 5.6% payment processing fee" — or "" when there's no fee to
 *  disclose, or the answer hasn't arrived. Trimmed to at most one decimal so
 *  the page never prints a long float at someone. */
export function feeNote(m: PaymentMethods | null): string {
  if (!m?.fee_pct) return "";
  const pct = Math.round(m.fee_pct * 10) / 10;
  return `plus a ${pct}% payment processing fee`;
}

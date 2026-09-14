import { useAuth } from "../context/AuthContext";

/**
 * Marketing CTA targets that respect login state. A signed-in visitor clicking
 * "Start Free" should land in their dashboard, not the signup form (and a
 * pricing CTA should go to Billing, where they actually change plans).
 */
export function useCta() {
  const { user } = useAuth();
  const authed = !!user;
  return {
    authed,
    signupHref: authed ? "/dashboard" : "/signup",
    pricingHref: authed ? "/dashboard/billing" : "/signup",
    // Swap a signup-y label for a dashboard one when already logged in.
    label: (loggedOut: string) => (authed ? "Go to dashboard" : loggedOut),
  };
}

// Legal identity, in one place.
//
// These details appear in the Terms, the Privacy Policy, the site footer and
// every commercial email. They are also what Google Ads checks during
// advertiser identity verification: the entity named here has to match the
// documents submitted there and the domain's registration, or verification
// fails and the account cannot serve ads.
//
// FILL THESE IN BEFORE LAUNCH. The backend has the matching settings
// (COMPANY_LEGAL_NAME / COMPANY_ADDRESS) for the email footers.
export const COMPANY = {
  /** Registered legal entity name, exactly as incorporated. */
  legalName: "Mailiondev Technology Ltd",
  /** CAC registration number, incorporated 20 January 2026. */
  registration: "RC 9233525",
  /** Full postal address, on one line. Published in the site footer, the
   *  privacy policy and the footer of every commercial email — where a postal
   *  address is a legal requirement in the US, Canada and Australia. */
  address: "2 Okanlomo Street, Apete, Obantoko, Ogun State, Nigeria",
  /** Governing-law jurisdiction for the Terms. */
  jurisdiction: "the Federal Republic of Nigeria",
  supportEmail: "support@trynobot.com",
  privacyEmail: "privacy@trynobot.com",
  /** Shown as "Last updated" on the legal pages. */
  legalUpdated: "20 September 2026",
};

/** The entity line used in footers. Falls back to the brand name so a
 *  half-configured build never renders a dangling comma or a blank address. */
export function companyLine(): string {
  return [COMPANY.legalName, COMPANY.registration, COMPANY.address]
    .filter(Boolean).join(" · ");
}

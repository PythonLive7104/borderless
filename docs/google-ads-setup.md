# Google Ads integration — operator setup

The Google Ads integration lets TryNoBot write a campaign's worst offending IP
addresses into the advertiser's Google Ads account as **campaign IP exclusions**,
so they stop paying for those clicks at the source. Blocking a visitor at the
website only stops them seeing the page — the click is already charged.

The code ships **inert**: with no credentials set, the feature is invisible and
nothing calls Google. This document is the checklist to turn it on.

Everything that needs **you** (an account, a decision, a form Google reviews) is
here. The only remaining code task is implementing the one live API call, which
waits until after Google approves you — see phase E.

---

## A. Ship now — no Google needed

- [ ] **Commit, push, and `bash update.sh`** on the server. This deploys the
      campaign-ID capture (migration `0012`), the exclusion allocator, the
      Google Ads scaffolding (migration `0002`), and the Connect UI. All of it
      stays inert until the env vars in phase C are set, so deploying before any
      Google setup is safe.
- [ ] The exclusion **dry-run plan works immediately** after deploy — before any
      Google connection — because it reads only your own stored traffic:

      GET /api/integrations/google-ads/exclusion-plan/?organization=<id>&campaign_id=<cid>

      Use it to show a prospect "here are the IPs we'd exclude from this
      campaign, and why" with no account connected.

## B. Google account setup — the long pole, start first

Access level now attaches to your **Google Cloud project** (the standalone
developer token was sunset in September 2026).

- [ ] **Brand verification** (Google Cloud Console): logo, display name, and
      verified ownership of `trynobot.com`. **Do this first** — it gates both
      API access and OAuth verification and is pure waiting time (~2–3 business
      days). The homepage must describe the product, not just be a login page.
- [ ] **Use a dedicated Cloud project**, separate from the one used for Safe
      Browsing / VirusTotal, because this one becomes customer-facing.
- [ ] **Enable the Google Ads API** on that project → grants **Test** access
      automatically (test accounts only).
- [ ] **Apply for Explorer access** on the Ads API Overview page
      (2,880 production ops/day — enough for a pilot). Apply for **Basic**
      (15,000/day) when you outgrow it; brand verification is a prerequisite.
- [ ] **Create an OAuth client** (type: Web application) and configure the
      **consent screen** (External user type, scope
      `https://www.googleapis.com/auth/adwords`).
- [ ] **Register the redirect URI** on that OAuth client, matching the env var in
      phase C *exactly*:

      https://YOUR-DOMAIN/api/integrations/google-ads/callback/

Known issues to watch (check Google's current docs, these move):
- A review backlog was reported in Feb 2026.
- Some projects upgraded after the Sept 2026 sunset return `AUTHORIZATION_ERROR`
  on production calls — the Overview page in your Cloud Console is the
  authoritative access-level check, not the docs.

## C. Wire up credentials — after B gives you client id/secret

Add to `.env` on the server:

```
GOOGLE_ADS_CLIENT_ID=<from your OAuth client>
GOOGLE_ADS_CLIENT_SECRET=<from your OAuth client>
GOOGLE_ADS_REDIRECT_URI=https://YOUR-DOMAIN/api/integrations/google-ads/callback/
GOOGLE_ADS_DEVELOPER_TOKEN=        # optional now; set only if a client lib wants it
GOOGLE_ADS_LOGIN_CUSTOMER_ID=      # optional; only if routing via a manager account
GOOGLE_ADS_LIVE_PUSH=0             # MUST stay 0 until phase E
```

- [ ] Add the three required values (`CLIENT_ID`, `CLIENT_SECRET`,
      `REDIRECT_URI`). Redeploy.
- [ ] The **"Connect Google Ads" card** now appears on the Integrations page.
      Confirm it shows for an Owner/Admin.

## D. Get verified — needs the connect flow from C working

- [ ] **Record the demo video** sensitive-scope verification requires: a user
      granting consent on the live connect flow, and the scope being used (the
      exclusion plan). The flow has to exist to film it — that's why C precedes D.
- [ ] **Submit sensitive-scope verification** with a per-scope justification plus
      the video (~3–5 business days). Your privacy policy must explicitly cover
      reading and writing Google Ads data on the customer's behalf.

Until verified, the app is capped at 100 OAuth users — fine for a pilot.

## E. Go live — after approval and testing

- [ ] Ask the engineer to **implement `_mutate()`** in
      `backend/apps/integrations/googleads_push.py`. It is deliberately
      `NotImplementedError` — the one real Google API call, left unwritten so an
      untested path can never fire against a real account.
- [ ] **Test against a Google _test_ account first**, with
      `GOOGLE_ADS_LIVE_PUSH=1`, before any customer account.
- [ ] Once confirmed, leave `GOOGLE_ADS_LIVE_PUSH=1`. The push is live.

---

## What stays true regardless (set expectations with customers)

- It prevents **future** charges; it does **not** refund clicks already billed.
- Google caps IP exclusions at ~**500 per campaign**, so the allocator spends
  that budget on the highest-cost offenders and collapses busy ranges into one
  entry. It is an allocation, not a full sync.
- Performance Max campaigns historically don't support IP exclusions.
- Fraud from rotating residential/mobile IPs has a low exclusion ceiling — which
  is exactly why the server-side Shield still matters.

## Safety properties built into the code

- **Inert when unconfigured** — no credentials, no feature, no calls.
- **Signed OAuth state** — the callback trusts who began the flow via a signed,
  time-limited token; forged/replayed/expired states connect nothing, and a
  grant from someone who has since lost manager rights is refused.
- **Double-gated live push** — the real mutate needs credentials *and*
  `GOOGLE_ADS_LIVE_PUSH=1`; otherwise every push is a dry run that reports what
  it would change and changes nothing.

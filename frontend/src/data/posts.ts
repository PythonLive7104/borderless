/** Blog content, as structured blocks rather than Markdown.
 *
 *  There is no Markdown dependency in this project and adding one to render
 *  four posts would be a worse trade than typing the structure out: these
 *  blocks server-render through the existing prerender pipeline with no new
 *  runtime, and the shape is typed, so a malformed post is a build error
 *  rather than a broken page.
 *
 *  Why these posts specifically. Each one targets a search a buyer makes
 *  BEFORE they know vendors exist — "is my google ads traffic real", "what is
 *  a datacenter ip", "invalid click rate" — which is where this category is
 *  actually won. Paid search for "click fraud protection" costs $8-25 a click
 *  and sends traffic to a vendor comparison; these pages cost nothing per
 *  visit and arrive earlier in the decision.
 *
 *  House rules, carried over from the rest of the site: no volume or
 *  performance claim we cannot substantiate on request, no invented statistic,
 *  and where an industry figure is quoted it is attributed to whoever is
 *  claiming it rather than stated as fact.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  /** A pulled-out caution or aside. */
  | { kind: "note"; text: string }
  | { kind: "code"; lang: string; code: string }
  /** Simple two-column reference table. */
  | { kind: "table"; head: [string, string]; rows: [string, string][] };

export interface Post {
  slug: string;
  title: string;
  /** Meta description and the excerpt on the index. */
  description: string;
  /** ISO date. Shown, and used to sort the index. */
  date: string;
  /** Rough minutes, for the index. Honest estimate, not padding. */
  readMinutes: number;
  /** Grouping label on the index. */
  tag: string;
  blocks: Block[];
  /** Internal links out, so no post is a dead end. */
  related?: { label: string; to: string }[];
}

export const POSTS: Post[] = [
  {
    slug: "how-to-tell-if-your-google-ads-traffic-is-real",
    title: "How to tell if your Google Ads traffic is real",
    description:
      "Seven checks you can run in Google Ads and Analytics today, with no tools, to work out whether you are paying for people or for automation.",
    date: "2026-10-07",
    readMinutes: 9,
    tag: "Diagnostics",
    blocks: [
      { kind: "p", text: "Before buying anything, find out whether you have a problem. Most of the useful signal is already sitting in your Google Ads and Analytics accounts, and the checks below cost nothing but an hour. If they all come back clean, you do not need a fraud tool — and any vendor who tells you otherwise is selling, not diagnosing." },
      { kind: "h2", text: "1. Read your invalid click credits" },
      { kind: "p", text: "Google filters some invalid traffic before it bills you, and issues credits for what it catches after the fact. In Google Ads, add the Invalid clicks and Invalid click rate columns to your campaign view and look at the last 90 days. This is Google grading its own homework, so treat it as a floor rather than a total — but a number that jumps in one campaign or on one keyword tells you where to look." },
      { kind: "note", text: "There is no official Google benchmark for a normal invalid click rate. Vendors quote various thresholds; the most meaningful comparison is your own account over time, and one campaign against another." },
      { kind: "h2", text: "2. Compare click counts to session counts" },
      { kind: "p", text: "Put Google Ads clicks next to Analytics sessions for the same campaign and date range. A gap is normal — people bounce before the tag fires, and tracking is imperfect. A large and widening gap, especially on one campaign, means a meaningful share of clicks never became a real page view." },
      { kind: "h2", text: "3. Look at time-on-page distribution, not the average" },
      { kind: "p", text: "Averages hide this completely. What you want is the shape: a healthy landing page has sessions scattered across a few seconds to a few minutes. Automation clusters, often tightly, at the very bottom. A spike of hundreds of sessions at under two seconds is not impatient humans." },
      { kind: "h2", text: "4. Check the hour-of-day curve" },
      { kind: "p", text: "Segment clicks by hour in the advertiser's own timezone. Real demand follows waking hours for the geography you are targeting. A flat line across the night, or a sharp burst at a consistent odd hour, is a scheduling artefact of something automated." },
      { kind: "h2", text: "5. Check geography against your targeting" },
      { kind: "p", text: "Pull the Locations report, then the user locations rather than the matched locations. Clicks from countries you are not targeting are not necessarily fraud — VPNs and travellers exist — but a concentration from one unexpected region is worth a closer look." },
      { kind: "h2", text: "6. Look for repeated IPs and identical device profiles" },
      { kind: "p", text: "Google Ads does not show you visitor IPs, so this one has to come from your own server logs or analytics. What you are looking for is the same IP, or the same exact device-and-browser string, appearing many times across a short window against a paid landing page." },
      { kind: "h2", text: "7. Reconcile spend with conversions at the keyword level" },
      { kind: "p", text: "A keyword that takes a healthy share of spend and produces no conversions over hundreds of clicks is either badly matched or not being clicked by buyers. Both are worth fixing; only one of them is a fraud problem, which is why this check comes last rather than first." },
      { kind: "h2", text: "What the results mean" },
      { kind: "table", head: ["What you found", "What it usually means"], rows: [
        ["High invalid click rate, one campaign", "Worth investigating that campaign's placements and keywords first"],
        ["Clicks far above sessions", "Clicks that never render a page — scripted clients, or a broken tag"],
        ["Sessions clustered under 2 seconds", "Automation that loads and leaves"],
        ["Flat overnight click volume", "Something running on a schedule, not human demand"],
        ["Spend with no conversions at all", "Could be fraud, could be a mismatched keyword — check intent before blaming bots"],
      ] },
      { kind: "p", text: "If several of these point the same way, you have something worth filtering. If only the last one does, your problem is more likely campaign structure than fraud, and a filtering tool will not fix it." },
      { kind: "h2", text: "Running the same checks continuously" },
      { kind: "p", text: "The checks above are a snapshot. The reason tooling exists is that doing them weekly, per campaign, by hand does not survive contact with a real workload. TryNoBot scores each visit as it lands and shows the signals behind the score, which is the same diagnosis on a continuous basis — but run the manual pass first, because knowing your own numbers is what lets you judge whether any tool is earning its price." },
    ],
    related: [
      { label: "Run a free bot exposure check on your site", to: "/bot-check" },
      { label: "What a datacenter IP is, and why it matters", to: "/blog/what-is-a-datacenter-ip" },
    ],
  },
  {
    slug: "what-is-a-datacenter-ip",
    title: "What is a datacenter IP, and why does it matter for ads?",
    description:
      "Datacenter, residential and mobile IPs explained — how to tell them apart, why blocking datacenter traffic is the highest-value first rule, and when blocking it is the wrong call.",
    date: "2026-09-29",
    readMinutes: 7,
    tag: "Fundamentals",
    blocks: [
      { kind: "p", text: "Almost every conversation about ad fraud ends up at datacenter IPs, usually without anyone defining the term. It is worth getting right, because a single rule based on it removes more junk traffic than anything else you can configure in an afternoon — and because applied carelessly it will block customers." },
      { kind: "h2", text: "The three kinds of address" },
      { kind: "h3", text: "Residential" },
      { kind: "p", text: "Assigned by a consumer ISP to a home connection. Almost all of your genuine desktop traffic arrives this way. Expensive to acquire at scale, which is exactly why fraud operations prefer not to." },
      { kind: "h3", text: "Mobile" },
      { kind: "p", text: "Assigned by a carrier to a phone network. These are shared aggressively — thousands of real people can appear behind one address in a day — which is why rate-limiting by IP alone misfires badly on mobile traffic." },
      { kind: "h3", text: "Datacenter" },
      { kind: "p", text: "Assigned to a hosting provider: AWS, Google Cloud, Azure, DigitalOcean, OVH, Hetzner and hundreds of smaller ones. Nobody browses from a server rack for fun. Legitimate traffic from these ranges is overwhelmingly machine traffic." },
      { kind: "h2", text: "How an address is identified" },
      { kind: "p", text: "Every IP belongs to an Autonomous System, identified by an ASN, and the ASN is registered to an organisation. The registry is public. Hosting providers register their ranges as hosting, so the classification is a lookup rather than a guess — which is why datacenter detection is reliable in a way that behavioural detection is not." },
      { kind: "note", text: "This is also why datacenter detection is the one signal worth acting on with high confidence. It does not depend on inference about how someone moved their mouse." },
      { kind: "h2", text: "What legitimately comes from a datacenter" },
      { kind: "p", text: "Blocking all of it blindly is a mistake. The following are machine traffic you want to arrive:" },
      { kind: "ul", items: [
        "Search engine crawlers — Googlebot, Bingbot. Block these and you lose organic rankings.",
        "Ad platform review crawlers, which check that your landing page matches your ad. Block these and your ads get disapproved.",
        "Uptime monitors and your own health checks.",
        "Link preview fetchers from Slack, WhatsApp, Discord, LinkedIn and others.",
        "Corporate VPN exits, which can be registered to hosting ranges — real employees, real buyers.",
      ] },
      { kind: "p", text: "The last one is the reason a blanket block is risky, and the first two are the reason it can quietly cost you far more than the fraud it prevented. Verified search and ad-review crawlers must be served exactly what a human is served; identifying them is for reporting, never for showing them something different." },
      { kind: "h2", text: "A sane first rule" },
      { kind: "p", text: "The rule that catches the most junk with the least collateral damage is: block datacenter and hosting traffic on paid landing pages only, with verified crawlers allowed through, and watch it for a week before extending it anywhere else." },
      { kind: "ol", items: [
        "Apply it to paid traffic only at first — your organic and direct traffic is not the problem you are solving.",
        "Keep verified search and ad-review crawlers on the allow path, always.",
        "Watch your conversion rate for a week. If it falls, you are blocking buyers, probably behind a corporate VPN.",
        "Only then consider extending it to the rest of the site.",
      ] },
      { kind: "h2", text: "Why the IP alone is not enough" },
      { kind: "p", text: "Serious operations buy residential proxy access, which puts their traffic on ordinary consumer addresses. At that point the IP tells you nothing and you need a signal that does not depend on it — the TLS handshake, for instance, which is determined by the client software rather than the network it sits on. That is the gap JA3 and JA4 fingerprinting is for, and it is a longer subject than this post." },
    ],
    related: [
      { label: "How JA3 and JA4 fingerprinting work", to: "/blog/ja3-ja4-tls-fingerprinting-explained" },
      { label: "How to tell if your Google Ads traffic is real", to: "/blog/how-to-tell-if-your-google-ads-traffic-is-real" },
    ],
  },
  {
    slug: "ja3-ja4-tls-fingerprinting-explained",
    title: "JA3 and JA4 TLS fingerprinting, explained for marketers",
    description:
      "Why the TLS handshake identifies automation that a clean IP and a perfect user-agent cannot hide — and the honest limits of the technique.",
    date: "2026-09-18",
    readMinutes: 8,
    tag: "Detection",
    blocks: [
      { kind: "p", text: "A user-agent string is a claim the client makes about itself, and it can say anything. Changing it is one line of code. This is why detection built on user-agents is trivially defeated, and why the more interesting question is whether there is anything a client cannot easily lie about." },
      { kind: "h2", text: "What happens before any of your code runs" },
      { kind: "p", text: "Every HTTPS connection opens with a TLS handshake. The client sends a ClientHello announcing which TLS versions it supports, which cipher suites it offers and in what order, which extensions it understands, and which elliptic curves it can use. All of this is sent before a single byte of your page, your tag or your headers." },
      { kind: "p", text: "That combination is not arbitrary. It is determined by the TLS library the client was built against. Chrome's ClientHello looks like Chrome. Python's requests library looks like OpenSSL as Python configures it. Go's net/http looks like Go. They are different in ways the person writing the script usually does not know about and cannot casually change." },
      { kind: "h2", text: "From handshake to fingerprint" },
      { kind: "p", text: "JA3 hashes those handshake fields into a single short string. JA4 is the newer scheme and is more robust: it is partly human-readable, and it is deliberately resistant to the cipher-order shuffling that was used to evade JA3." },
      { kind: "code", lang: "text", code: "A real browser and a scripted client, same user-agent:\n\n  Client A  UA: Chrome/120 ...   JA4: t13d1516h2_8daaf6152771_b186095e22b6\n  Client B  UA: Chrome/120 ...   JA4: t13d401h2_8daaf6152771_f9b5f5a5a4d1\n\nThe user-agent is identical. The handshakes are not: Client B\nis a script claiming to be Chrome." },
      { kind: "h2", text: "Why this is hard to defeat" },
      { kind: "p", text: "Faking a user-agent is a string edit. Faking a TLS fingerprint means making your TLS stack behave like a different TLS stack, at the protocol level. It is possible — there are libraries for it — but it is a different order of effort, and the overwhelming majority of automation does not bother." },
      { kind: "h2", text: "The honest limits" },
      { kind: "p", text: "Three of them, and anyone selling this as a complete answer is overselling it:" },
      { kind: "ul", items: [
        "A fingerprint identifies the client software, not the intent. Googlebot has a fingerprint too, and you want Googlebot.",
        "Thousands of real people share one fingerprint, because they all run the same Chrome build. A fingerprint on its own can never be grounds for a block.",
        "Headless Chrome driving a real browser engine produces a fingerprint close to real Chrome. TLS alone will not catch it; that needs behavioural signals.",
      ] },
      { kind: "note", text: "The second limit is the important one. Treating a fingerprint as identity is how a detection system starts blocking real customers. Cardinality is what makes it evidence: how many distinct confirmed-bad addresses have appeared behind this fingerprint. One sighting means nothing. Two hundred, across unrelated sites, means something." },
      { kind: "h2", text: "Where it fits" },
      { kind: "p", text: "TLS fingerprinting is one signal among several, and its value is that it is orthogonal to the others. An operation can rotate IPs cheaply and spoof user-agents for free, but its TLS stack stays put. When a bot farm cycles through a thousand residential addresses, the handshake is often the only thing that stays constant — and that constancy is what makes it recognisable across every site on a shared network at once." },
    ],
    related: [
      { label: "What is a datacenter IP?", to: "/blog/what-is-a-datacenter-ip" },
      { label: "See what our engine reads from your own browser", to: "/bot-check" },
    ],
  },
  {
    slug: "click-fraud-protection-what-to-look-for",
    title: "Buying click fraud protection: what to actually compare",
    description:
      "The seven questions that separate the tools in this category, including the two most vendors would rather you did not ask.",
    date: "2026-09-05",
    readMinutes: 10,
    tag: "Buying guide",
    blocks: [
      { kind: "p", text: "Every product in this category claims to block bots and save your budget. The claims are near-identical, which makes them useless for choosing. These are the questions that actually produce different answers from different vendors — including from us." },
      { kind: "h2", text: "1. What unit does the plan meter?" },
      { kind: "p", text: "This is the most common way a price comparison goes wrong. Some vendors meter paid ad clicks; others meter all site visits. A plan with 5,000 visits is a much tighter cap than one with 5,000 ad clicks, because your organic traffic consumes the same allowance. Compare the unit before you compare the number." },
      { kind: "h2", text: "2. What happens when you hit the cap?" },
      { kind: "p", text: "Two very different answers exist. Some products stop protecting you until the next billing cycle. Others continue and bill the overage. Neither is wrong, but one of them means your protection switches off during the month a traffic spike arrives — which is exactly when you needed it." },
      { kind: "h2", text: "3. Does it write exclusions back into the ad platform?" },
      { kind: "p", text: "The critical distinction in this category, and worth being blunt about: blocking a bot on your own site stops it reaching your page, but you have already paid for the click. Preventing the spend requires the tool to push IP exclusions into your Google Ads account through the API. Ask directly whether a product does this. ClickCease and Fraud Blocker do. TryNoBot does not do it yet — it is on our roadmap, and if that automation is your main requirement you should buy one of theirs today." },
      { kind: "h2", text: "4. Can it see traffic that never runs JavaScript?" },
      { kind: "p", text: "A JavaScript tag only sees clients that execute JavaScript. Scripted HTTP clients, scrapers and anything hitting your endpoints directly are invisible to it. If that matters to you, you need server-side enforcement, which means a check your server makes before rendering — not a tag in your page." },
      { kind: "h2", text: "5. Will it show you why?" },
      { kind: "p", text: "When a visitor is blocked, can you see which signals drove the decision, or only a verdict? This matters the first time a customer calls to say they could not reach your site. A score with its contributing signals is auditable. A number with no explanation is not, and you will end up disabling the tool rather than tuning it." },
      { kind: "h2", text: "6. How does it treat ad-review crawlers?" },
      { kind: "p", text: "The one question with a right answer. Ad platforms send automated reviewers to check that your landing page matches your ad. Those reviewers must be served exactly what a human is served. Identifying them so your click quality reports can exclude them is legitimate and useful; showing them different content is cloaking, it breaches Google's circumventing systems policy, and it risks your account rather than protecting it. If a vendor markets the latter as a feature, that is a reason to walk away, not a selling point." },
      { kind: "h2", text: "7. What does the contract actually say?" },
      { kind: "p", text: "Headline monthly prices in this category frequently assume annual billing, and introductory rates frequently cover only the first few cycles. Check the renewal rate, the cancellation terms and whether the annual commitment can be exited. Read it before the trial ends, not after." },
      { kind: "h2", text: "A short checklist" },
      { kind: "ol", items: [
        "Run the manual diagnostics first, so you know whether you have a problem and how big it is.",
        "Compare metering units, not headline numbers.",
        "Ask what happens at the cap.",
        "Ask whether it writes exclusions back to the ad platform.",
        "Ask whether it can see non-JavaScript traffic.",
        "Ask to see a blocked visit with its reasons.",
        "Read the renewal and cancellation terms.",
      ] },
      { kind: "p", text: "If a vendor cannot answer four through six clearly, you are being sold a dashboard rather than a detection engine." },
    ],
    related: [
      { label: "Compare TryNoBot with the alternatives", to: "/compare" },
      { label: "How to tell if your Google Ads traffic is real", to: "/blog/how-to-tell-if-your-google-ads-traffic-is-real" },
    ],
  },
];

/** Newest first — the index and the sitemap both rely on this order. */
export const postsByDate = (): Post[] =>
  [...POSTS].sort((a, b) => b.date.localeCompare(a.date));

export const postBySlug = (slug: string): Post | undefined =>
  POSTS.find((p) => p.slug === slug);

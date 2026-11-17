package crawler

// Email-security scanners and link-preview fetchers.
//
// This lives in the crawler package because it answers the same question for
// the same reason — only the blast radius differs. A search crawler served a
// decoy earns a Safe Browsing flag weeks later. An email security scanner
// served a decoy gets the MESSAGE CARRYING THE LINK rejected at the recipient's
// gateway: the sender sees a bounce, and the recipient never sees the mail at
// all — not in the inbox, not in junk.
//
// What actually fetches a link that travels in an email:
//
//   - the sending platform, checking the URL before it accepts the message;
//   - the receiving gateway, at delivery time. Microsoft Defender for Office
//     365 rewrites every URL in every message and fetches it; so do Proofpoint,
//     Mimecast, Barracuda, Cisco, Forcepoint, Sophos and the rest;
//   - the recipient's client, fetching a preview card.
//
// Not one of them is a browser. Every one runs from a datacenter range, most
// send no useful user-agent and several send none at all — so the engine scores
// them exactly as it scores a bot, and the link's bot handling serves them a
// 404, a 403, a blank body, a decoy or a JavaScript interstitial while a human
// gets a 302 to the real destination.
//
// To a mail gateway that difference is not a quality signal, it is the
// definition of a malicious redirect, and a shortened URL that behaves this way
// is refused at SMTP rather than filed as spam. Hence the symptom that brought
// this package into being: the same letter arrives when it carries the
// customer's own long URL and disappears when it carries one of ours, for every
// sender, through every sending platform.
//
// Verification is the same forward-confirmed reverse DNS the search crawlers
// get (PTR -> suffix match -> forward lookup back to the same IP), plus a
// user-agent tier for the vendors that publish no stable PTR records.

import (
	"context"
	"strings"
	"sync"
	"time"
)

// scannerSuffixes maps a forward-confirmed reverse-DNS suffix to a vendor
// label. This is the tier that needs no user-agent at all, which is the whole
// point of having it: the single biggest fetcher of links in email — Microsoft
// Defender's SafeLinks — sends a user-agent indistinguishable from a browser's,
// so the token tier below never sees it and only the PTR record gives it away.
//
// Suffixes are matched with a leading dot, so "notmimecast.com" cannot pass as
// "mimecast.com".
var scannerSuffixes = []struct{ suffix, vendor string }{
	{".outlook.com", "microsoft"}, // includes *.protection.outlook.com
	{".pphosted.com", "proofpoint"},
	{".ppops.net", "proofpoint"},
	{".proofpoint.com", "proofpoint"},
	{".mimecast.com", "mimecast"},
	{".mimecast.co.za", "mimecast"},
	{".barracuda.com", "barracuda"},
	{".barracudanetworks.com", "barracuda"},
	{".iphmx.com", "cisco"}, // Cisco Secure Email (IronPort)
	{".cisco.com", "cisco"},
	{".messagelabs.com", "broadcom"}, // Symantec.cloud
	{".symanteccloud.com", "broadcom"},
	{".mailcontrol.com", "forcepoint"},
	{".fortinet.com", "fortinet"},
	{".fortiguard.com", "fortinet"},
	{".sophos.com", "sophos"},
	{".trendmicro.com", "trendmicro"},
	{".hornetsecurity.com", "hornetsecurity"},
	{".retarus.com", "retarus"},
	{".mailgun.net", "mailgun"},
	{".sendgrid.net", "sendgrid"},
	{".amazonses.com", "amazonses"},
	{".1e100.net", "google"}, // Google's own generic rDNS (Gmail fetchers)
	{".google.com", "google"},
	{".googlebot.com", "google"},
	{".facebook.com", "facebook"},
	{".fbsv.net", "facebook"},
	{".twttr.com", "twitter"},
	{".linkedin.com", "linkedin"},
	{".slack.com", "slack"},
	{".zoho.com", "zoho"},
}

// scannerTokens are the fetchers that name themselves in the user-agent. Order
// matters only in that the first match wins; the labels exist for reporting, so
// a near-miss between two vendors costs nothing.
var scannerTokens = []struct{ token, vendor string }{
	{"mimecast", "mimecast"},
	{"barracuda", "barracuda"},
	{"proofpoint", "proofpoint"},
	{"safelinks", "microsoft"},
	{"skypeuripreview", "microsoft"},
	{"bingpreview", "microsoft"},
	{"microsoft office", "microsoft"},
	{"ms-office", "microsoft"},
	{"outlook", "microsoft"},
	{"googleimageproxy", "google"},
	{"google-safety", "google"},
	{"yahoomailproxy", "yahoo"},
	{"mail.ru", "mailru"},
	{"slackbot", "slack"},
	{"slack-imgproxy", "slack"},
	{"whatsapp", "whatsapp"},
	{"telegrambot", "telegram"},
	{"twitterbot", "twitter"},
	{"linkedinbot", "linkedin"},
	{"discordbot", "discord"},
	{"facebookexternalhit", "facebook"},
	{"redditbot", "reddit"},
	{"embedly", "embedly"},
	{"messagelabs", "broadcom"},
	{"symantec", "broadcom"},
	{"forcepoint", "forcepoint"},
	{"fortinet", "fortinet"},
	{"sophos", "sophos"},
	{"trendmicro", "trendmicro"},
	{"virustotal", "virustotal"},
	{"urlscan", "urlscan"},
}

type scannerEntry struct {
	vendor string
	ok     bool
	exp    time.Time
}

var (
	scannerMu    sync.Mutex
	scannerCache = map[string]scannerEntry{}
)

// ScannerClaims reports the vendor a user-agent presents itself as, if any.
//
// A pure string comparison: no DNS, no network, safe to call on the hot path
// for every request. It proves nothing — ScannerByAddr does that.
func ScannerClaims(ua string) (string, bool) {
	lua := strings.ToLower(ua)
	for _, s := range scannerTokens {
		if strings.Contains(lua, s.token) {
			return s.vendor, true
		}
	}
	return "", false
}

// ScannerByAddr identifies a fetcher from its IP alone, by forward-confirmed
// reverse DNS — no user-agent needed, and nothing a sender can spoof.
//
// Costs one PTR lookup plus one forward lookup, both cached (positives for an
// hour, negatives too, so a flood of unknown IPs cannot turn this into a
// reverse-DNS amplifier). Callers still enable it only where a DNS round trip
// is affordable.
func ScannerByAddr(ctx context.Context, ip string) (string, bool) {
	if ip == "" {
		return "", false
	}

	scannerMu.Lock()
	if e, hit := scannerCache[ip]; hit && time.Now().Before(e.exp) {
		scannerMu.Unlock()
		return e.vendor, e.ok
	}
	scannerMu.Unlock()

	vendor, ok := confirmScanner(ctx, ip)

	ttl := negTTL
	if ok {
		ttl = posTTL
	}
	scannerMu.Lock()
	scannerCache[ip] = scannerEntry{vendor: vendor, ok: ok, exp: time.Now().Add(ttl)}
	scannerMu.Unlock()
	return vendor, ok
}

func confirmScanner(ctx context.Context, ip string) (string, bool) {
	ctx, cancel := context.WithTimeout(ctx, dnsTimeout)
	defer cancel()

	names, err := lookupAddr(ctx, ip)
	if err != nil {
		return "", false
	}
	for _, name := range names {
		host := strings.ToLower(strings.TrimSuffix(name, "."))
		vendor := scannerVendorFor(host)
		if vendor == "" {
			continue
		}
		// Forward-confirm: the PTR hostname must resolve back to this IP, so a
		// hostile PTR record claiming ".mimecast.com" is worth nothing.
		addrs, err := lookupHost(ctx, host)
		if err != nil {
			continue
		}
		for _, a := range addrs {
			if a == ip {
				return vendor, true
			}
		}
	}
	return "", false
}

func scannerVendorFor(host string) string {
	for _, s := range scannerSuffixes {
		if strings.HasSuffix(host, s.suffix) {
			return s.vendor
		}
	}
	return ""
}

// VerifiedScanner identifies an email-security scanner or link-preview fetcher,
// returning the vendor label for reporting.
//
// trustUA accepts a self-identifying user-agent without DNS proof. It is the
// only way to recognise several scanners that genuinely matter — Mimecast and
// Barracuda publish no stable PTR records across their scanning ranges — and
// the price of it is a bypass: anyone who sends "Mimecast" as their user-agent
// is handed the real destination instead of the link's bot handling. That is
// precisely what a forward-confirmed Googlebot already gets, and one spoofed
// visitor reaching a landing page is a far smaller loss than a campaign whose
// recipients never receive the mail at all. So it defaults on, and setting
// ALLOW_LINK_SCANNER_UA=0 turns it off for operators who would rather filter
// harder than deliver.
//
// probeDNS enables the reverse-DNS tier, the only tier that sees Microsoft
// Defender. It costs a DNS round trip, so callers enable it where they can
// afford one — on this engine's hot path that means only when the alternative
// is to serve something other than the real destination.
func VerifiedScanner(ctx context.Context, ip, ua string, trustUA, probeDNS bool) (string, bool) {
	if vendor, claimed := ScannerClaims(ua); claimed {
		if trustUA {
			return vendor, true
		}
		if probeDNS {
			if v, ok := ScannerByAddr(ctx, ip); ok {
				return v, true
			}
		}
		return "", false
	}
	if probeDNS {
		return ScannerByAddr(ctx, ip)
	}
	return "", false
}

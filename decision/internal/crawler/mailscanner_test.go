package crawler

import (
	"context"
	"testing"
)

// stubScannerDNS is stubDNS plus a reset of the scanner cache, which stubDNS
// does not know about. Without the reset a verdict from an earlier case leaks
// into the next one and the suite passes for the wrong reason.
func stubScannerDNS(t *testing.T, ptr map[string][]string, fwd map[string][]string) {
	t.Helper()
	stubDNS(t, ptr, fwd)
	scannerMu.Lock()
	scannerCache = map[string]scannerEntry{}
	scannerMu.Unlock()
}

func TestMicrosoftDefenderIsIdentifiedWithoutAUserAgent(t *testing.T) {
	// The case that matters most: SafeLinks fetches every URL in every message
	// delivered to Office 365, and its user-agent looks like a browser's. Only
	// the PTR record gives it away, so this must pass with a browser UA and
	// with no UA at all.
	stubScannerDNS(t,
		map[string][]string{"40.107.0.1": {"mail-db8eur05on2001.outbound.protection.outlook.com."}},
		map[string][]string{"mail-db8eur05on2001.outbound.protection.outlook.com": {"40.107.0.1"}},
	)

	for _, ua := range []string{
		"",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
	} {
		vendor, ok := VerifiedScanner(context.Background(), "40.107.0.1", ua, true, true)
		if !ok {
			t.Errorf("ua %q: Defender not identified — it will be served the link's bot handling, "+
				"and the message carrying the link gets refused at the gateway", ua)
		}
		if vendor != "microsoft" {
			t.Errorf("ua %q: vendor = %q, want \"microsoft\"", ua, vendor)
		}
	}
}

func TestProofpointAndMimecastVerifyByReverseDNS(t *testing.T) {
	cases := []struct {
		ip, ptr, vendor string
	}{
		{"148.163.0.1", "mx0a-00191d01.pphosted.com.", "proofpoint"},
		{"205.139.110.1", "eu-smtp-1.mimecast.com.", "mimecast"},
		{"64.235.144.1", "esa1.hc0-1.barracudanetworks.com.", "barracuda"},
		{"68.232.128.1", "esa.hc1.iphmx.com.", "cisco"},
	}
	for _, c := range cases {
		host := c.ptr[:len(c.ptr)-1] // drop the trailing dot
		stubScannerDNS(t,
			map[string][]string{c.ip: {c.ptr}},
			map[string][]string{host: {c.ip}},
		)
		// trustUA off and no claiming UA: the rDNS tier has to carry this alone.
		vendor, ok := VerifiedScanner(context.Background(), c.ip, "", false, true)
		if !ok || vendor != c.vendor {
			t.Errorf("%s: got (%q, %v), want (%q, true)", host, vendor, ok, c.vendor)
		}
	}
}

func TestForgedPTRIsRejected(t *testing.T) {
	// A hostile PTR record can claim anything; it is worth nothing unless the
	// hostname resolves back to the same IP.
	stubScannerDNS(t,
		map[string][]string{"203.0.113.9": {"totally.mimecast.com."}},
		map[string][]string{"totally.mimecast.com": {"198.51.100.4"}}, // resolves elsewhere
	)
	if vendor, ok := VerifiedScanner(context.Background(), "203.0.113.9", "", false, true); ok {
		t.Fatalf("forged PTR verified as %q — forward confirmation is not being applied", vendor)
	}
}

func TestLookalikeDomainDoesNotPass(t *testing.T) {
	// Suffixes carry a leading dot precisely so this cannot happen.
	stubScannerDNS(t,
		map[string][]string{"203.0.113.10": {"host.notmimecast.com."}},
		map[string][]string{"host.notmimecast.com": {"203.0.113.10"}},
	)
	if _, ok := VerifiedScanner(context.Background(), "203.0.113.10", "", false, true); ok {
		t.Fatal("notmimecast.com passed as mimecast.com")
	}
}

func TestSelfIdentifyingScannersAreRecognisedFromTheUserAgent(t *testing.T) {
	stubScannerDNS(t, nil, nil)
	cases := map[string]string{
		"Mimecast Scanner":                        "mimecast",
		"Barracuda Link Protect":                  "barracuda",
		"Mozilla/5.0 (compatible; proofpoint/1.0)": "proofpoint",
		"Microsoft Office Word 2014":              "microsoft",
		"Mozilla/5.0 (compatible; Slackbot 1.0; +https://api.slack.com/robots)": "slack",
		"WhatsApp/2.23.20.0":                      "whatsapp",
		"TelegramBot (like TwitterBot)":           "telegram",
		"Mozilla/5.0 (compatible; GoogleImageProxy)": "google",
	}
	for ua, want := range cases {
		vendor, ok := VerifiedScanner(context.Background(), "203.0.113.50", ua, true, false)
		if !ok {
			t.Errorf("ua %q not recognised as a scanner", ua)
			continue
		}
		if vendor != want {
			t.Errorf("ua %q: vendor = %q, want %q", ua, vendor, want)
		}
	}
}

func TestUserAgentTierCanBeTurnedOff(t *testing.T) {
	// ALLOW_LINK_SCANNER_UA=0 maps to trustUA=false. A claiming UA from an IP
	// with no supporting PTR must then NOT be let through, because that is the
	// bypass the flag exists to close.
	stubScannerDNS(t, nil, nil)
	if _, ok := VerifiedScanner(context.Background(), "203.0.113.77", "Mimecast Scanner", false, true); ok {
		t.Fatal("a spoofable user-agent was trusted with trustUA=false")
	}
}

func TestOrdinaryVisitorIsNeverAScanner(t *testing.T) {
	stubScannerDNS(t,
		map[string][]string{"198.51.100.20": {"cust-20.isp.example."}},
		map[string][]string{"cust-20.isp.example": {"198.51.100.20"}},
	)
	ua := "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
		"(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
	if vendor, ok := VerifiedScanner(context.Background(), "198.51.100.20", ua, true, true); ok {
		t.Fatalf("a real visitor was classed as scanner %q — their click would stop being filtered", vendor)
	}
}

func TestScannerClaimsCostsNoDNS(t *testing.T) {
	// The hot path calls ScannerClaims for every request. If it ever resolves,
	// every short-link click pays for a DNS round trip.
	called := false
	lookupAddr = func(context.Context, string) ([]string, error) {
		called = true
		return nil, nil
	}
	lookupHost = func(context.Context, string) ([]string, error) {
		called = true
		return nil, nil
	}
	t.Cleanup(func() { lookupAddr, lookupHost = nil, nil })

	ScannerClaims("Mimecast Scanner")
	ScannerClaims("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
	if called {
		t.Fatal("ScannerClaims performed a DNS lookup")
	}
}

func TestProbeDNSOffMeansNoLookup(t *testing.T) {
	// decide()/guard() pass probeDNS=false to keep the hot path free of DNS.
	called := false
	lookupAddr = func(context.Context, string) ([]string, error) {
		called = true
		return nil, nil
	}
	lookupHost = func(context.Context, string) ([]string, error) {
		called = true
		return nil, nil
	}
	t.Cleanup(func() { lookupAddr, lookupHost = nil, nil })
	scannerMu.Lock()
	scannerCache = map[string]scannerEntry{}
	scannerMu.Unlock()

	if _, ok := VerifiedScanner(context.Background(), "203.0.113.90", "Mozilla/5.0", true, false); ok {
		t.Fatal("a plain browser UA was identified as a scanner")
	}
	if called {
		t.Fatal("probeDNS=false still resolved")
	}
}

func TestScannerVerdictIsCached(t *testing.T) {
	calls := 0
	lookupAddr = func(_ context.Context, ip string) ([]string, error) {
		calls++
		return []string{"eu-smtp-1.mimecast.com."}, nil
	}
	lookupHost = func(_ context.Context, host string) ([]string, error) {
		return []string{"205.139.110.2"}, nil
	}
	t.Cleanup(func() { lookupAddr, lookupHost = nil, nil })
	scannerMu.Lock()
	scannerCache = map[string]scannerEntry{}
	scannerMu.Unlock()

	for i := 0; i < 5; i++ {
		if _, ok := ScannerByAddr(context.Background(), "205.139.110.2"); !ok {
			t.Fatal("mimecast should verify")
		}
	}
	if calls != 1 {
		t.Fatalf("PTR resolved %d times for one IP, want 1 — the cache is not working", calls)
	}
}

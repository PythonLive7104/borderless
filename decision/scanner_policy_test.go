package main

import (
	"os"
	"strings"
	"testing"
)

// The deliverability invariant: a link that travels in an email must answer the
// scanner that fetches it exactly as it answers the human who clicks it.
//
// This is a separate failure from the Safe Browsing one that crawler_policy_test
// guards, and a much louder one. A mail gateway fetches every URL in every
// message before delivering it. If the URL answers the gateway with a 404, a
// 403, a blank body, a decoy or a JavaScript interstitial, and answers a browser
// with a 302 to somewhere else, the gateway does not downgrade the message — it
// refuses it at SMTP. The recipient sees nothing, not even in junk, which is the
// symptom that is impossible to debug from the sender's side: the identical
// letter arrives the moment the short link is swapped for a plain long URL.
//
// So the rule is tested the same way the crawler rule is: exhaustively over
// every outcome the engine can produce, plus a wiring guard, because a pure
// function keeps passing its tests long after its call site is deleted.

func TestAnIdentifiedScannerReachesTheRealDestination(t *testing.T) {
	const destination = "https://example.com/real-landing-page"

	// Identification sets verifiedCrawler, so the existing chokepoint carries
	// the decision. These are the outcomes that cause a message to be refused.
	for _, mode := range everyMode {
		gotMode, gotDest := enforceCrawlerPolicy(true, mode, "https://decoy.example/", destination)
		if gotMode != "allow" {
			t.Errorf("mode %q: an email scanner would be served %q — the gateway reads that "+
				"as a cloaked redirect and refuses the whole message", mode, gotMode)
		}
		if gotDest != destination {
			t.Errorf("mode %q: scanner sent to %q, want the real destination %q",
				mode, gotDest, destination)
		}
	}
}

// --- Wiring guards ----------------------------------------------------------

func TestScannerPolicyIsWiredIntoTheShortlinkHandler(t *testing.T) {
	src, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	s := string(src)

	handler := strings.Index(s, "func (h *handler) shortlink(")
	if handler < 0 {
		t.Fatal("shortlink handler not found — this guard needs updating")
	}
	chokepoint := strings.Index(s[handler:], "enforceCrawlerPolicy(verifiedCrawler")
	if chokepoint < 0 {
		t.Fatal("shortlink() no longer calls enforceCrawlerPolicy — see crawler_policy_test")
	}
	chokepoint += handler

	check := strings.Index(s[handler:], "crawler.VerifiedScanner(")
	if check < 0 {
		t.Fatal("shortlink() no longer identifies email scanners — every link sent in a " +
			"campaign will be served its bot handling and the messages carrying it will " +
			"be refused at the recipient gateway")
	}
	check += handler

	if check > chokepoint {
		t.Fatal("the scanner check runs AFTER enforceCrawlerPolicy, so it cannot affect the " +
			"outcome — move it above the chokepoint")
	}

	// It must feed the chokepoint. Identifying a scanner and then not acting on
	// it is the same bug with extra DNS.
	between := s[check:chokepoint]
	if !strings.Contains(between, "verifiedCrawler = true") {
		t.Error("the scanner check does not set verifiedCrawler, so enforceCrawlerPolicy " +
			"will still serve the scanner a decoy/404/403/interstitial")
	}
}

func TestScannerLookupIsSkippedWhenNothingWouldBeCloaked(t *testing.T) {
	// The reverse-DNS tier costs a lookup. A visitor already on their way to
	// the destination has nothing to decide, so a genuine human click must not
	// pay for it — the guard is what keeps this fix off the hot path.
	src, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	s := string(src)
	call := strings.Index(s, "crawler.VerifiedScanner(")
	if call < 0 {
		t.Skip("no scanner check to assess")
	}
	// Look back a short way for the condition guarding the call.
	from := call - 600
	if from < 0 {
		from = 0
	}
	guard := s[from:call]
	for _, want := range []string{`mode != "allow"`, "h.allowScanners"} {
		if !strings.Contains(guard, want) {
			t.Errorf("the scanner lookup is not guarded by %s — every short-link click now "+
				"pays for a DNS round trip", want)
		}
	}
}

func TestProtectedPagesAlsoStopCloakingToScanners(t *testing.T) {
	// A gateway that gets a clean 302 from the short link follows it to the
	// customer's own page. If the Shield then blocks it, the gateway reaches the
	// same verdict one hop later and the message is refused anyway.
	//
	// score() is the shared scoring routine behind both /v1/decide and
	// /v1/guard, so it is the one place that covers the server-side Shield and
	// the nginx auth_request path together — asserting on decide() and guard()
	// directly would be asserting on the wrong functions. collect() is the
	// tracker's ingestion path, where the point is keeping scanner addresses out
	// of the shared bad-IP corpus.
	src, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	s := string(src)

	for _, h := range []string{"func (h *handler) score(", "func (h *handler) collect("} {
		start := strings.Index(s, h)
		if start < 0 {
			t.Errorf("%s not found — this guard needs updating", h)
			continue
		}
		// Bound the search at the next handler so a match cannot leak in from
		// elsewhere in the file.
		end := strings.Index(s[start+1:], "\nfunc ")
		if end < 0 {
			end = len(s) - start - 1
		}
		body := s[start : start+1+end]
		if !strings.Contains(body, "crawler.ScannerClaims(") {
			t.Errorf("%s does not identify email scanners — a scanner that follows the link "+
				"to a protected page is still served something a human would not be", h)
		}
	}
}

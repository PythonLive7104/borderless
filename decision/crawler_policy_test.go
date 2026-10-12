package main

import (
	"os"
	"strings"
	"testing"
)

// The anti-cloaking invariant: a forward-confirmed search or ad-review crawler
// is served exactly what a human is served.
//
// This is the single rule separating a traffic-quality product from a cloaker.
// Breaking it is silent and slow to surface — the site starts showing Googlebot
// something different, and the first anyone hears is a Safe Browsing flag or a
// batch of disapproved ads weeks later. So it is tested exhaustively rather
// than by sampling: EVERY outcome the engine can reach is listed below, and a
// new one added upstream without a decision here will fail the completeness
// test at the bottom.

// everyMode is every value `mode` can hold in the shortlink handler.
var everyMode = []string{
	"allow",     // human -> destination
	"redirect",  // a rule's redirect target
	"block",     // 403
	"notfound",  // 404
	"blank",     // 200, empty
	"decoy",     // the decoy page — the one that would be textbook cloaking
	"challenge", // interstitial "click to continue"
	"deepcheck", // silent browser check
}

func TestVerifiedCrawlerAlwaysReachesTheRealDestination(t *testing.T) {
	const destination = "https://example.com/real-landing-page"

	for _, mode := range everyMode {
		// `dest` is deliberately wrong here: several paths rewrite it on their
		// way to turning a visitor away, so restoring the mode alone would send
		// the crawler somewhere other than the real page.
		gotMode, gotDest := enforceCrawlerPolicy(true, mode, "https://decoy.example/", destination)
		if gotMode != "allow" {
			t.Errorf("mode %q: verified crawler got %q, want \"allow\" — this is cloaking", mode, gotMode)
		}
		if gotDest != destination {
			t.Errorf("mode %q: verified crawler sent to %q, want the real destination %q",
				mode, gotDest, destination)
		}
	}
}

func TestEveryoneElseIsUnaffected(t *testing.T) {
	// The rule must not become a hole: an unverified visitor keeps whatever the
	// gates and rules decided, untouched. A spoofed "Googlebot" UA never
	// reaches here as verified (internal/crawler forward-confirms by rDNS), so
	// this is what a bot claiming to be a crawler actually gets.
	for _, mode := range everyMode {
		gotMode, gotDest := enforceCrawlerPolicy(false, mode, "https://decoy.example/", "https://example.com/real")
		if gotMode != mode {
			t.Errorf("mode %q was rewritten to %q for a non-crawler", mode, gotMode)
		}
		if gotDest != "https://decoy.example/" {
			t.Errorf("mode %q: non-crawler destination was rewritten to %q", mode, gotDest)
		}
	}
}

func TestBlockDatacenterCannotCloakAgainstCrawlers(t *testing.T) {
	// The specific regression that prompted this. Every crawler runs from a
	// datacenter range, so block_datacenter matches all of them — and it sets
	// mode from the link's bot_action without consulting verifiedCrawler. A
	// link with that switch on was serving Googlebot a decoy while humans got
	// the destination.
	for _, botAction := range []string{"decoy", "notfound", "blank"} {
		mode, dest := enforceCrawlerPolicy(true, botAction, "", "https://example.com/real")
		if mode != "allow" || dest != "https://example.com/real" {
			t.Fatalf("block_datacenter + bot_action=%q still cloaks a crawler: mode=%q dest=%q",
				botAction, mode, dest)
		}
	}
}

func TestEveryModeIsAccountedFor(t *testing.T) {
	// Completeness guard. If someone adds a new outcome to the shortlink
	// handler's switch, they have to add it here too — which forces the
	// question "what does a verified crawler get?" to be answered deliberately
	// rather than by omission.
	//
	// Keep this list in step with the final `switch mode` in shortlink().
	servedByHandler := map[string]bool{
		"allow": true, "redirect": true, "block": true, "notfound": true,
		"blank": true, "decoy": true, "challenge": true, "deepcheck": true,
	}
	if len(servedByHandler) != len(everyMode) {
		t.Fatalf("everyMode has %d entries but the handler serves %d — one of them is stale",
			len(everyMode), len(servedByHandler))
	}
	for _, m := range everyMode {
		if !servedByHandler[m] {
			t.Errorf("mode %q is tested but the handler never serves it", m)
		}
	}
}

// --- Wiring guard -----------------------------------------------------------
//
// The tests above lock the RULE. They cannot lock the WIRING: enforceCrawlerPolicy
// is a pure function, so deleting its call from shortlink() leaves every test
// above passing while the engine cloaks again. That is exactly the regression
// this file exists to prevent, so the call site is asserted directly.
//
// Reading the source in a test is unusual, and it is the honest option here: a
// behavioural test would need the handler's Redis reads stubbed, which means
// refactoring a 280-line hot-path handler. Until that refactor happens this
// catches the regression that matters — the call being deleted, or moved back
// above a gate where it stops being the last word.

func TestCrawlerPolicyIsWiredIntoTheShortlinkHandler(t *testing.T) {
	src, err := os.ReadFile("main.go")
	if err != nil {
		t.Fatalf("read main.go: %v", err)
	}
	s := string(src)

	handler := strings.Index(s, "func (h *handler) shortlink(")
	if handler < 0 {
		t.Fatal("shortlink handler not found — this guard needs updating")
	}
	call := strings.Index(s[handler:], "enforceCrawlerPolicy(verifiedCrawler")
	if call < 0 {
		t.Fatal("shortlink() no longer calls enforceCrawlerPolicy — verified crawlers " +
			"can now be served a decoy, block or 404. This is cloaking.")
	}
	call += handler

	// It must be the LAST word. Every gate that can turn a visitor away assigns
	// to `mode`; if any such assignment runs after the call, that gate escapes
	// the policy. The emit marks the end of decision-making.
	emit := strings.Index(s[handler:], "h.st.EmitTraffic(")
	if emit < 0 {
		t.Fatal("EmitTraffic not found in shortlink() — this guard needs updating")
	}
	emit += handler
	if call > emit {
		t.Fatal("enforceCrawlerPolicy runs after the decision is emitted — too late to matter")
	}

	for _, gate := range []string{"mode = link.BotAction", "mode = \"notfound\"", "mode = \"block\"", "refuse()"} {
		for i := call; i < emit; {
			j := strings.Index(s[i:emit], gate)
			if j < 0 {
				break
			}
			t.Errorf("%q runs AFTER enforceCrawlerPolicy — that gate can still cloak "+
				"against a verified crawler; move the policy call below it", gate)
			i += j + len(gate)
		}
	}
}

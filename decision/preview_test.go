package main

import (
	"os"
	"strings"
	"testing"
)

// The preview endpoint's entire safety argument is that it does not write
// anything about the visitor. If it ever did, somebody who scored badly on our
// own marketing page would be filed in the shared cross-customer corpus and
// could then be blocked on a CUSTOMER's site — people who never visited those
// sites, turned away because they once looked at our homepage.
//
// That failure would be completely silent. Nothing in the demo would look
// wrong; the damage would show up as other people's traffic being blocked. So
// it is guarded at the source rather than left to review.

// writesAboutTheVisitor are the calls that persist something keyed to a person.
// The preview path must contain none of them.
var writesAboutTheVisitor = []string{
	"EmitTraffic",            // writes a traffic event to the stream -> Postgres
	"rememberBot",            // files the IP in cross-surface bot memory
	"rememberBadFingerprint", // files the fingerprint in the shared corpus
	"RecordBadFingerprint",   // the store-level call behind the above
	"SAdd",                   // any set membership written about this visitor
	"SetEx",                  // any cached write keyed to this visitor
}

func TestPreviewWritesNothingAboutTheVisitor(t *testing.T) {
	src, err := os.ReadFile("preview.go")
	if err != nil {
		t.Fatalf("read preview.go: %v", err)
	}
	s := string(src)

	// Only inspect code, not the file's explanatory comments — which name
	// several of these calls precisely to explain why they're absent.
	code := stripComments(s)

	for _, call := range writesAboutTheVisitor {
		if strings.Contains(code, call) {
			t.Errorf("preview.go calls %q — the preview must not persist anything about "+
				"the visitor, or a marketing-site visitor can be blocked on a customer's site", call)
		}
	}
}

func TestPreviewDoesNotTouchTheSharedRateCounter(t *testing.T) {
	// "iprate:" feeds the abnormal_request_rate signal on real customer
	// traffic. Counting marketing-site visits there would make a visitor look
	// abnormal on sites they have never been to, so the preview keeps its own
	// namespace.
	src, _ := os.ReadFile("preview.go")
	code := stripComments(string(src))
	if strings.Contains(code, `"iprate:`) {
		t.Error("preview.go increments the shared iprate: counter — use previewRateKey instead")
	}
	if !strings.Contains(code, "previewRateKey") {
		t.Error("preview.go no longer rate-limits; this endpoint is public and can trigger paid IP lookups")
	}
	if got := previewRateKey("1.2.3.4"); got != "prate:1.2.3.4" {
		t.Errorf("previewRateKey = %q, want a namespace of its own", got)
	}
}

func TestPreviewScoresAbnormalRateAsFalse(t *testing.T) {
	// Belt and braces for the above: even if a counter were read, it must not
	// reach the scorer, or a reloading visitor would be penalised for curiosity.
	src, _ := os.ReadFile("preview.go")
	code := stripComments(string(src))
	if !strings.Contains(code, "AbnormalRate:        false") {
		t.Error("preview no longer passes AbnormalRate: false — a visitor reloading the " +
			"demo would start scoring as a bot on our own homepage")
	}
}

func TestEverySignalTheScorerCanEmitHasALabel(t *testing.T) {
	// An unlabeled code renders as a raw identifier like "known_bad_ja3" in
	// front of a prospect. The scorer is the source of truth for what exists,
	// so read the codes out of it rather than keeping a second list by hand.
	src, err := os.ReadFile("internal/risk/risk.go")
	if err != nil {
		t.Fatalf("read risk.go: %v", err)
	}
	for _, code := range quotedArgsOf(string(src), "add(") {
		if _, ok := signalLabels[code]; !ok {
			t.Errorf("risk signal %q has no human-readable label in preview.go", code)
		}
	}
}

func TestLabelSignalsNeverDropsOrInventsSignals(t *testing.T) {
	in := []string{"datacenter_ip", "human_interaction", "a_code_from_the_future"}
	out := labelSignals(in)
	if len(out) != len(in) {
		t.Fatalf("got %d signals from %d", len(out), len(in))
	}
	for i, s := range out {
		if s.Code != in[i] {
			t.Errorf("signal %d: code %q became %q", i, in[i], s.Code)
		}
		if s.Label == "" {
			t.Errorf("signal %q rendered with an empty label", s.Code)
		}
	}
	// An unknown code must still render as something, not blank.
	if out[2].Label != "a_code_from_the_future" {
		t.Errorf("unmapped code lost its fallback label: %q", out[2].Label)
	}
	// Exoneration must be marked good so a clean visitor sees something positive.
	if !out[1].Good {
		t.Error("human_interaction should be flagged as a good signal")
	}
	if out[0].Good {
		t.Error("datacenter_ip must not be flagged as a good signal")
	}
}

// --- helpers ---------------------------------------------------------------

// stripComments removes // line comments so a guard that looks for a call name
// isn't tripped by prose explaining why that call is absent.
func stripComments(s string) string {
	var b strings.Builder
	for _, line := range strings.Split(s, "\n") {
		if i := strings.Index(line, "//"); i >= 0 {
			line = line[:i]
		}
		b.WriteString(line)
		b.WriteByte('\n')
	}
	return b.String()
}

// quotedArgsOf returns the second quoted argument of every `fn(...)` call, which
// for risk.go's add(points, "name") is the signal name.
func quotedArgsOf(src, fn string) []string {
	var out []string
	for i := 0; ; {
		j := strings.Index(src[i:], fn)
		if j < 0 {
			return out
		}
		i += j + len(fn)
		end := strings.Index(src[i:], ")")
		if end < 0 {
			return out
		}
		seg := src[i : i+end]
		if a := strings.Index(seg, `"`); a >= 0 {
			if b := strings.Index(seg[a+1:], `"`); b >= 0 {
				out = append(out, seg[a+1:a+1+b])
			}
		}
	}
}

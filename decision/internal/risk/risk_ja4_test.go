package risk

import "testing"

func TestBadJA4AddsSignalAndScore(t *testing.T) {
	clean := Evaluate(Input{})
	bad := Evaluate(Input{BadJA4: true})
	if bad.Score <= clean.Score {
		t.Fatalf("BadJA4 should raise the score: clean=%d bad=%d", clean.Score, bad.Score)
	}
	found := false
	for _, s := range bad.Signals {
		if s == "known_bad_ja4" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected known_bad_ja4 signal, got %v", bad.Signals)
	}
}

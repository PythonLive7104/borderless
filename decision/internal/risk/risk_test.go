package risk

import "testing"

func TestCleanVisitorScoresZero(t *testing.T) {
	r := Evaluate(Input{})
	if r.Score != 0 || r.Classification != "human" {
		t.Fatalf("clean visitor: got score=%d class=%s, want 0/human", r.Score, r.Classification)
	}
}

func TestSyntheticEventsAddRisk(t *testing.T) {
	r := Evaluate(Input{SyntheticEvents: true})
	if r.Score != wSyntheticEvents {
		t.Fatalf("synthetic events: got %d, want %d", r.Score, wSyntheticEvents)
	}
	if !hasSignal(r, "synthetic_events") {
		t.Fatalf("expected synthetic_events signal, got %v", r.Signals)
	}
}

func TestHumanInteractionExoneratesButCannotGoNegative(t *testing.T) {
	// A borderline-suspicious visit that then shows real human interaction
	// should drop back toward human, not below zero.
	base := Evaluate(Input{Proxy: true, NoFingerprint: true}) // 15 + 15 = 30
	withHuman := Evaluate(Input{Proxy: true, NoFingerprint: true, HumanInteraction: true})
	if withHuman.Score >= base.Score {
		t.Fatalf("human interaction should lower score: base=%d withHuman=%d", base.Score, withHuman.Score)
	}
	if withHuman.Score < 0 {
		t.Fatalf("score went negative: %d", withHuman.Score)
	}
}

func TestHumanInteractionNeverWhitewashesAKnownBadIP(t *testing.T) {
	// A very high fraud IP plus a known-bot flag must stay actionable even if a
	// (likely spoofed) human-interaction signal is present.
	r := Evaluate(Input{KnownBot: true, IPFraudScore: 90, HumanInteraction: true})
	if r.Classification == "human" {
		t.Fatalf("known bad IP was whitewashed to human: score=%d", r.Score)
	}
}

func TestHumanInteractionOnACleanVisitIsANoOp(t *testing.T) {
	// Nothing to subtract from: the exoneration must not be recorded as a signal
	// on an already-clean visit, and the score stays 0.
	r := Evaluate(Input{HumanInteraction: true})
	if r.Score != 0 {
		t.Fatalf("clean+human: got %d, want 0", r.Score)
	}
	if hasSignal(r, "human_interaction") {
		t.Fatalf("human_interaction should not be recorded when it changed nothing: %v", r.Signals)
	}
}

func hasSignal(r Result, name string) bool {
	for _, s := range r.Signals {
		if s == name {
			return true
		}
	}
	return false
}

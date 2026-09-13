package risk

import "testing"

func hasSig(sigs []string, want string) bool {
	for _, s := range sigs {
		if s == want {
			return true
		}
	}
	return false
}

func TestIPReputationSignals(t *testing.T) {
	// A clean UA on a clean-looking IP that the provider knows is bad: this is
	// the case pure UA/network checks miss.
	r := Evaluate(Input{IPFraudScore: 90})
	if r.Score < 40 || !hasSig(r.Signals, "high_fraud_ip") {
		t.Fatalf("fraud 90 should raise score into suspicious+; got %d %v", r.Score, r.Signals)
	}

	if s := Evaluate(Input{IPFraudScore: 78}).Signals; !hasSig(s, "elevated_fraud_ip") {
		t.Fatalf("fraud 78 should be elevated band; got %v", s)
	}

	if s := Evaluate(Input{IPFraudScore: 50}).Signals; hasSig(s, "elevated_fraud_ip") || hasSig(s, "high_fraud_ip") {
		t.Fatalf("fraud 50 should add no fraud signal; got %v", s)
	}

	if s := Evaluate(Input{IPBot: true}).Signals; !hasSig(s, "ip_reported_bot") {
		t.Fatalf("IPBot should add ip_reported_bot; got %v", s)
	}
	if s := Evaluate(Input{RecentAbuse: true}).Signals; !hasSig(s, "recent_abuse_ip") {
		t.Fatalf("RecentAbuse should add recent_abuse_ip; got %v", s)
	}

	// Combined reputation pushes a clean-UA visitor to bot/fraud territory.
	combined := Evaluate(Input{IPFraudScore: 90, RecentAbuse: true})
	if combined.Score < 55 {
		t.Fatalf("high fraud + recent abuse should score high; got %d", combined.Score)
	}

	// A genuine clean visitor stays human.
	if c := Evaluate(Input{}).Classification; c != "human" {
		t.Fatalf("empty input should be human; got %q", c)
	}
}

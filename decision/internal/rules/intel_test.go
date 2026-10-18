package rules

import "testing"

// A site whose rules filter on IP intelligence must resolve that intelligence
// synchronously. These pin which fields count, because the cost of getting the
// list wrong is silent: a missing field means the lookup stays asynchronous and
// the first request from an unseen IP is judged against an empty cache — which
// is exactly how VPN traffic walked through a VPN rule.
func TestNeedsIntel(t *testing.T) {
	cases := []struct {
		name  string
		field string
		want  bool
	}{
		{"proxy catch-all", "is_proxy", true},
		{"vpn", "is_vpn", true},
		{"datacenter / RDP", "is_datacenter", true},
		{"isp", "isp", true},
		{"asn", "asn", true},
		{"connection type", "connection_type", true},
		{"mobile connection", "is_mobile", true},
		// These come off the request itself, so they need no provider call.
		{"country", "country", false},
		{"os", "os", false},
		{"classification", "classification", false},
		{"risk score", "risk_score", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rs := []Rule{{Action: "redirect", Conditions: []Condition{
				{Field: c.field, Operator: "eq", Value: "yes"}}}}
			if got := NeedsIntel(rs); got != c.want {
				t.Fatalf("NeedsIntel(%s) = %v, want %v", c.field, got, c.want)
			}
		})
	}
}

func TestNeedsIntelAcrossRulesAndConditions(t *testing.T) {
	// The intel field is on the SECOND condition of the SECOND rule: scanning
	// only the first of either would miss it.
	rs := []Rule{
		{Action: "block", Conditions: []Condition{{Field: "country", Operator: "eq", Value: "us"}}},
		{Action: "redirect", Conditions: []Condition{
			{Field: "os", Operator: "eq", Value: "windows"},
			{Field: "is_datacenter", Operator: "eq", Value: "yes"},
		}},
	}
	if !NeedsIntel(rs) {
		t.Fatal("a datacenter condition anywhere in the set must force a synchronous lookup")
	}
}

func TestNeedsIntelIsFalseForNoRules(t *testing.T) {
	// The common case: most sites filter on nothing intel-backed and must not
	// pay a provider round-trip to discover that.
	if NeedsIntel(nil) {
		t.Fatal("an empty rule set must not require an intel lookup")
	}
	if NeedsIntel([]Rule{{Action: "allow"}}) {
		t.Fatal("a rule with no conditions must not require an intel lookup")
	}
}

// The reported bug, as a test: a VPN rule against empty intel must NOT match,
// which is why the lookup has to happen before evaluation rather than after.
func TestVPNRuleDoesNotMatchEmptyIntel(t *testing.T) {
	rs := []Rule{{Action: "redirect", Redirect: "https://example.com",
		Conditions: []Condition{{Field: "is_proxy", Operator: "eq", Value: "1"}}}}

	action, _, _ := Evaluate(rs, Event{Fields: map[string]string{}})
	if action != "allow" {
		t.Fatalf("empty intel should not match a proxy rule, got %q", action)
	}

	// "1"/"0" is the wire format: boolStr() in the engine emits it and the UI
	// stores it (FIELD_VALUE_OPTIONS in lib/api.ts shows "Yes" but saves "1").
	action, _, redirect := Evaluate(rs, Event{Fields: map[string]string{"is_proxy": "1"}})
	if action != "redirect" || redirect != "https://example.com" {
		t.Fatalf("resolved intel should match: got %q %q", action, redirect)
	}
}

// "not equals" must act on what we know, not on what we failed to find out.
// An absent field satisfying `ne` is how real visitors ended up on the decoy
// page: `Country is not US` matched everyone whose country was undetermined.
func TestNotEqualsDoesNotMatchAnUnknownField(t *testing.T) {
	rs := []Rule{{Action: "redirect", Redirect: "https://example.com",
		Conditions: []Condition{{Field: "country", Operator: "ne", Value: "US"}}}}

	// Country unknown — the rule must NOT fire.
	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{}}); action != "allow" {
		t.Fatalf("unknown country must not satisfy `country ne US`, got %q", action)
	}
	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{"country": ""}}); action != "allow" {
		t.Fatalf("empty country must not satisfy `country ne US`, got %q", action)
	}
	// Known and different — it must fire.
	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{"country": "GB"}}); action != "redirect" {
		t.Fatalf("GB should satisfy `country ne US`, got %q", action)
	}
	// Known and equal — it must not.
	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{"country": "us"}}); action != "allow" {
		t.Fatalf("US must not satisfy `country ne US`, got %q", action)
	}
}

// Asking for emptiness explicitly still works: there the absence IS the thing
// being tested, so the guard above must not swallow it.
func TestNotEqualsAgainstEmptyIsStillHonoured(t *testing.T) {
	rs := []Rule{{Action: "block",
		Conditions: []Condition{{Field: "referrer", Operator: "ne", Value: ""}}}}

	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{"referrer": "x.com"}}); action != "block" {
		t.Fatalf("a present referrer should satisfy `referrer ne \"\"`, got %q", action)
	}
	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{}}); action != "allow" {
		t.Fatalf("an absent referrer should not satisfy `referrer ne \"\"`, got %q", action)
	}
}

// A cold intel lookup must not turn `is_proxy ne 1` into "match everyone".
func TestNotEqualsOnColdIntelDoesNotMatchEveryone(t *testing.T) {
	rs := []Rule{{Action: "block",
		Conditions: []Condition{{Field: "is_proxy", Operator: "ne", Value: "1"}}}}
	if action, _, _ := Evaluate(rs, Event{Fields: map[string]string{}}); action != "allow" {
		t.Fatalf("unresolved intel must not satisfy `is_proxy ne 1`, got %q", action)
	}
}

package rules

import "testing"

// Locks the field-name contract for the deeper targeting signals: the engine
// matches them generically, but the names must line up with what main.go puts
// in the Fields map and what the dashboard offers.
func TestDeeperSignalFieldsMatch(t *testing.T) {
	rule := Rule{Action: "block", Conditions: []Condition{
		{Field: "connection_type", Operator: "eq", Value: "Data Center"},
	}}
	ev := Event{Fields: map[string]string{"connection_type": "Data Center"}}
	if a, _, _ := Evaluate([]Rule{rule}, ev); a != "block" {
		t.Fatalf("connection_type eq should block, got %q", a)
	}

	ispRule := Rule{Action: "review", Conditions: []Condition{
		{Field: "isp", Operator: "contains", Value: "amazon"},
	}}
	ev2 := Event{Fields: map[string]string{"isp": "Amazon Technologies Inc"}}
	if a, _, _ := Evaluate([]Rule{ispRule}, ev2); a != "review" {
		t.Fatalf("isp contains should match case-insensitively, got %q", a)
	}

	// A field the visitor doesn't carry must not match.
	langRule := Rule{Action: "block", Conditions: []Condition{
		{Field: "language", Operator: "eq", Value: "ru"},
	}}
	if a, _, _ := Evaluate([]Rule{langRule}, Event{Fields: map[string]string{"language": "en-us"}}); a != "allow" {
		t.Fatalf("language mismatch should fall through to allow, got %q", a)
	}
}

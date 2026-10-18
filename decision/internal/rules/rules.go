package rules

import (
	"encoding/json"
	"strconv"
	"strings"
)

type Condition struct {
	Field    string `json:"field"`
	Operator string `json:"operator"`
	Value    string `json:"value"`
}

type Rule struct {
	Action     string      `json:"action"`
	Tag        string      `json:"tag"`
	Redirect   string      `json:"redirect_url"`
	Conditions []Condition `json:"conditions"`
}

// Event is the flattened context a rule is evaluated against.
type Event struct {
	RiskScore int
	Rate      int               // requests/minute from this visitor (rate limiting)
	Fields    map[string]string // classification, country, device, browser, os, utm_*, referrer, is_bot, is_proxy, path
}

// Parse decodes the JSON rule list stored in Redis. Nil/invalid -> no rules.
func Parse(raw string) []Rule {
	if raw == "" {
		return nil
	}
	var rs []Rule
	if err := json.Unmarshal([]byte(raw), &rs); err != nil {
		return nil
	}
	return rs
}

// Evaluate returns the action, tag and redirect URL of the first fully-matching
// rule. No match -> "allow", "", "".
func Evaluate(rs []Rule, ev Event) (string, string, string) {
	for _, r := range rs {
		if matches(r, ev) {
			return r.Action, r.Tag, r.Redirect
		}
	}
	return "allow", "", ""
}

func matches(r Rule, ev Event) bool {
	if len(r.Conditions) == 0 {
		return false
	}
	for _, c := range r.Conditions {
		if !condMatch(c, ev) {
			return false // all conditions must hold (AND)
		}
	}
	return true
}

func condMatch(c Condition, ev Event) bool {
	if c.Field == "risk_score" {
		return numMatch(ev.RiskScore, c.Operator, c.Value)
	}
	if c.Field == "requests_per_min" {
		return numMatch(ev.Rate, c.Operator, c.Value)
	}
	actual := strings.ToLower(ev.Fields[c.Field])
	want := strings.ToLower(strings.TrimSpace(c.Value))
	switch c.Operator {
	case "eq":
		return actual == want
	case "ne":
		// A rule acts on what we know, not on what we failed to find out.
		//
		// An absent or empty field used to satisfy "not equals" — so
		// `Country is not US` turned away every visitor whose country could
		// not be determined, and `Proxy is not Yes` matched everyone while the
		// intel lookup was still cold. That is a silent false positive on real
		// customers, and the customer-visible symptom was users landing on the
		// decoy page for no reason they could see.
		//
		// Testing emptiness explicitly (want == "") still works, because then
		// the absence IS the thing being asked about.
		if actual == "" && want != "" {
			return false
		}
		return actual != want
	case "contains":
		return strings.Contains(actual, want)
	case "in":
		for _, v := range strings.Split(want, ",") {
			if actual == strings.TrimSpace(v) {
				return true
			}
		}
		return false
	}
	return false
}

func numMatch(actual int, op, valStr string) bool {
	want, err := strconv.Atoi(strings.TrimSpace(valStr))
	if err != nil {
		return false
	}
	switch op {
	case "eq":
		return actual == want
	case "ne":
		return actual != want
	case "gt":
		return actual > want
	case "gte":
		return actual >= want
	case "lt":
		return actual < want
	case "lte":
		return actual <= want
	}
	return false
}

// IntelFields are the condition fields whose values come from an IP-intelligence
// lookup rather than from the request itself.
var IntelFields = map[string]bool{
	"is_proxy": true, "is_vpn": true, "is_datacenter": true,
	"isp": true, "asn": true, "connection_type": true, "is_mobile": true,
}

// NeedsIntel reports whether any rule in the set tests an IP-intelligence field.
//
// The engine reads intel from cache and refills it in the background, which is
// right for enrichment and wrong for a decision: the FIRST request from an
// unseen IP would be judged against empty intel and allowed through, so a
// customer testing "turn on my VPN and load the page" sees exactly the traffic
// they just blocked. When this returns true the caller resolves the lookup
// synchronously instead, paying the latency only on sites whose rules actually
// depend on it.
func NeedsIntel(rs []Rule) bool {
	for _, r := range rs {
		for _, c := range r.Conditions {
			if IntelFields[c.Field] {
				return true
			}
		}
	}
	return false
}

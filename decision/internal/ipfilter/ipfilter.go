// Package ipfilter evaluates a visitor IP against workspace allow/deny lists.
// Entries may be exact IPs or CIDR ranges. Allow (whitelist) takes precedence
// over Deny (blacklist); both take precedence over scored traffic rules.
package ipfilter

import (
	"encoding/json"
	"net"
)

type Lists struct {
	Allow []string `json:"allow"`
	Deny  []string `json:"deny"`
}

// Decision is the result of matching an IP against the lists.
type Decision int

const (
	None Decision = iota // no match
	Allow
	Deny
)

// Parse decodes the JSON payload. Empty/invalid -> empty lists.
func Parse(raw string) Lists {
	if raw == "" {
		return Lists{}
	}
	var l Lists
	if err := json.Unmarshal([]byte(raw), &l); err != nil {
		return Lists{}
	}
	return l
}

// Match reports whether ip falls in the allow or deny lists. Allow wins.
func Match(l Lists, ip string) Decision {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return None
	}
	if contains(l.Allow, ip, parsed) {
		return Allow
	}
	if contains(l.Deny, ip, parsed) {
		return Deny
	}
	return None
}

func contains(entries []string, ip string, parsed net.IP) bool {
	for _, e := range entries {
		if e == ip {
			return true
		}
		if _, cidr, err := net.ParseCIDR(e); err == nil && cidr.Contains(parsed) {
			return true
		}
	}
	return false
}

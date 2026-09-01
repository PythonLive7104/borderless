package ipfilter

import "testing"

func TestMatch(t *testing.T) {
	l := Parse(`{"allow":["9.9.9.9","203.0.113.0/24"],"deny":["1.2.3.4","10.0.0.0/8"]}`)
	cases := []struct {
		ip   string
		want Decision
	}{
		{"9.9.9.9", Allow},        // exact allow
		{"203.0.113.55", Allow},   // allow CIDR
		{"1.2.3.4", Deny},         // exact deny
		{"10.5.6.7", Deny},        // deny CIDR
		{"8.8.8.8", None},         // no match
		{"not-an-ip", None},       // invalid
	}
	for _, c := range cases {
		if got := Match(l, c.ip); got != c.want {
			t.Errorf("Match(%q) = %v, want %v", c.ip, got, c.want)
		}
	}
	// allow precedence: an IP in both lists resolves to Allow
	both := Parse(`{"allow":["5.5.5.5"],"deny":["5.5.5.5"]}`)
	if Match(both, "5.5.5.5") != Allow {
		t.Error("allow should win over deny")
	}
	// empty payload
	if Match(Parse(""), "1.2.3.4") != None {
		t.Error("empty payload should match nothing")
	}
}

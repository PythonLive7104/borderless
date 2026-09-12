// Package crawler identifies legitimate search-engine and safety crawlers so
// the engine can let them see exactly what a real visitor sees.
//
// Why this exists: if Googlebot is scored as a bot and served a decoy, a block,
// or a redirect while humans get the real page, Google sees the site behaving
// one way for it and another for everyone else. That is cloaking, and it is one
// of the surest ways to earn a "deceptive site" Safe Browsing flag — which is
// exactly the "Chrome marks my site risky for no reason" complaint. Letting
// verified crawlers through removes the signal.
//
// Verification is by forward-confirmed reverse DNS, the method Google, Bing and
// others document: look up the PTR record for the IP, check the hostname ends
// in the crawler's own domain, then confirm that hostname resolves back to the
// same IP. A user-agent string alone is never trusted — anyone can send
// "Googlebot" — so a spoofed UA from a random IP fails the DNS step and is
// treated as the bot it is.
package crawler

import (
	"context"
	"net"
	"strings"
	"sync"
	"time"
)

// A claimed crawler token in the UA maps to the rDNS suffixes its IPs must end
// in. Suffixes are matched with a leading dot so "notgoogle.com" can't pass as
// "google.com".
var crawlers = []struct {
	token    string
	suffixes []string
}{
	{"googlebot", []string{".googlebot.com", ".google.com"}},
	{"google-safety", []string{".google.com", ".googlebot.com"}},   // Safe Browsing fetcher
	{"adsbot-google", []string{".google.com", ".googlebot.com"}},
	{"apis-google", []string{".google.com"}},
	{"mediapartners-google", []string{".google.com", ".googlebot.com"}},
	{"bingbot", []string{".search.msn.com"}},
	{"msnbot", []string{".search.msn.com"}},
	{"bingpreview", []string{".search.msn.com"}},
	{"duckduckbot", []string{".duckduckgo.com"}},
	{"yandexbot", []string{".yandex.com", ".yandex.net", ".yandex.ru"}},
	{"applebot", []string{".applebot.apple.com", ".apple.com"}},
}

// Claims reports whether the UA presents itself as one of the crawlers above,
// returning the matched token. It does NOT prove anything — Verify does.
func Claims(ua string) (string, bool) {
	lua := strings.ToLower(ua)
	for _, c := range crawlers {
		if strings.Contains(lua, c.token) {
			return c.token, true
		}
	}
	return "", false
}

// Overridable in tests so the suite never touches real DNS.
var (
	lookupAddr = net.DefaultResolver.LookupAddr
	lookupHost = net.DefaultResolver.LookupHost
	dnsTimeout = 800 * time.Millisecond
)

type cacheEntry struct {
	ok  bool
	exp time.Time
}

var (
	cacheMu sync.Mutex
	cache   = map[string]cacheEntry{}
)

const (
	posTTL = time.Hour        // a verified crawler IP stays verified a while
	negTTL = 10 * time.Minute // spoofed claims: don't re-resolve on every hit
)

// Verify returns true only for a forward-confirmed crawler: the UA claims a
// known crawler AND reverse DNS on the IP confirms it. Results are cached, and
// negatives are cached too so a flood of spoofed "Googlebot" hits from random
// IPs can't turn into a reverse-DNS amplifier.
func Verify(ctx context.Context, ip, ua string) bool {
	token, ok := Claims(ua)
	if !ok || ip == "" {
		return false
	}

	key := ip + "|" + token
	cacheMu.Lock()
	if e, hit := cache[key]; hit && time.Now().Before(e.exp) {
		cacheMu.Unlock()
		return e.ok
	}
	cacheMu.Unlock()

	result := confirm(ctx, ip, token)

	cacheMu.Lock()
	ttl := negTTL
	if result {
		ttl = posTTL
	}
	cache[key] = cacheEntry{ok: result, exp: time.Now().Add(ttl)}
	cacheMu.Unlock()
	return result
}

func confirm(ctx context.Context, ip, token string) bool {
	var suffixes []string
	for _, c := range crawlers {
		if c.token == token {
			suffixes = c.suffixes
			break
		}
	}
	if len(suffixes) == 0 {
		return false
	}

	ctx, cancel := context.WithTimeout(ctx, dnsTimeout)
	defer cancel()

	names, err := lookupAddr(ctx, ip)
	if err != nil {
		return false
	}
	for _, name := range names {
		host := strings.ToLower(strings.TrimSuffix(name, "."))
		if !hasSuffix(host, suffixes) {
			continue
		}
		// Forward-confirm: the PTR hostname must resolve back to this IP.
		addrs, err := lookupHost(ctx, host)
		if err != nil {
			continue
		}
		for _, a := range addrs {
			if a == ip {
				return true
			}
		}
	}
	return false
}

func hasSuffix(host string, suffixes []string) bool {
	for _, s := range suffixes {
		if strings.HasSuffix(host, s) {
			return true
		}
	}
	return false
}

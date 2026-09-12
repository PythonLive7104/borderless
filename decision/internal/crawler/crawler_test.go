package crawler

import (
	"context"
	"errors"
	"testing"
	"time"
)

// stubDNS wires the package's resolver hooks to fixed answers, so no test ever
// touches real DNS, and resets the cache between cases.
func stubDNS(t *testing.T, ptr map[string][]string, fwd map[string][]string) {
	t.Helper()
	lookupAddr = func(_ context.Context, ip string) ([]string, error) {
		if names, ok := ptr[ip]; ok {
			return names, nil
		}
		return nil, errors.New("no PTR")
	}
	lookupHost = func(_ context.Context, host string) ([]string, error) {
		if addrs, ok := fwd[host]; ok {
			return addrs, nil
		}
		return nil, errors.New("nxdomain")
	}
	cacheMu.Lock()
	cache = map[string]cacheEntry{}
	cacheMu.Unlock()
	t.Cleanup(func() {
		lookupAddr = nil
		lookupHost = nil
	})
}

func TestGenuineGooglebotVerifies(t *testing.T) {
	stubDNS(t,
		map[string][]string{"66.249.66.1": {"crawl-66-249-66-1.googlebot.com."}},
		map[string][]string{"crawl-66-249-66-1.googlebot.com": {"66.249.66.1"}},
	)
	if !Verify(context.Background(), "66.249.66.1", "Mozilla/5.0 (compatible; Googlebot/2.1)") {
		t.Fatal("genuine Googlebot should verify")
	}
}

func TestSpoofedUAFromRandomIPFails(t *testing.T) {
	// UA says Googlebot, but the IP has no google PTR — the classic cloaking probe.
	stubDNS(t,
		map[string][]string{"5.6.7.8": {"host.evil.example."}},
		map[string][]string{"host.evil.example": {"5.6.7.8"}},
	)
	if Verify(context.Background(), "5.6.7.8", "Googlebot/2.1") {
		t.Fatal("spoofed Googlebot UA must not verify")
	}
}

func TestForwardConfirmMismatchFails(t *testing.T) {
	// PTR looks right, but the hostname resolves to a different IP — spoofed PTR.
	stubDNS(t,
		map[string][]string{"9.9.9.9": {"crawl.googlebot.com."}},
		map[string][]string{"crawl.googlebot.com": {"66.249.66.1"}},
	)
	if Verify(context.Background(), "9.9.9.9", "Googlebot") {
		t.Fatal("forward-confirm mismatch must not verify")
	}
}

func TestLookalikeSuffixRejected(t *testing.T) {
	// "notgooglebot.com" must not satisfy the ".googlebot.com" suffix.
	stubDNS(t,
		map[string][]string{"1.2.3.4": {"crawl.notgooglebot.com."}},
		map[string][]string{"crawl.notgooglebot.com": {"1.2.3.4"}},
	)
	if Verify(context.Background(), "1.2.3.4", "Googlebot") {
		t.Fatal("lookalike domain must not pass the suffix check")
	}
}

func TestNonCrawlerUAShortCircuits(t *testing.T) {
	stubDNS(t, nil, nil)
	if Verify(context.Background(), "66.249.66.1", "Mozilla/5.0 (Windows NT 10.0) Chrome/120") {
		t.Fatal("a normal browser UA is not a crawler claim")
	}
}

func TestBingbotVerifies(t *testing.T) {
	stubDNS(t,
		map[string][]string{"157.55.39.1": {"msnbot-157-55-39-1.search.msn.com."}},
		map[string][]string{"msnbot-157-55-39-1.search.msn.com": {"157.55.39.1"}},
	)
	if !Verify(context.Background(), "157.55.39.1", "Mozilla/5.0 (compatible; bingbot/2.0)") {
		t.Fatal("genuine bingbot should verify")
	}
}

func TestNegativeResultIsCached(t *testing.T) {
	calls := 0
	lookupAddr = func(_ context.Context, ip string) ([]string, error) {
		calls++
		return []string{"host.evil.example."}, nil
	}
	lookupHost = func(_ context.Context, host string) ([]string, error) {
		return []string{"5.5.5.5"}, nil
	}
	cacheMu.Lock()
	cache = map[string]cacheEntry{}
	cacheMu.Unlock()
	t.Cleanup(func() { lookupAddr = nil; lookupHost = nil })

	for i := 0; i < 5; i++ {
		Verify(context.Background(), "5.5.5.5", "Googlebot")
	}
	if calls != 1 {
		t.Fatalf("spoofed claim should resolve once then cache; got %d lookups", calls)
	}
}

func TestClaims(t *testing.T) {
	for _, ua := range []string{"Googlebot/2.1", "compatible; bingbot/2.0", "DuckDuckBot/1.1"} {
		if _, ok := Claims(ua); !ok {
			t.Errorf("expected %q to be recognised as a crawler claim", ua)
		}
	}
	if _, ok := Claims("Mozilla/5.0 Chrome/120"); ok {
		t.Error("a normal browser UA should not be a crawler claim")
	}
}

var _ = time.Second // keep time import if trimmed later

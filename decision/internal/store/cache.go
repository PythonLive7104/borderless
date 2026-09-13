package store

import (
	"sync"
	"time"
)

// ttlCache is a tiny concurrent string cache with per-entry expiry. It fronts
// the per-site config reads (rules, ip-filter) that happen on every decision
// but change only when a customer edits them — turning a Redis round-trip per
// request into an occasional one. Staleness is bounded by the TTL (a few
// seconds), which is fine for additive filters: a just-added rule takes effect
// a moment later, never sooner-than-safe.
type ttlCache struct {
	mu  sync.RWMutex
	m   map[string]cacheItem
	ttl time.Duration
}

type cacheItem struct {
	val string
	exp time.Time
}

func newTTLCache(ttl time.Duration) *ttlCache {
	return &ttlCache{m: make(map[string]cacheItem), ttl: ttl}
}

// get returns the cached value and whether it was a live (unexpired) hit.
func (c *ttlCache) get(key string) (string, bool) {
	c.mu.RLock()
	it, ok := c.m[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(it.exp) {
		return "", false
	}
	return it.val, true
}

func (c *ttlCache) set(key, val string) {
	c.mu.Lock()
	c.m[key] = cacheItem{val: val, exp: time.Now().Add(c.ttl)}
	// Opportunistic sweep so the map can't grow without bound on a long-lived
	// process seeing many distinct sites. Cheap: only runs when it's large.
	if len(c.m) > 10000 {
		now := time.Now()
		for k, v := range c.m {
			if now.After(v.exp) {
				delete(c.m, k)
			}
		}
	}
	c.mu.Unlock()
}

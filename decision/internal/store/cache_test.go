package store

import (
	"testing"
	"time"
)

func TestTTLCacheHitAndExpiry(t *testing.T) {
	c := newTTLCache(50 * time.Millisecond)
	c.set("rules:1", "payload")
	if v, ok := c.get("rules:1"); !ok || v != "payload" {
		t.Fatalf("expected live hit, got %q ok=%v", v, ok)
	}
	time.Sleep(70 * time.Millisecond)
	if _, ok := c.get("rules:1"); ok {
		t.Fatal("entry should have expired")
	}
}

func TestTTLCacheMiss(t *testing.T) {
	c := newTTLCache(time.Second)
	if _, ok := c.get("absent"); ok {
		t.Fatal("missing key must be a miss")
	}
}

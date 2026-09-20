package store

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type Store struct {
	rdb *redis.Client
	cfg *ttlCache // per-site config (rules, ip-filter) — read every request
}

func New(redisURL string) (*Store, error) {
	return NewWithTTL(redisURL, 3*time.Second)
}

// NewWithTTL lets the config-cache TTL be tuned (0 disables caching).
func NewWithTTL(redisURL string, cfgTTL time.Duration) (*Store, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Store{rdb: redis.NewClient(opt), cfg: newTTLCache(cfgTTL)}, nil
}

// cachedGet fronts a Redis GET with the in-process config cache. A miss (and a
// disabled cache, ttl<=0) falls through to Redis and is cached on the way back.
func (s *Store) cachedGet(ctx context.Context, key string) string {
	if s.cfg != nil && s.cfg.ttl > 0 {
		if v, ok := s.cfg.get(key); ok {
			return v
		}
	}
	v, err := s.rdb.Get(ctx, key).Result()
	if err != nil {
		v = ""
	}
	if s.cfg != nil && s.cfg.ttl > 0 {
		s.cfg.set(key, v)
	}
	return v
}

func (s *Store) Ping(ctx context.Context) error {
	return s.rdb.Ping(ctx).Err()
}

// EmitTraffic appends one ingested event to the events:traffic stream,
// which the Django consume_traffic worker reads into Postgres.
func (s *Store) EmitTraffic(ctx context.Context, fields map[string]any) {
	fields["ts"] = time.Now().Unix()
	s.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: "events:traffic",
		Values: fields,
		MaxLen: 5_000_000,
		Approx: true,
	})
}

// RateIncr increments a short-lived counter and returns the new count.
// Used to detect abnormal request rates per visitor/IP.
func (s *Store) RateIncr(ctx context.Context, key string, ttl time.Duration) int64 {
	pipe := s.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0
	}
	return incr.Val()
}

// InSet reports whether member is in the given Redis set (IP intelligence sets).
func (s *Store) InSet(ctx context.Context, key, member string) bool {
	if member == "" {
		return false
	}
	ok, _ := s.rdb.SIsMember(ctx, key, member).Result()
	return ok
}

// GetStr returns the raw string value at key ("" if missing). Used by the
// server-side shield to resolve apikey:{hash} and site:{tid} -> org id.
func (s *Store) GetStr(ctx context.Context, key string) string {
	v, err := s.rdb.Get(ctx, key).Result()
	if err != nil {
		return ""
	}
	return v
}

// GetRules returns the raw rules JSON for a site (empty string if none).
func (s *Store) GetRules(ctx context.Context, siteID string) string {
	return s.cachedGet(ctx, "rules:"+siteID)
}

// GetIPFilter returns the raw JSON allow/deny lists for a site ("" if none).
func (s *Store) GetIPFilter(ctx context.Context, siteID string) string {
	return s.cachedGet(ctx, "ipfilter:"+siteID)
}

// SetEx writes a value with a TTL. Used to share the IP-intelligence cache with
// the Django side, which reads and writes the same ipintel:cache:<ip> keys.
func (s *Store) SetEx(ctx context.Context, key, val string, ttl time.Duration) {
	s.rdb.Set(ctx, key, val, ttl)
}

// SAdd adds a member to a set, best effort.
func (s *Store) SAdd(ctx context.Context, key, member string) {
	s.rdb.SAdd(ctx, key, member)
}

// --- Shared threat corpus (cross-customer network defense) -------------------
//
// A single bot farm attacks many customers, rotating IPs but reusing the same
// TLS (JA3/JA4) and browser (fp-hash) fingerprint. We turn that against it: an
// identifier caught attacking ANY customer becomes known to ALL of them.
//
// Safety first. A JA3 or fp-hash is NOT unique to a bot — thousands of real
// users share one — so a single sighting can never blocklist a fingerprint, or
// we would punish legitimate visitors who happen to share it. Instead each
// fingerprint holds a SET of the distinct IPs that were CONFIRMED bad while
// carrying it. A legit fingerprint never accumulates confirmed-bad IPs; a bot
// farm's fingerprint racks them up fast. The set's cardinality is the evidence.

// corpusTTL is how long a fingerprint's bad-IP evidence is retained; refreshed
// on every new sighting, so an actively-abused fingerprint never expires while
// a reformed one fades out.
func corpusKey(kind, hash string) string { return "corpus:" + kind + ":" + hash }

// RecordBadFingerprint files a confirmed-bad IP under each fingerprint it used,
// so the next customer to see that fingerprint benefits. Best-effort and meant
// to be called off the hot path (goroutine); adds nothing to decision latency.
func (s *Store) RecordBadFingerprint(ctx context.Context, ip, ja3, ja4, fp string, ttl time.Duration) {
	if ip == "" {
		return
	}
	pipe := s.rdb.Pipeline()
	for _, kv := range []struct{ kind, hash string }{{"ja3", ja3}, {"ja4", ja4}, {"fp", fp}} {
		if kv.hash == "" {
			continue
		}
		key := corpusKey(kv.kind, kv.hash)
		pipe.SAdd(ctx, key, ip)
		pipe.Expire(ctx, key, ttl) // sliding window: refreshed while abuse continues
	}
	_, _ = pipe.Exec(ctx)
}

// FingerprintBadIPs returns, for each present fingerprint, how many DISTINCT
// confirmed-bad IPs have carried it. One pipelined round-trip. The caller
// compares the max against a threshold to decide "corroborated bad".
func (s *Store) FingerprintBadIPs(ctx context.Context, ja3, ja4, fp string) int64 {
	type q struct {
		hash string
		cmd  *redis.IntCmd
	}
	pipe := s.rdb.Pipeline()
	qs := []q{}
	for _, kv := range []struct{ kind, hash string }{{"ja3", ja3}, {"ja4", ja4}, {"fp", fp}} {
		if kv.hash == "" {
			continue
		}
		qs = append(qs, q{kv.hash, pipe.SCard(ctx, corpusKey(kv.kind, kv.hash))})
	}
	if len(qs) == 0 {
		return 0
	}
	if _, err := pipe.Exec(ctx); err != nil {
		return 0
	}
	var max int64
	for _, x := range qs {
		if v := x.cmd.Val(); v > max {
			max = v
		}
	}
	return max
}

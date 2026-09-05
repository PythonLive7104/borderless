package store

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type Store struct {
	rdb *redis.Client
}

func New(redisURL string) (*Store, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return &Store{rdb: redis.NewClient(opt)}, nil
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
	v, err := s.rdb.Get(ctx, "rules:"+siteID).Result()
	if err != nil {
		return ""
	}
	return v
}

// GetIPFilter returns the raw JSON allow/deny lists for a site ("" if none).
func (s *Store) GetIPFilter(ctx context.Context, siteID string) string {
	v, err := s.rdb.Get(ctx, "ipfilter:"+siteID).Result()
	if err != nil {
		return ""
	}
	return v
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

// Package geo provides real-time IP-to-country lookups using a local MMDB
// database, so country rules work without an edge (Cloudflare) header.
// It uses the free DB-IP Lite country database (no API key required); a
// MaxMind GeoLite2-Country.mmdb also works if mounted via GEOIP_DB.
package geo

import (
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"sync"
	"time"

	"github.com/oschwald/maxminddb-golang"
)

var (
	db   *maxminddb.Reader
	once sync.Once
)

func urls() []string {
	now := time.Now()
	prev := now.AddDate(0, -1, 0)
	f := "https://download.db-ip.com/free/dbip-country-lite-%d-%02d.mmdb.gz"
	return []string{
		fmt.Sprintf(f, now.Year(), int(now.Month())),
		fmt.Sprintf(f, prev.Year(), int(prev.Month())),
	}
}

// Init loads a country DB. If GEOIP_DB points to an existing .mmdb it uses that;
// otherwise it downloads the free DB-IP Lite database to /tmp. Failures are
// non-fatal — Country() simply returns "" until a DB is available.
func Init(path string) {
	once.Do(func() {
		if path == "" {
			path = "/tmp/dbip-country.mmdb"
		}
		if _, err := os.Stat(path); err != nil {
			if derr := download(path); derr != nil {
				log.Printf("geo: no country DB (%v) — real-time country disabled", derr)
				return
			}
		}
		r, err := maxminddb.Open(path)
		if err != nil {
			log.Printf("geo: open failed: %v", err)
			return
		}
		db = r
		log.Printf("geo: country DB loaded from %s", path)
	})
}

func download(dest string) error {
	for _, u := range urls() {
		resp, err := httpGet(u)
		if err != nil {
			continue
		}
		gz, err := gzip.NewReader(resp)
		if err != nil {
			resp.Close()
			continue
		}
		out, err := os.Create(dest)
		if err != nil {
			gz.Close()
			resp.Close()
			return err
		}
		_, cErr := io.Copy(out, gz)
		out.Close()
		gz.Close()
		resp.Close()
		if cErr == nil {
			return nil
		}
	}
	return fmt.Errorf("all DB-IP download URLs failed")
}

// Country returns the ISO-3166 alpha-2 country code for an IP, or "".
func Country(ipStr string) string {
	if db == nil {
		return ""
	}
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return ""
	}
	var rec struct {
		Country struct {
			ISOCode string `maxminddb:"iso_code"`
		} `maxminddb:"country"`
	}
	if err := db.Lookup(ip, &rec); err != nil {
		return ""
	}
	return rec.Country.ISOCode
}

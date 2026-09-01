package main

import (
	"context"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"borderless/decision/internal/fingerprint"
	"borderless/decision/internal/geo"
	"borderless/decision/internal/ipfilter"
	"borderless/decision/internal/risk"
	"borderless/decision/internal/rules"
	"borderless/decision/internal/store"
)

//go:embed tracker.js
var trackerJS []byte

type CollectPayload struct {
	SiteID      string  `json:"site_id"`
	VisitorID   string  `json:"visitor_id"`
	SessionID   string  `json:"session_id"`
	Type        string  `json:"type"`
	URL         string  `json:"url"`
	Referrer    string  `json:"referrer"`
	UTMSource   string  `json:"utm_source"`
	UTMMedium   string  `json:"utm_medium"`
	UTMCampaign string  `json:"utm_campaign"`
	EventName   string  `json:"event_name"`
	Revenue     float64 `json:"revenue"`
	Currency    string  `json:"currency"`
	FP          *FP     `json:"fp"`
}

type FP struct {
	Hash       string   `json:"hash"`
	Platform   string   `json:"platform"`
	Webdriver  bool     `json:"webdriver"`
	Plugins    int      `json:"plugins"`
	HW         int      `json:"hw"`
	GLRenderer string   `json:"glrenderer"`
	Flags      []string `json:"flags"`
}

func main() {
	redisURL := env("REDIS_URL", "redis://localhost:6379/0")
	port := env("DECISION_PORT", "8080")

	st, err := store.New(redisURL)
	if err != nil {
		log.Fatalf("redis init: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := st.Ping(ctx); err != nil {
		log.Printf("warning: redis ping failed: %v", err)
	}

	go geo.Init(env("GEOIP_DB", ""))  // real-time IP->country (free DB-IP lite)

	h := &handler{st: st}
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) })
	mux.HandleFunc("/bl.js", serveTracker)
	mux.HandleFunc("/v1/collect", h.collect)

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	log.Printf("Borderless traffic engine listening on :%s", port)
	log.Fatal(srv.ListenAndServe())
}

type handler struct{ st *store.Store }

func serveTracker(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Write(trackerJS)
}

func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// POST /v1/collect — ingest one tracker event.
func (h *handler) collect(w http.ResponseWriter, r *http.Request) {
	cors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 64*1024))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	var p CollectPayload
	if err := json.Unmarshal(body, &p); err != nil || p.SiteID == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	if p.Type == "" {
		p.Type = "pageview"
	}

	fp := fingerprint.Extract(r)
	if fp.Country == "" {
		fp.Country = geo.Country(fp.IP)  // engine-side GeoIP when no edge header
	}

	// TLS/JA3 fingerprint is supplied by a TLS-terminating upstream (Cloudflare,
	// or an Nginx/HAProxy JA3 module). Empty in plain-HTTP dev unless injected.
	ja3 := firstHeader(r, "CF-JA3-Hash", "X-JA3-Hash", "X-JA3")

	// --- risk scoring (Phase 6) ---
	rctx, rcancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer rcancel()
	rate := h.st.RateIncr(rctx, "rate:"+p.SiteID+":"+p.VisitorID, time.Minute)
	// derive fingerprint-based signals
	var fpHash, fpFlags string
	webdriver, headlessFP, noFP := false, false, p.FP == nil
	if p.FP != nil {
		fpHash = p.FP.Hash
		fpFlags = strings.Join(p.FP.Flags, ",")
		webdriver = p.FP.Webdriver
		// two or more fingerprint anomalies => headless-like
		if len(p.FP.Flags) >= 2 {
			headlessFP = true
		}
	}

	result := risk.Evaluate(risk.Input{
		KnownBot:      fp.IsBot,
		Webdriver:     webdriver,
		HeadlessFP:    headlessFP,
		Automation:    fp.IsHeadless,
		Datacenter:    h.st.InSet(rctx, "ipintel:datacenter", fp.IP),
		Proxy:         h.st.InSet(rctx, "ipintel:proxy", fp.IP),
		NoFingerprint: noFP,
		AbnormalRate:  rate > 20, // >20 events/min from one visitor
		BadJA3:        ja3 != "" && h.st.InSet(rctx, "ja3:blocklist", ja3),
	})
	// --- traffic rules (Phase 8): evaluate after scoring ---
	ruleSet := rules.Parse(h.st.GetRules(rctx, p.SiteID))
	action, tag, redirect := rules.Evaluate(ruleSet, rules.Event{
		RiskScore: result.Score,
		Fields: map[string]string{
			"classification": result.Classification,
			"country":        fp.Country,
			"device":         fp.Device,
			"browser":        fp.Browser,
			"os":             fp.OS,
			"is_bot":         boolStr(fp.IsBot),
			"is_proxy":       boolStr(h.st.InSet(rctx, "ipintel:datacenter", fp.IP) || h.st.InSet(rctx, "ipintel:proxy", fp.IP)),
			"utm_source":     p.UTMSource,
			"utm_medium":     p.UTMMedium,
			"utm_campaign":   p.UTMCampaign,
			"referrer":       p.Referrer,
			"ja3":            ja3,
		},
	})

	// --- IP allow/deny lists: whitelist always passes, blacklist blocks;
	// both take precedence over the scored rules above. ---
	switch ipfilter.Match(ipfilter.Parse(h.st.GetIPFilter(rctx, p.SiteID)), fp.IP) {
	case ipfilter.Allow:
		action, tag, redirect = "allow", "", ""
		result.Signals = append(result.Signals, "ip_allowlisted")
	case ipfilter.Deny:
		action, redirect = "block", ""
		result.Signals = append(result.Signals, "ip_blocklisted")
	}
	signalsJSON, _ := json.Marshal(result.Signals)

	fields := map[string]any{
		"site_id":      p.SiteID,
		"visitor_id":   p.VisitorID,
		"session_id":   p.SessionID,
		"type":         p.Type,
		"url":          p.URL,
		"referrer":     p.Referrer,
		"utm_source":   p.UTMSource,
		"utm_medium":   p.UTMMedium,
		"utm_campaign": p.UTMCampaign,
		"event_name":   p.EventName,
		"revenue":      p.Revenue,
		"currency":     p.Currency,
		"ip":           fp.IP,
		"country":      fp.Country,
		"device":       fp.Device,
		"browser":      fp.Browser,
		"os":           fp.OS,
		"ua":           fp.UserAgent,
		"is_headless":  boolStr(fp.IsHeadless),
		"risk_score":   result.Score,
		"classification": result.Classification,
		"confidence":   fmt.Sprintf("%.2f", result.Confidence),
		"signals":      string(signalsJSON),
		"fingerprint":  fpHash,
		"fp_flags":     fpFlags,
		"ja3":          ja3,
		"action":       action,
		"tag":          tag,
		"redirect_url": redirect,
	}
	// fire-and-forget; never block the caller
	go h.st.EmitTraffic(context.Background(), fields)

	// Tell the tracker what to do. Only "redirect" carries a URL the browser
	// acts on; everything else is a no-op decision (logged only).
	if action == "redirect" && redirect != "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"action": "redirect", "redirect": redirect})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func boolStr(b bool) string {
	if b {
		return "1"
	}
	return "0"
}

// firstHeader returns the first non-empty value among the given header names.
func firstHeader(r *http.Request, names ...string) string {
	for _, n := range names {
		if v := strings.TrimSpace(r.Header.Get(n)); v != "" {
			return v
		}
	}
	return ""
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

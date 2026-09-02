package main

import (
	"context"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
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

// DecidePayload is the server-side shield request: a customer's server sends the
// visitor's IP/UA (and optional JA3/country) and gets a synchronous verdict so
// it can block bots BEFORE rendering the page.
type DecidePayload struct {
	SiteID   string `json:"site_id"`
	IP       string `json:"ip"`
	UA       string `json:"ua"`
	JA3      string `json:"ja3"`
	Country  string `json:"country"`
	Referrer string `json:"referrer"`
	Path     string `json:"path"`
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
	mux.HandleFunc("/v1/decide", h.decide)
	mux.HandleFunc("/v1/guard", h.guard)

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
			"path":           urlPath(p.URL),
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

// scoreResult is a normalized enforcement verdict shared by /v1/decide (JSON)
// and /v1/guard (nginx auth_request, status codes).
type scoreResult struct {
	Action, Redirect, Classification, Reason string
	Score                                    int
}

// orgForKey resolves a raw blk_ API key to its organization id via the Redis
// mapping Django publishes ("" = unknown/invalid).
func (h *handler) orgForKey(ctx context.Context, rawKey string) string {
	if rawKey == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(strings.TrimSpace(rawKey)))
	return h.st.GetStr(ctx, "apikey:"+hex.EncodeToString(sum[:]))
}

// score runs the same risk + rules + IP-filter pipeline the JS path uses, but
// from server-side signals only, and records the check to the traffic stream.
func (h *handler) score(ctx context.Context, siteID, ip, ua, ja3, country, referrer, path string) scoreResult {
	fp := fingerprint.FromValues(ip, ua, country)
	if fp.Country == "" {
		fp.Country = geo.Country(fp.IP)
	}
	rate := h.st.RateIncr(ctx, "srate:"+siteID+":"+fp.IP, time.Minute)
	result := risk.Evaluate(risk.Input{
		KnownBot:      fp.IsBot,
		Automation:    fp.IsHeadless,
		Datacenter:    h.st.InSet(ctx, "ipintel:datacenter", fp.IP),
		Proxy:         h.st.InSet(ctx, "ipintel:proxy", fp.IP),
		NoFingerprint: false,
		AbnormalRate:  rate > 40,
		BadJA3:        ja3 != "" && h.st.InSet(ctx, "ja3:blocklist", ja3),
	})
	ruleSet := rules.Parse(h.st.GetRules(ctx, siteID))
	action, tag, redirect := rules.Evaluate(ruleSet, rules.Event{
		RiskScore: result.Score,
		Fields: map[string]string{
			"classification": result.Classification,
			"country":        fp.Country,
			"device":         fp.Device,
			"browser":        fp.Browser,
			"os":             fp.OS,
			"is_bot":         boolStr(fp.IsBot),
			"is_proxy":       boolStr(h.st.InSet(ctx, "ipintel:datacenter", fp.IP) || h.st.InSet(ctx, "ipintel:proxy", fp.IP)),
			"referrer":       referrer,
			"ja3":            ja3,
			"path":           urlPath(path),
		},
	})
	switch ipfilter.Match(ipfilter.Parse(h.st.GetIPFilter(ctx, siteID)), fp.IP) {
	case ipfilter.Allow:
		action, redirect = "allow", ""
	case ipfilter.Deny:
		action, redirect = "block", ""
	}
	sigJSON, _ := json.Marshal(result.Signals)
	go h.st.EmitTraffic(context.Background(), map[string]any{
		"site_id": siteID, "visitor_id": "server:" + fp.IP, "session_id": "",
		"type": "server_check", "url": path, "referrer": referrer,
		"ip": fp.IP, "country": fp.Country, "device": fp.Device, "browser": fp.Browser, "os": fp.OS,
		"ua": fp.UserAgent, "is_headless": boolStr(fp.IsHeadless),
		"risk_score": result.Score, "classification": result.Classification,
		"confidence": fmt.Sprintf("%.2f", result.Confidence), "signals": string(sigJSON),
		"ja3": ja3, "action": action, "tag": tag, "redirect_url": redirect,
	})
	verdict := "allow"
	if action == "block" {
		verdict = "block"
	} else if action == "redirect" && redirect != "" {
		verdict = "redirect"
	}
	return scoreResult{Action: verdict, Redirect: redirect, Classification: result.Classification,
		Score: result.Score, Reason: strings.Join(result.Signals, ",")}
}

// POST /v1/decide — synchronous JSON verdict for app code (PHP/Django/Node).
// Fails open: any auth/parse problem returns action="allow".
func (h *handler) decide(w http.ResponseWriter, r *http.Request) {
	cors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"action": "allow", "error": "POST only"})
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	auth := r.Header.Get("Authorization")
	const pfx = "Bearer "
	if !strings.HasPrefix(auth, pfx) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"action": "allow", "error": "missing API key"})
		return
	}
	keyOrg := h.orgForKey(ctx, auth[len(pfx):])
	if keyOrg == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"action": "allow", "error": "invalid API key"})
		return
	}
	body, _ := io.ReadAll(io.LimitReader(r.Body, 16*1024))
	var p DecidePayload
	if err := json.Unmarshal(body, &p); err != nil || p.SiteID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"action": "allow", "error": "site_id required"})
		return
	}
	if org := h.st.GetStr(ctx, "site:"+p.SiteID); org == "" || org != keyOrg {
		writeJSON(w, http.StatusForbidden, map[string]any{"action": "allow", "error": "API key not valid for this site_id"})
		return
	}
	ip := p.IP
	if ip == "" {
		ip = firstHeader(r, "X-Forwarded-For", "X-Real-IP")
	}
	sr := h.score(ctx, p.SiteID, ip, p.UA, p.JA3, p.Country, p.Referrer, p.Path)
	writeJSON(w, http.StatusOK, map[string]any{
		"action": sr.Action, "redirect": sr.Redirect,
		"classification": sr.Classification, "risk_score": sr.Score, "reason": sr.Reason,
	})
}

// GET /v1/guard — nginx auth_request endpoint. Reads the visitor + credentials
// from headers nginx sets and answers with a status code: 204 allow, 403 block
// (with X-TA-Action/X-TA-Redirect headers when a redirect rule matched). Fails
// open (204) on any misconfiguration so a broken setup never blocks the site.
func (h *handler) guard(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Millisecond)
	defer cancel()

	org := h.orgForKey(ctx, r.Header.Get("X-TA-Key"))
	site := r.Header.Get("X-TA-Site")
	if org == "" || site == "" || h.st.GetStr(ctx, "site:"+site) != org {
		w.WriteHeader(http.StatusNoContent) // fail open
		return
	}
	sr := h.score(ctx, site,
		firstHeader(r, "X-TA-IP", "X-Real-IP", "X-Forwarded-For"),
		r.Header.Get("X-TA-UA"),
		firstHeader(r, "X-TA-JA3", "CF-JA3-Hash"),
		"", r.Header.Get("X-TA-Referrer"), r.Header.Get("X-TA-Path"))
	switch sr.Action {
	case "block":
		w.WriteHeader(http.StatusForbidden)
	case "redirect":
		w.Header().Set("X-TA-Action", "redirect")
		w.Header().Set("X-TA-Redirect", sr.Redirect)
		w.WriteHeader(http.StatusForbidden)
	default:
		w.WriteHeader(http.StatusNoContent) // allow
	}
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
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

// urlPath extracts just the path ("/admin") from a full URL, for Folder Guard
// rules that match on the URL path. Falls back to the raw value.
func urlPath(raw string) string {
	if raw == "" {
		return ""
	}
	if u, err := url.Parse(raw); err == nil && u.Path != "" {
		return u.Path
	}
	return raw
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

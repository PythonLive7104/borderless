package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
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
	mux.HandleFunc("/v1/challenge", h.challenge)
	mux.HandleFunc("/l/", h.shortlink)         // legacy /l/<slug>
	mux.HandleFunc("/", h.shortlink)           // bare /<slug> (short domain)

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
		Rate:      int(rate),
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
		Rate:      int(rate),
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

	body, _ := io.ReadAll(io.LimitReader(r.Body, 16*1024))
	var p DecidePayload
	if err := json.Unmarshal(body, &p); err != nil || p.SiteID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"action": "allow", "error": "site_id required"})
		return
	}
	// Auth: the public site_id alone authorizes (like the tracking snippet) — the
	// site just has to exist. An API key is OPTIONAL and, when present, must own
	// the site (stricter, server-to-server setups).
	siteOrg := h.st.GetStr(ctx, "site:"+p.SiteID)
	if siteOrg == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"action": "allow", "error": "unknown site_id"})
		return
	}
	if auth := r.Header.Get("Authorization"); strings.HasPrefix(auth, "Bearer ") {
		// A VALID key must own the site; an invalid/placeholder key is ignored.
		if keyOrg := h.orgForKey(ctx, auth[len("Bearer "):]); keyOrg != "" && keyOrg != siteOrg {
			writeJSON(w, http.StatusForbidden, map[string]any{"action": "allow", "error": "API key not valid for this site_id"})
			return
		}
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

	// Public site_id alone authorizes; an X-TA-Key is optional (must own the site
	// when present). Any misconfiguration fails open (204 = allow) so a broken
	// setup never takes the site down.
	site := r.Header.Get("X-TA-Site")
	siteOrg := h.st.GetStr(ctx, "site:"+site)
	if site == "" || siteOrg == "" {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if key := r.Header.Get("X-TA-Key"); key != "" {
		if org := h.orgForKey(ctx, key); org != "" && org != siteOrg {
			w.WriteHeader(http.StatusNoContent)
			return
		}
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

// GET /<slug> (and legacy /l/<slug>) — branded short link. Scores the click
// (using the linked site's rules when set), records it, then sends real humans
// to the destination and bots to the rule's block/redirect. Unknown/inactive
// links 404. Registered as the root catch-all so the short domain can serve
// bare-slug links (nobot.link/<slug>); on the main domain nginx only routes
// /l/, /v1/ and /bl.js here, so this never shadows the SPA.
func (h *handler) shortlink(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if strings.HasPrefix(path, "/l/") {
		path = path[len("/l"):] // "/l/<slug>" -> "/<slug>"
	}
	slug := strings.Trim(path, "/")
	if slug == "" {
		http.NotFound(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 400*time.Millisecond)
	defer cancel()

	raw := h.st.GetStr(ctx, "shortlink:"+slug)
	if raw == "" {
		http.NotFound(w, r)
		return
	}
	var link struct {
		Destination string `json:"destination"`
		TID         string `json:"tid"`
		BotAction   string `json:"bot_action"` // off | decoy | notfound | blank
		DecoyURL    string `json:"decoy_url"`
		Active      bool   `json:"active"`
		Challenge   bool   `json:"challenge"`
		ForwardQS   bool     `json:"forward_params"`
		ForwardKeys []string `json:"forward_keys"`
		BlockVPN    bool     `json:"block_vpn"`
	}
	if err := json.Unmarshal([]byte(raw), &link); err != nil || !link.Active || link.Destination == "" {
		http.NotFound(w, r)
		return
	}

	// Score the real visitor (direct hit — read IP/UA from the request).
	fp := fingerprint.Extract(r)
	if fp.Country == "" {
		fp.Country = geo.Country(fp.IP)
	}
	ja3 := firstHeader(r, "CF-JA3-Hash", "X-JA3-Hash", "X-JA3")
	rate := h.st.RateIncr(ctx, "lrate:"+slug+":"+fp.IP, time.Minute)
	result := risk.Evaluate(risk.Input{
		KnownBot:      fp.IsBot,
		Automation:    fp.IsHeadless,
		Datacenter:    h.st.InSet(ctx, "ipintel:datacenter", fp.IP),
		Proxy:         h.st.InSet(ctx, "ipintel:proxy", fp.IP),
		NoFingerprint: false,
		AbnormalRate:  rate > 40,
		BadJA3:        ja3 != "" && h.st.InSet(ctx, "ja3:blocklist", ja3),
	})

	// A link filters more eagerly than a page: known-bot UAs, automation tools,
	// and anything suspicious+ (risk >= 40).
	isBot := fp.IsBot || fp.IsHeadless || result.Score >= 40

	// Decide the outcome. Default: humans -> destination; bots -> the link's
	// bot handling (decoy / 404 / blank / through).
	dest := link.Destination
	mode := "allow" // allow | decoy | notfound | blank | redirect | block
	if isBot {
		switch link.BotAction {
		case "decoy", "notfound", "blank":
			mode = link.BotAction
		}
	}
	// VPN / proxy / RDP-datacenter blocking. Treated as bot traffic rather than a
	// hard 403 so the visitor sees the same decoy or 404 as any other bot and
	// isn't told what gave them away. "Send them through too" is not a sensible
	// outcome for someone who explicitly asked to block these, so fall back to a 404.
	if link.BlockVPN && h.lookupIP(ctx, fp.IP).flagged() {
		isBot = true
		switch link.BotAction {
		case "decoy", "notfound", "blank":
			mode = link.BotAction
		default:
			mode = "notfound"
		}
	}

	// If a website is attached, its Traffic Rules + IP allow/deny take precedence
	// — granular control (country/device/OS/risk/JA3). Falls back to bot handling.
	if link.TID != "" {
		action, _, redirect := rules.Evaluate(rules.Parse(h.st.GetRules(ctx, link.TID)), rules.Event{
			RiskScore: result.Score, Rate: int(rate),
			Fields: map[string]string{
				"classification": result.Classification, "country": fp.Country,
				"device": fp.Device, "browser": fp.Browser, "os": fp.OS,
				"is_bot": boolStr(fp.IsBot),
				"is_proxy": boolStr(h.st.InSet(ctx, "ipintel:datacenter", fp.IP) || h.st.InSet(ctx, "ipintel:proxy", fp.IP)),
				"ja3": ja3,
			},
		})
		switch ipfilter.Match(ipfilter.Parse(h.st.GetIPFilter(ctx, link.TID)), fp.IP) {
		case ipfilter.Allow:
			action, redirect = "allow", ""
		case ipfilter.Deny:
			action, redirect = "block", ""
		}
		switch action {
		case "block":
			mode = "block"
		case "redirect":
			if redirect != "" {
				mode, dest = "redirect", redirect
			}
		}
	}

	// Human check. Only stands between a visitor and the destination when we
	// were going to let them through anyway — a bot already has its own
	// outcome, and re-checking it here would just leak that it was detected.
	if link.Challenge && (mode == "allow" || mode == "redirect") && !challengePassed(r) {
		mode = "challenge"
	}

	sigJSON, _ := json.Marshal(result.Signals)
	go h.st.EmitTraffic(context.Background(), map[string]any{
		"site_id": link.TID, "visitor_id": "click:" + fp.IP, "session_id": "",
		"type": "click", "slug": slug, "url": link.Destination,
		"ip": fp.IP, "country": fp.Country, "device": fp.Device, "browser": fp.Browser, "os": fp.OS,
		"ua": fp.UserAgent, "is_headless": boolStr(fp.IsHeadless),
		"risk_score": result.Score, "classification": result.Classification,
		"confidence": fmt.Sprintf("%.2f", result.Confidence), "signals": string(sigJSON),
		"ja3": ja3, "action": mode, "tag": "", "redirect_url": "",
	})

	switch mode {
	case "challenge":
		writeChallengePage(w, slug, r.URL.RawQuery)
	case "block":
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("Access denied"))
	case "notfound":
		http.NotFound(w, r)
	case "blank":
		w.WriteHeader(http.StatusOK) // quietly nothing
	case "decoy":
		if link.DecoyURL != "" {
			http.Redirect(w, r, link.DecoyURL, http.StatusFound)
		} else {
			http.NotFound(w, r)
		}
	default: // "allow" (human -> destination) or "redirect"
		out := dest
		if link.ForwardQS {
			out = mergeQuery(out, r.URL.RawQuery, link.ForwardKeys)
		}
		// NB: the traffic event above logs link.Destination, never `out` — the
		// forwarded params can carry PII (survey links commonly hold an email)
		// and that has no business sitting in the click log.
		http.Redirect(w, r, out, http.StatusFound)
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

// mergeQuery folds the short link's own query string into the destination, so a
// personalised link (…/abc?rid=8842) lands on the form with its tracking intact.
// Incoming values win over defaults already on the destination. Capped, because
// the query arrives from whoever clicked the link.
// `only` is an allow-list of parameter names; empty forwards everything.
// --- IP intelligence, on demand -----------------------------------------
// The Django worker enriches IPs after the fact, which is fine for page
// traffic but useless for a redirect: most short links see one click per IP,
// so by the time the set is populated the visitor has already been sent
// through. When a link asks for VPN blocking we therefore resolve the IP on
// the spot — cache first (shared with Django), then a short live lookup.

type ipIntel struct {
	Proxy      bool `json:"proxy"`
	VPN        bool `json:"vpn"`
	Datacenter bool `json:"datacenter"`
}

func (i ipIntel) flagged() bool { return i.Proxy || i.VPN || i.Datacenter }

var intelClient = &http.Client{Timeout: 700 * time.Millisecond}

func (h *handler) lookupIP(ctx context.Context, ip string) ipIntel {
	var out ipIntel
	if ip == "" {
		return out
	}
	// The sets are still authoritative when they already know this IP.
	if h.st.InSet(ctx, "ipintel:proxy", ip) || h.st.InSet(ctx, "ipintel:datacenter", ip) {
		out.Proxy = true
		return out
	}
	key := "ipintel:cache:" + ip
	if raw := h.st.GetStr(ctx, key); raw != "" {
		json.Unmarshal([]byte(raw), &out) // "{}" = looked up, nothing found
		return out
	}
	apiKey := env("IPQUALITYSCORE_KEY", "")
	if apiKey == "" || !strings.EqualFold(env("IP_INTEL_PROVIDER", ""), "ipqualityscore") {
		return out
	}
	resp, err := intelClient.Get("https://ipqualityscore.com/api/json/ip/" +
		url.PathEscape(apiKey) + "/" + url.PathEscape(ip))
	if err != nil {
		return out // fail open: never hold a visitor up over a slow lookup
	}
	defer resp.Body.Close()
	var d struct {
		Success        bool   `json:"success"`
		Proxy          bool   `json:"proxy"`
		VPN            bool   `json:"vpn"`
		Tor            bool   `json:"tor"`
		ConnectionType string `json:"connection_type"`
	}
	if json.NewDecoder(io.LimitReader(resp.Body, 1<<16)).Decode(&d) != nil || !d.Success {
		return out
	}
	out = ipIntel{Proxy: d.Proxy, VPN: d.VPN || d.Tor, Datacenter: d.ConnectionType == "Data Center"}
	// Share the answer with Django's cache and sets, same keys and shape.
	if b, err := json.Marshal(out); err == nil {
		h.st.SetEx(ctx, key, string(b), 24*time.Hour)
	}
	if out.Datacenter {
		h.st.SAdd(ctx, "ipintel:datacenter", ip)
	}
	if out.Proxy || out.VPN {
		h.st.SAdd(ctx, "ipintel:proxy", ip)
	}
	return out
}

func mergeQuery(dest, raw string, only []string) string {
	if raw == "" || len(raw) > 2048 {
		return dest
	}
	in, err := url.ParseQuery(raw)
	if err != nil || len(in) == 0 {
		return dest
	}
	u, err := url.Parse(dest)
	if err != nil {
		return dest
	}
	var allow map[string]bool
	if len(only) > 0 {
		allow = make(map[string]bool, len(only))
		for _, k := range only {
			allow[k] = true
		}
	}
	q := u.Query()
	for k, vs := range in {
		if allow != nil && !allow[k] {
			continue // not on the list — drop it rather than pass it on
		}
		if len(vs) > 0 {
			q.Set(k, vs[0])
		}
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

// --- Human check ("click to continue") ---------------------------------
// A link with challenge=true shows an interstitial to visitors we would
// otherwise send straight through. Bots already get bot_action, so this is
// aimed at the automation the scorer missed: anything that can't run JS or
// won't click never reaches the destination.
//
// Passing sets a short-lived signed cookie, so a real visitor is asked once
// rather than on every click. The signature is keyed on the app secret, so
// the cookie can't be forged or lifted from one visitor's browser and reused
// past its expiry.

const challengeCookie = "tnb_hc"
const challengeTTL = 30 * time.Minute

// How long the visitor must hold the button. Enforced on BOTH sides: the page
// animates it, and the server refuses a pass that comes back faster than this.
// Client-only timing would be trivial to skip by calling the endpoint directly.
const holdSeconds = 5
const holdSlack = 1 * time.Second // clock skew / rounding
const challengePageTTL = 10 * time.Minute

func challengeSecret() string {
	return env("DJANGO_SECRET_KEY", "insecure-dev-secret")
}

func sign(label string, v int64) string {
	m := hmac.New(sha256.New, []byte(challengeSecret()))
	fmt.Fprintf(m, "%s|%d", label, v)
	return hex.EncodeToString(m.Sum(nil))
}

func signChallenge(exp int64) string {
	return fmt.Sprintf("%d.%s", exp, sign("hc", exp))
}

func challengePassed(r *http.Request) bool {
	c, err := r.Cookie(challengeCookie)
	if err != nil || c.Value == "" {
		return false
	}
	parts := strings.SplitN(c.Value, ".", 2)
	if len(parts) != 2 {
		return false
	}
	var exp int64
	if _, err := fmt.Sscanf(parts[0], "%d", &exp); err != nil {
		return false
	}
	if time.Now().Unix() > exp {
		return false
	}
	// constant-time compare so the signature can't be probed byte by byte
	return hmac.Equal([]byte(signChallenge(exp)), []byte(c.Value))
}

// GET /v1/challenge?to=<slug>&iat=<issued>&sig=<hmac>
// Passes only when the issued-at token is ours, unexpired, and at least
// holdSeconds old — so the button really was held, not just posted.
func (h *handler) challenge(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	slug := strings.Trim(q.Get("to"), "/")
	// Only ever bounce back to one of our own slugs, never an arbitrary URL —
	// otherwise this endpoint is an open redirect.
	if slug == "" || strings.ContainsAny(slug, "/:?#\\") {
		http.NotFound(w, r)
		return
	}

	var iat int64
	fmt.Sscanf(q.Get("iat"), "%d", &iat)
	age := time.Since(time.Unix(iat, 0))
	ok := iat > 0 &&
		hmac.Equal([]byte(sign("hc-iss", iat)), []byte(q.Get("sig"))) &&
		age >= holdSeconds*time.Second-holdSlack &&
		age <= challengePageTTL
	carry := q.Get("q")
	if len(carry) > 2048 {
		carry = ""
	}
	if !ok {
		// Too fast, forged, or a stale page: start over rather than pass.
		writeChallengePage(w, slug, carry)
		return
	}

	exp := time.Now().Add(challengeTTL).Unix()
	http.SetCookie(w, &http.Cookie{
		Name: challengeCookie, Value: signChallenge(exp), Path: "/",
		Expires: time.Unix(exp, 0), HttpOnly: true, Secure: true,
		SameSite: http.SameSiteLaxMode,
	})
	// Back to the link itself, query intact — slug is validated above, so this
	// stays on our own host and can't be steered elsewhere.
	back := "/" + slug
	if carry != "" {
		back += "?" + carry
	}
	http.Redirect(w, r, back, http.StatusFound)
}

func writeChallengePage(w http.ResponseWriter, slug, rawQuery string) {
	iat := time.Now().Unix()
	if len(rawQuery) > 2048 {
		rawQuery = ""
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, challengeHTML,
		template.HTMLEscapeString(slug), iat, sign("hc-iss", iat), holdSeconds*1000, rawQuery)
}

const challengeHTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Just a moment…</title>
<style>
 :root{color-scheme:light}*{box-sizing:border-box}
 body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:#f6f8fc;color:#0f1626}
 .card{max-width:26rem;width:100%%;text-align:center;background:#fff;border:1px solid #e6e9f0;
  border-radius:1rem;padding:2.25rem 1.75rem;box-shadow:0 24px 60px -30px rgba(15,22,38,.35)}
 h1{font-size:1.15rem;margin:0 0 .4rem}
 p{color:#566072;font-size:.9rem;line-height:1.6;margin:0 auto;max-width:20rem}
 #hold{position:relative;overflow:hidden;margin-top:1.5rem;width:100%%;border:0;border-radius:999px;
  background:#e6e9f0;color:#0f1626;font:600 .95rem system-ui;padding:.85rem 1rem;cursor:pointer;
  touch-action:none;-webkit-user-select:none;user-select:none}
 #fill{position:absolute;inset:0 auto 0 0;width:0%%;background:#2563eb;transition:width .08s linear}
 #label{position:relative;z-index:1;mix-blend-mode:normal}
 #hold.armed #label{color:#fff}
 #pct{display:block;margin-top:.75rem;font-size:.8rem;color:#8b93a3;font-variant-numeric:tabular-nums}
 .tag{display:block;margin-top:1.25rem;font-size:.68rem;letter-spacing:.08em;
  text-transform:uppercase;color:#8b93a3}
 noscript p{color:#dc2626}
</style></head><body>
 <main class="card">
  <h1>Confirm you're human</h1>
  <p>Press and hold the button until it fills.</p>
  <button id="hold" type="button" aria-describedby="pct">
    <span id="fill"></span><span id="label">Press and hold</span>
  </button>
  <span id="pct" role="status" aria-live="polite">0%%</span>
  <noscript><p>JavaScript is required to continue.</p></noscript>
  <span class="tag">Protected by TryNoBot</span>
 </main>
 <script>
  // The destination is wired up in JS and only after a real, timed hold, so a
  // scraper reading the HTML has nothing to follow. The server independently
  // rejects anything that comes back faster than the hold — see challenge().
  var slug = %q, iat = %d, sig = %q, need = %d, qs = %q;
  var btn = document.getElementById("hold"), fill = document.getElementById("fill"),
      label = document.getElementById("label"), pct = document.getElementById("pct");
  var raf = 0, started = 0, done = false;

  function paint(p) {
    fill.style.width = p + "%%";
    pct.textContent = Math.floor(p) + "%%";
  }
  function tick() {
    var p = Math.min(100, (Date.now() - started) / need * 100);
    paint(p);
    if (p >= 100) { finish(); return; }
    raf = requestAnimationFrame(tick);
  }
  function finish() {
    done = true;
    cancelAnimationFrame(raf);
    label.textContent = "Verified — taking you there…";
    btn.disabled = true;
    // location.hash is kept on the end: a fragment never reaches the server, so
    // the only way it survives the hold is for the browser to carry it. It then
    // rides the redirect chain to the destination on its own.
    location.href = "/v1/challenge?to=" + encodeURIComponent(slug) +
                    "&iat=" + iat + "&sig=" + encodeURIComponent(sig) +
                    (qs ? "&q=" + encodeURIComponent(qs) : "") + location.hash;
  }
  function start(e) {
    if (done) return;
    e.preventDefault();
    started = Date.now();
    btn.classList.add("armed");
    label.textContent = "Keep holding…";
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    if (done || !started) return;
    cancelAnimationFrame(raf);
    started = 0;
    btn.classList.remove("armed");
    paint(0);
    label.textContent = "Hold it a bit longer";
  }
  btn.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach(function (ev) {
    btn.addEventListener(ev, stop);
  });
  // Keyboard: hold Space or Enter. Browsers repeat keydown, so ignore repeats.
  btn.addEventListener("keydown", function (e) {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e);
  });
  btn.addEventListener("keyup", function (e) {
    if (e.key === " " || e.key === "Enter") stop();
  });
 </script>
</body></html>`

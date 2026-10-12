package main

// Public "score me" preview — the live demo on the marketing site.
//
// It runs the real scoring pipeline against whoever is asking and hands back
// the full breakdown. That is the whole pitch: the product's input is the
// visitor, so every person who lands on the site is already a complete demo
// with nothing to install and nothing to type.
//
// IT MUST NOT WRITE ANYTHING ABOUT THE VISITOR. The scoring paths used by real
// customers (collect/decide/guard/shortlink) deliberately have side effects —
// they emit traffic events, remember bad IPs, and file fingerprints in the
// shared cross-customer corpus. Reusing one of those here would mean a visitor
// to our own homepage who happened to score badly could be blocked on a
// CUSTOMER's site. So this path is read-only by construction: it reads the
// intel cache and the blocklists, and the only thing it writes is its own
// abuse counter, under a key namespace of its own (see previewRateKey).
//
// See TestPreviewWritesNothingAboutTheVisitor, which enforces that.

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"time"

	"borderless/decision/internal/crawler"
	"borderless/decision/internal/fingerprint"
	"borderless/decision/internal/geo"
	"borderless/decision/internal/risk"
)

// previewRateKey namespaces the preview's own abuse counter. It deliberately
// does NOT reuse "iprate:", which feeds the abnormal_request_rate signal on
// real customer traffic — counting marketing-site visits there would make a
// visitor look abnormal on sites they have never been to.
func previewRateKey(ip string) string { return "prate:" + ip }

// previewRateLimit is per IP per minute. The endpoint is unauthenticated and
// can trigger a paid IP-intelligence lookup for an IP we have not seen, so it
// needs a ceiling. Generous enough that a curious visitor reloading the page
// never hits it.
func previewRateLimit() int64 {
	if v, err := strconv.ParseInt(env("PREVIEW_RATE_LIMIT", "12"), 10, 64); err == nil && v > 0 {
		return v
	}
	return 12
}

type previewRequest struct {
	FP *FP `json:"fp"`
	BH *BH `json:"bh"`
}

type previewSignal struct {
	Code  string `json:"code"`
	Label string `json:"label"`
	Good  bool   `json:"good"` // true = this one LOWERS risk
}

type previewVisitor struct {
	IP             string `json:"ip"`
	Country        string `json:"country"`
	Device         string `json:"device"`
	Browser        string `json:"browser"`
	BrowserVersion string `json:"browser_version"`
	OS             string `json:"os"`
	OSVersion      string `json:"os_version"`
	Language       string `json:"language"`
	Connection     string `json:"connection"`
	ISP            string `json:"isp"`
	ASN            string `json:"asn"`
	IsVPN          bool   `json:"is_vpn"`
	IsProxy        bool   `json:"is_proxy"`
	IsDatacenter   bool   `json:"is_datacenter"`
	IsCrawler      bool   `json:"is_crawler"`
	CrawlerKind    string `json:"crawler_kind"`
	HasJA3         bool   `json:"has_ja3"`
}

type previewResponse struct {
	Score          int             `json:"score"`
	Classification string          `json:"classification"`
	Confidence     float64         `json:"confidence"`
	Signals        []previewSignal `json:"signals"`
	Visitor        previewVisitor  `json:"visitor"`
	TookMS         int64           `json:"took_ms"`
}

// signalLabels turns the engine's internal signal codes into something a
// visitor can read. Kept beside the scoring rather than in the frontend so the
// two can't drift: an unmapped code falls back to the raw name, which is ugly
// enough to notice in review but never breaks the panel.
var signalLabels = map[string]string{
	"known_bot":                     "Known bot user-agent",
	"webdriver_detected":            "Browser automation flag (navigator.webdriver)",
	"headless_fingerprint":          "Fingerprint looks like a headless browser",
	"automation_signal":             "Automation framework detected",
	"datacenter_ip":                 "Datacenter IP — where bots usually run",
	"proxy_detected":                "VPN or proxy",
	"no_js_fingerprint":             "No browser fingerprint (not a real browser)",
	"abnormal_request_rate":         "Unusually fast request rate",
	"known_bad_ja3":                 "Known-bad TLS fingerprint (JA3)",
	"known_bad_ja4":                 "Known-bad TLS fingerprint (JA4)",
	"ip_reported_bot":               "IP reported as a bot by our intelligence provider",
	"recent_abuse_ip":               "Recent abuse reported from this IP",
	"high_fraud_ip":                 "IP has a very high fraud score",
	"elevated_fraud_ip":             "IP has an elevated fraud score",
	"repeat_offender":               "This IP was caught as a bot recently",
	"known_bad_fingerprint_network": "Fingerprint seen across many confirmed-bad IPs",
	"synthetic_events":              "Script-generated clicks (isTrusted = false)",
	"human_interaction":             "Genuine human interaction observed",
	"verified_crawler":              "Verified search crawler — always allowed through",
	"ad_reviewer":                   "Verified ad-network reviewer — always sees the real page",
}

// goodSignals lower the score or vouch for the visitor. The panel styles these
// differently so a clean result still has something positive to show, instead
// of an empty list that reads as "we found nothing".
var goodSignals = map[string]bool{
	"human_interaction": true,
	"verified_crawler":  true,
	"ad_reviewer":       true,
}

func labelSignals(codes []string) []previewSignal {
	out := make([]previewSignal, 0, len(codes))
	for _, c := range codes {
		label, ok := signalLabels[c]
		if !ok {
			label = c
		}
		out = append(out, previewSignal{Code: c, Label: label, Good: goodSignals[c]})
	}
	return out
}

// POST /v1/preview — score the caller and explain the result. Public, no
// site_id, no API key: there is nothing to authorize because nothing is stored
// and the only data returned is the caller's own.
func (h *handler) preview(w http.ResponseWriter, r *http.Request) {
	started := time.Now()
	cors(w)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 900*time.Millisecond)
	defer cancel()

	// GET is allowed so the endpoint can be tried with curl; the client
	// fingerprint simply isn't available on that path.
	var p previewRequest
	if r.Method == http.MethodPost {
		body, _ := io.ReadAll(io.LimitReader(r.Body, 16*1024))
		_ = json.Unmarshal(body, &p) // a malformed body just means no fingerprint
	}

	ip := firstHeader(r, "CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP")
	ja3 := firstHeader(r, "X-TA-JA3", "CF-JA3-Hash", "X-JA3-Hash")
	ja4 := firstHeader(r, "X-TA-JA4", "CF-JA4")
	fp := fingerprint.FromValues(ip, r.UserAgent(), "")
	if fp.Country == "" {
		fp.Country = geo.Country(fp.IP)
	}

	if n := h.st.RateIncr(ctx, previewRateKey(fp.IP), time.Minute); n > previewRateLimit() {
		writeJSON(w, http.StatusTooManyRequests, map[string]any{
			"error": "Too many checks from this address — give it a minute."})
		return
	}

	// Client-side fingerprint signals, same derivation as the collect path.
	// NoFingerprint must reflect whether one was actually supplied: scoring a
	// visitor as "no fingerprint" when the panel simply didn't send one would
	// add 15 points to every single person and make the demo lie.
	webdriver, headlessFP, noFP := false, false, p.FP == nil
	var fpHash string
	if p.FP != nil {
		fpHash = p.FP.Hash
		webdriver = p.FP.Webdriver
		if len(p.FP.Flags) >= 2 {
			headlessFP = true
		}
	}
	syntheticEvents, humanInteraction := false, false
	if p.BH != nil {
		syntheticEvents = p.BH.Synthetic
		humanInteraction = p.BH.Human
	}

	intel := h.knownIntel(ctx, fp.IP)
	h.warmIntel(fp.IP, intel.ISP != "") // populates the shared cache for next time

	result := risk.Evaluate(risk.Input{
		KnownBot:            fp.IsBot,
		Webdriver:           webdriver,
		HeadlessFP:          headlessFP,
		Automation:          fp.IsHeadless,
		Datacenter:          intel.Datacenter,
		Proxy:               intel.Proxy || intel.VPN,
		NoFingerprint:       noFP,
		AbnormalRate:        false, // see previewRateKey: never the shared counter
		BadJA3:              ja3 != "" && h.st.InSet(ctx, "ja3:blocklist", ja3),
		BadJA4:              ja4 != "" && h.st.InSet(ctx, "ja4:blocklist", ja4),
		IPBot:               intel.BotStatus,
		RecentAbuse:         intel.RecentAbuse,
		IPFraudScore:        intel.FraudScore,
		RepeatOffender:      h.isRepeatOffender(ctx, fp.IP),
		SyntheticEvents:     syntheticEvents,
		HumanInteraction:    humanInteraction,
		KnownBadFingerprint: h.corpusKnownBad(ctx, ja3, ja4, fpHash),
	})

	// Show the anti-cloaking rule working: a verified crawler checking us sees
	// itself correctly identified and told it would be let straight through.
	crawlerKind := ""
	isCrawler := false
	if h.allowCrawlers {
		if token, platform, ok := crawler.VerifiedKind(ctx, fp.IP, fp.UserAgent); ok {
			isCrawler = true
			crawlerKind = token
			result.Signals = append(result.Signals, "verified_crawler")
			if platform != "" {
				crawlerKind = platform
				result.Signals = append(result.Signals, "ad_reviewer")
			}
		}
	}

	writeJSON(w, http.StatusOK, previewResponse{
		Score:          result.Score,
		Classification: result.Classification,
		Confidence:     result.Confidence,
		Signals:        labelSignals(result.Signals),
		Visitor: previewVisitor{
			IP: fp.IP, Country: fp.Country, Device: fp.Device,
			Browser: fp.Browser, BrowserVersion: fp.BrowserVersion,
			OS: fp.OS, OSVersion: fp.OSVersion, Language: fp.Language,
			Connection: intel.ConnType, ISP: intel.ISP, ASN: intel.ASN,
			IsVPN: intel.VPN, IsProxy: intel.Proxy, IsDatacenter: intel.Datacenter,
			IsCrawler: isCrawler, CrawlerKind: crawlerKind,
			HasJA3: ja3 != "" || ja4 != "",
		},
		TookMS: time.Since(started).Milliseconds(),
	})
}

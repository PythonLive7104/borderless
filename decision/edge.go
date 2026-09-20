package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"borderless/decision/internal/crawler"
	"borderless/decision/internal/fingerprint"
	"borderless/decision/internal/geo"
	"borderless/decision/internal/risk"
)

// EdgeClickPayload is what the Cloudflare Worker reports after serving an
// edge-simple redirect at the edge. The visitor already got their 302; this is
// the async accounting so short-link counters, IP/fingerprint memory and the
// shared corpus stay centralized and keep working exactly as for an
// origin-served click. Visitor attributes are passed explicitly because the
// Worker, not the visitor, is talking to us here.
type EdgeClickPayload struct {
	Slug     string `json:"slug"`
	TID      string `json:"tid"`
	Org      string `json:"org"`
	IP       string `json:"ip"`
	UA       string `json:"ua"`
	Referrer string `json:"referrer"`
	Country  string `json:"country"`
	JA3      string `json:"ja3"`
	JA4      string `json:"ja4"`
	Dest     string `json:"dest"`
}

// edgeClick scores an edge-served click and records it, without serving
// anything (the Worker already redirected). It deliberately does NO link
// filtering: the Worker only serves links at the edge that filter nobody, so
// there is no routing decision left to make here — only accounting and the
// threat-memory updates that protect future clicks.
func (h *handler) edgeClick(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	// Shared secret so only our Worker can post edge events; without it anyone
	// could forge clicks or poison the corpus. Skipped only when unset (dev).
	if want := env("EDGE_CLICK_SECRET", ""); want != "" && r.Header.Get("X-Edge-Secret") != want {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 16*1024))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	var p EdgeClickPayload
	if err := json.Unmarshal(body, &p); err != nil || p.Slug == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()

	fp := fingerprint.FromValues(p.IP, p.UA, p.Country)
	if fp.Country == "" {
		fp.Country = geo.Country(fp.IP)
	}
	rate := h.st.RateIncr(ctx, "iprate:"+fp.IP, time.Minute)
	intel := h.knownIntel(ctx, fp.IP)
	h.warmIntel(fp.IP, intel.ISP != "")
	repeat := h.isRepeatOffender(ctx, fp.IP)
	badFP := h.corpusKnownBad(ctx, p.JA3, p.JA4, "")
	result := risk.Evaluate(risk.Input{
		KnownBot:            fp.IsBot,
		Automation:          fp.IsHeadless,
		Datacenter:          intel.Datacenter,
		Proxy:               intel.Proxy || intel.VPN,
		AbnormalRate:        ipRateLimit() > 0 && rate > ipRateLimit(),
		BadJA3:              p.JA3 != "" && h.st.InSet(ctx, "ja3:blocklist", p.JA3),
		BadJA4:              p.JA4 != "" && h.st.InSet(ctx, "ja4:blocklist", p.JA4),
		IPBot:               intel.BotStatus,
		RecentAbuse:         intel.RecentAbuse,
		IPFraudScore:        intel.FraudScore,
		RepeatOffender:      repeat,
		KnownBadFingerprint: badFP,
	})

	// Verified crawler / ad reviewer: labeled, and excluded from the bad corpus
	// so we never poison it with Google's own IPs — same rule as every path.
	reviewerPlatform, verifiedCrawler := "", false
	if h.allowCrawlers {
		if _, platform, ok := crawler.VerifiedKind(ctx, fp.IP, fp.UserAgent); ok {
			verifiedCrawler = true
			result.Signals = append(result.Signals, "verified_crawler")
			if platform != "" {
				reviewerPlatform = platform
				result.Signals = append(result.Signals, "ad_reviewer")
			}
		}
	}
	if !verifiedCrawler && (result.Classification == "bot" || result.Classification == "fraud") {
		h.rememberBot(fp.IP)
		h.rememberBadFingerprint(fp.IP, p.JA3, p.JA4, "")
	}
	result.Signals = append(result.Signals, "edge_served")
	sigJSON, _ := json.Marshal(result.Signals)

	go h.st.EmitTraffic(context.Background(), map[string]any{
		"site_id": p.TID, "org": p.Org, "visitor_id": "click:" + fp.IP, "session_id": "",
		"type": "click", "slug": p.Slug, "url": p.Dest,
		"ip": fp.IP, "country": fp.Country, "device": fp.Device, "browser": fp.Browser, "os": fp.OS,
		"ua": fp.UserAgent, "is_headless": boolStr(fp.IsHeadless),
		"risk_score": result.Score, "classification": result.Classification,
		"confidence": fmt.Sprintf("%.2f", result.Confidence), "signals": string(sigJSON),
		"ja3": p.JA3, "ja4": p.JA4, "action": "allow", "tag": "", "redirect_url": "",
		"reviewer": boolStr(reviewerPlatform != ""), "reviewer_platform": reviewerPlatform,
	})
	w.WriteHeader(http.StatusNoContent)
}

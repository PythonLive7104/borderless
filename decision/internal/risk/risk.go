package risk

import "math"

// Result is the outcome of scoring one event.
type Result struct {
	Score          int      `json:"risk_score"`
	Classification string   `json:"classification"` // human | suspicious | bot | fraud
	Confidence     float64  `json:"confidence"`     // 0..1
	Signals        []string `json:"signals"`
}

// Deterministic weighted-signal model (PRD §31). Weights are intentionally
// simple and configurable; the score is normalized to 0..100.
const (
	wKnownBot        = 50
	wWebdriver       = 45
	wHeadlessFP      = 30
	wAutomation      = 25
	wDatacenter      = 25
	wProxy           = 15
	wNoFingerprint   = 15
	wAbnormalRate    = 20
	wKnownBadJA3     = 35
	wKnownBadJA4     = 35
	wIPBot           = 35 // IP-intel provider says this IP is a bot
	wRecentAbuse     = 25 // IP recently seen in abuse/fraud
	wHighFraudIP     = 40 // provider fraud score very high (>=85): actionable alone
	wElevatedFraudIP = 20 // provider fraud score elevated (>=75): a nudge
	wRepeatOffender  = 30 // this IP was caught as a bot recently (any link/site)

	// Behavioural signals (Phase 1). These come from the JS tracker watching how
	// the visitor actually interacts, not from the network or fingerprint.
	//
	// The pageview event fires BEFORE any interaction can exist, so absence of
	// interaction is NOT incriminating on its own — a real first-time visitor
	// looks identical to a bot at that instant. So behaviour is used two ways:
	//   * synthetic events (isTrusted=false: JS-dispatched, never user-driven)
	//     are a genuine automation tell and ADD risk;
	//   * observed human interaction (varied movement, real scroll, keystrokes)
	//     is corroborating evidence a person is present and SUBTRACTS risk — but
	//     capped, so it can never fully whitewash an IP the provider knows is bad.
	wSyntheticEvents  = 35  // events with isTrusted=false — script-dispatched
	wHumanInteraction = -25 // real human interaction observed (exoneration)
)

type Input struct {
	KnownBot       bool
	Webdriver      bool // navigator.webdriver === true
	HeadlessFP     bool // fingerprint looks like a headless browser
	Automation     bool // headless / framework-driven (UA-based)
	Datacenter     bool
	Proxy          bool
	NoFingerprint  bool // no JS fingerprint received (non-browser client)
	AbnormalRate   bool
	BadJA3         bool // TLS JA3 hash matches a known bad-client fingerprint
	BadJA4         bool // TLS JA4 hash matches a known bad-client fingerprint
	IPBot          bool // IP-intelligence provider flags the IP as a bot
	RecentAbuse    bool // IP-intelligence provider: recent abuse/fraud from this IP
	IPFraudScore   int  // IP-intelligence fraud score, 0..100 (0 = unknown)
	RepeatOffender bool // caught as a bot recently, anywhere in the platform

	SyntheticEvents  bool // tracker saw a JS-dispatched (isTrusted=false) event
	HumanInteraction bool // tracker saw genuine human interaction this session
}

func Evaluate(in Input) Result {
	score := 0
	sig := []string{}
	add := func(pts int, name string) { score += pts; sig = append(sig, name) }

	if in.KnownBot {
		add(wKnownBot, "known_bot")
	}
	if in.Webdriver {
		add(wWebdriver, "webdriver_detected")
	}
	if in.HeadlessFP {
		add(wHeadlessFP, "headless_fingerprint")
	}
	if in.Automation {
		add(wAutomation, "automation_signal")
	}
	if in.Datacenter {
		add(wDatacenter, "datacenter_ip")
	}
	if in.Proxy {
		add(wProxy, "proxy_detected")
	}
	if in.NoFingerprint {
		add(wNoFingerprint, "no_js_fingerprint")
	}
	if in.AbnormalRate {
		add(wAbnormalRate, "abnormal_request_rate")
	}
	if in.BadJA3 {
		add(wKnownBadJA3, "known_bad_ja3")
	}
	if in.BadJA4 {
		add(wKnownBadJA4, "known_bad_ja4")
	}
	if in.IPBot {
		add(wIPBot, "ip_reported_bot")
	}
	if in.RecentAbuse {
		add(wRecentAbuse, "recent_abuse_ip")
	}
	// Provider fraud score: two bands so a merely-elevated IP nudges the score
	// while a very high one contributes strongly. This is what catches a clean
	// user-agent on a clean-looking residential IP that the provider already
	// knows is bad — the case pure UA/network checks miss.
	switch {
	case in.IPFraudScore >= 85:
		add(wHighFraudIP, "high_fraud_ip")
	case in.IPFraudScore >= 75:
		add(wElevatedFraudIP, "elevated_fraud_ip")
	}
	if in.RepeatOffender {
		add(wRepeatOffender, "repeat_offender")
	}
	if in.SyntheticEvents {
		add(wSyntheticEvents, "synthetic_events")
	}
	// Exoneration is applied only when there is something to subtract from, so a
	// clean human visit still scores 0 rather than going negative, and the
	// signal is only recorded when it actually moved the score.
	if in.HumanInteraction && score > 0 {
		add(wHumanInteraction, "human_interaction")
	}
	if score > 100 {
		score = 100
	}
	if score < 0 {
		score = 0
	}

	return Result{
		Score:          score,
		Classification: classify(score),
		Confidence:     confidence(score),
		Signals:        sig,
	}
}

// PRD risk ranges → classification labels.
func classify(s int) string {
	switch {
	case s >= 85:
		return "fraud"
	case s >= 70:
		return "bot"
	case s >= 40:
		return "suspicious"
	default:
		return "human"
	}
}

// Confidence is highest at the extremes, lowest near the decision boundary.
func confidence(s int) float64 {
	c := 0.5 + math.Abs(float64(s)-50)/100.0
	if c > 1 {
		c = 1
	}
	return math.Round(c*100) / 100
}

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
)

type Input struct {
	KnownBot      bool
	Webdriver     bool // navigator.webdriver === true
	HeadlessFP    bool // fingerprint looks like a headless browser
	Automation    bool // headless / framework-driven (UA-based)
	Datacenter    bool
	Proxy         bool
	NoFingerprint bool // no JS fingerprint received (non-browser client)
	AbnormalRate  bool
	BadJA3        bool // TLS JA3 hash matches a known bad-client fingerprint
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
	if score > 100 {
		score = 100
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

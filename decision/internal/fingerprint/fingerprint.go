package fingerprint

import (
	"net"
	"net/http"
	"regexp"
	"strings"
)

// Fingerprint holds server-side signals extracted from the request.
type Fingerprint struct {
	IP             string
	Country        string
	UserAgent      string
	Device         string // mobile | desktop | tablet
	Browser        string
	BrowserVersion string // major version, e.g. "120"
	OS             string
	OSVersion      string // best-effort, e.g. "10" / "13" / "16"
	Language       string // first Accept-Language tag, e.g. "en-us"
	IsHeadless     bool
	IsBot          bool
}

var headlessMarkers = []string{
	"headlesschrome", "phantomjs", "puppeteer", "playwright", "selenium",
	"slimerjs", "python-requests", "curl", "wget", "go-http-client", "axios",
}

var botMarkers = []string{
	"bot", "crawler", "spider", "googlebot", "bingbot", "yandexbot",
	"ahrefsbot", "semrushbot", "facebookexternalhit", "slurp", "duckduckbot",
}

// FromValues builds a Fingerprint from explicit values. Used by the server-side
// shield (/v1/decide), where the visitor's IP/UA are supplied by the customer's
// server rather than read from our own socket.
func FromValues(ip, ua, country string) Fingerprint {
	lua := strings.ToLower(ua)
	fp := Fingerprint{
		IP:             ip,
		Country:        strings.ToUpper(country),
		UserAgent:      ua,
		Device:         deviceClass(lua),
		Browser:        browser(lua),
		BrowserVersion: browserVersion(lua),
		OS:             os(lua),
		OSVersion:      osVersion(lua),
	}
	for _, m := range headlessMarkers {
		if strings.Contains(lua, m) {
			fp.IsHeadless = true
			break
		}
	}
	for _, m := range botMarkers {
		if strings.Contains(lua, m) {
			fp.IsBot = true
			break
		}
	}
	if ua == "" {
		fp.IsHeadless = true
	}
	return fp
}

func Extract(r *http.Request) Fingerprint {
	ua := r.UserAgent()
	lua := strings.ToLower(ua)
	fp := Fingerprint{
		IP:             clientIP(r),
		Country:        strings.ToUpper(headerAny(r, "CF-IPCountry", "X-Country")),
		UserAgent:      ua,
		Device:         deviceClass(lua),
		Browser:        browser(lua),
		BrowserVersion: browserVersion(lua),
		OS:             os(lua),
		OSVersion:      osVersion(lua),
		Language:       acceptLanguage(r.Header.Get("Accept-Language")),
	}
	for _, m := range headlessMarkers {
		if strings.Contains(lua, m) {
			fp.IsHeadless = true
			break
		}
	}
	for _, m := range botMarkers {
		if strings.Contains(lua, m) {
			fp.IsBot = true
			break
		}
	}
	if ua == "" {
		fp.IsHeadless = true
	}
	return fp
}

// browserVersion returns the major version for the detected browser, e.g. "120".
// Order matters: Edge/Opera UAs also contain "chrome", so check them first.
func browserVersion(lua string) string {
	for _, tok := range []string{"edg/", "opr/", "firefox/", "fxios/", "crios/", "chrome/", "version/"} {
		if v := verAfter(lua, tok); v != "" {
			return v
		}
	}
	return ""
}

// osVersion is best-effort: OS UA formats vary, so this captures the common
// shapes and returns the major version as a string ("10", "13", "16").
func osVersion(lua string) string {
	for _, tok := range []string{"android ", "windows nt ", "cpu iphone os ", "cpu os ", "mac os x "} {
		if i := strings.Index(lua, tok); i >= 0 {
			// iOS/macOS use underscores (16_5); normalise to a dot first.
			rest := strings.ReplaceAll(lua[i+len(tok):], "_", ".")
			return verLead(rest)
		}
	}
	return ""
}

var verNum = regexp.MustCompile(`^[0-9]+`)

// verAfter returns the leading major-version digits following a token.
func verAfter(lua, tok string) string {
	i := strings.Index(lua, tok)
	if i < 0 {
		return ""
	}
	return verLead(lua[i+len(tok):])
}

// verLead reads the leading integer of a version string ("120.0.6099" -> "120").
func verLead(s string) string {
	return verNum.FindString(strings.TrimSpace(s))
}

// acceptLanguage returns the first language tag, lowercased ("en-US,en;q=0.9"
// -> "en-us"). Empty when the header is absent.
func acceptLanguage(header string) string {
	if header == "" {
		return ""
	}
	first := strings.TrimSpace(strings.Split(header, ",")[0])
	first = strings.TrimSpace(strings.Split(first, ";")[0]) // drop any q-value
	return strings.ToLower(first)
}

func deviceClass(lua string) string {
	switch {
	case strings.Contains(lua, "ipad") || strings.Contains(lua, "tablet"):
		return "tablet"
	case strings.Contains(lua, "mobi") || strings.Contains(lua, "android") || strings.Contains(lua, "iphone"):
		return "mobile"
	default:
		return "desktop"
	}
}

func browser(lua string) string {
	switch {
	case strings.Contains(lua, "edg"):
		return "Edge"
	case strings.Contains(lua, "opr") || strings.Contains(lua, "opera"):
		return "Opera"
	case strings.Contains(lua, "chrome") || strings.Contains(lua, "crios"):
		return "Chrome"
	case strings.Contains(lua, "firefox") || strings.Contains(lua, "fxios"):
		return "Firefox"
	case strings.Contains(lua, "safari"):
		return "Safari"
	default:
		return "Other"
	}
}

func os(lua string) string {
	switch {
	case strings.Contains(lua, "windows"):
		return "Windows"
	case strings.Contains(lua, "android"):
		return "Android"
	case strings.Contains(lua, "iphone") || strings.Contains(lua, "ipad") || strings.Contains(lua, "ios"):
		return "iOS"
	case strings.Contains(lua, "mac os") || strings.Contains(lua, "macintosh"):
		return "macOS"
	case strings.Contains(lua, "linux"):
		return "Linux"
	default:
		return "Other"
	}
}

func headerAny(r *http.Request, keys ...string) string {
	for _, k := range keys {
		if v := r.Header.Get(k); v != "" {
			return v
		}
	}
	return ""
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

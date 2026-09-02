package fingerprint

import (
	"net"
	"net/http"
	"strings"
)

// Fingerprint holds server-side signals extracted from the request.
type Fingerprint struct {
	IP         string
	Country    string
	UserAgent  string
	Device     string // mobile | desktop | tablet
	Browser    string
	OS         string
	IsHeadless bool
	IsBot      bool
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
		IP:        ip,
		Country:   strings.ToUpper(country),
		UserAgent: ua,
		Device:    deviceClass(lua),
		Browser:   browser(lua),
		OS:        os(lua),
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
		IP:        clientIP(r),
		Country:   strings.ToUpper(headerAny(r, "CF-IPCountry", "X-Country")),
		UserAgent: ua,
		Device:    deviceClass(lua),
		Browser:   browser(lua),
		OS:        os(lua),
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

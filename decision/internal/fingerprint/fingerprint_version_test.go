package fingerprint

import (
	"net/http"
	"testing"
)

func TestBrowserVersion(t *testing.T) {
	cases := map[string]string{
		"mozilla/5.0 (windows nt 10.0) applewebkit chrome/120.0.6099.130 safari/537.36": "120",
		"mozilla/5.0 (windows) applewebkit edg/119.0.2151.58":                            "119",
		"mozilla/5.0 (macintosh) firefox/121.0":                                          "121",
		"mozilla/5.0 (iphone) version/16.5 mobile/15e148 safari/604.1":                   "16",
	}
	for ua, want := range cases {
		if got := browserVersion(ua); got != want {
			t.Errorf("browserVersion(%q) = %q, want %q", ua, got, want)
		}
	}
}

func TestOSVersion(t *testing.T) {
	cases := map[string]string{
		"mozilla/5.0 (windows nt 10.0; win64; x64)":              "10",
		"mozilla/5.0 (linux; android 13; pixel 7)":               "13",
		"mozilla/5.0 (iphone; cpu iphone os 16_5 like mac os x)": "16",
		"mozilla/5.0 (macintosh; intel mac os x 10_15_7)":        "10",
	}
	for ua, want := range cases {
		if got := osVersion(ua); got != want {
			t.Errorf("osVersion(%q) = %q, want %q", ua, got, want)
		}
	}
}

func TestAcceptLanguage(t *testing.T) {
	cases := map[string]string{
		"en-US,en;q=0.9": "en-us",
		"fr-FR,fr;q=0.8": "fr-fr",
		"pt-BR":          "pt-br",
		"":               "",
	}
	for h, want := range cases {
		if got := acceptLanguage(h); got != want {
			t.Errorf("acceptLanguage(%q) = %q, want %q", h, got, want)
		}
	}
}

func TestExtractPopulatesNewFields(t *testing.T) {
	r, _ := http.NewRequest("GET", "/", nil)
	r.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
	r.Header.Set("Accept-Language", "en-GB,en;q=0.7")
	fp := Extract(r)
	if fp.BrowserVersion != "120" || fp.OSVersion != "10" || fp.Language != "en-gb" {
		t.Fatalf("got version=%q os=%q lang=%q", fp.BrowserVersion, fp.OSVersion, fp.Language)
	}
}

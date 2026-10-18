package geo

import "testing"

func TestCountryForTZ(t *testing.T) {
	for tz, want := range map[string]string{
		"Europe/London": "GB", "Africa/Lagos": "NG", "America/New_York": "US",
		"Asia/Kolkata": "IN", "Europe/Zurich": "CH", "Australia/Sydney": "AU",
	} {
		if got := CountryForTZ(tz); got != want {
			t.Fatalf("CountryForTZ(%q) = %q, want %q", tz, got, want)
		}
	}
}

// UTC is where a great many machines sit without anyone choosing it — servers,
// fresh installs, developer laptops. Treating it as a location would flag a
// large population of ordinary visitors.
func TestUTCIsTreatedAsUnknown(t *testing.T) {
	for _, tz := range []string{"UTC", "GMT", "Etc/UTC", "etc/gmt", "Zulu", ""} {
		if got := CountryForTZ(tz); got != "" {
			t.Fatalf("CountryForTZ(%q) = %q, want \"\"", tz, got)
		}
		if TZMismatch(tz, "CH") {
			t.Fatalf("%q must not count as a mismatch", tz)
		}
	}
}

func TestUnknownZoneProducesNoOpinion(t *testing.T) {
	if TZMismatch("Mars/Olympus_Mons", "CH") {
		t.Fatal("an unmapped zone must produce no signal rather than a guess")
	}
}

// The case that started this: an IP in Switzerland, a browser clock in Lagos.
func TestTZMismatchCatchesATunnel(t *testing.T) {
	if !TZMismatch("Africa/Lagos", "CH") {
		t.Fatal("Lagos clock on a Swiss IP should be flagged")
	}
	if TZMismatch("Europe/Zurich", "CH") {
		t.Fatal("a Swiss clock on a Swiss IP must not be flagged")
	}
	if TZMismatch("Europe/Zurich", "ch") {
		t.Fatal("country comparison must be case-insensitive")
	}
}

func TestNoOpinionWithoutGeo(t *testing.T) {
	// An ungeolocated IP is not evidence of anything.
	if TZMismatch("Africa/Lagos", "") {
		t.Fatal("no IP country means no mismatch signal")
	}
}

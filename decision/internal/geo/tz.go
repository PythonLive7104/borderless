package geo

import "strings"

// Browser timezone -> ISO country, for spotting the mismatch a VPN creates.
//
// Why this exists: an IP-intelligence provider can only tell you about exit
// addresses it has catalogued, so a freshly-rotated VPN endpoint looks clean
// and a "block VPN" rule silently does nothing. The visitor's browser, though,
// reports the timezone of the machine itself — and almost nobody changes their
// system clock to match the country they are tunnelling through. An IP in
// Zurich with a browser clock on Africa/Lagos is a tunnel, whatever any
// database says about the address.
//
// Only the zones real traffic actually uses. An unlisted zone returns "" and
// produces no signal, which is the right failure: silence, not a guess.
var tzCountry = map[string]string{
	// Africa
	"Africa/Abidjan": "CI", "Africa/Accra": "GH", "Africa/Addis_Ababa": "ET",
	"Africa/Algiers": "DZ", "Africa/Cairo": "EG", "Africa/Casablanca": "MA",
	"Africa/Dar_es_Salaam": "TZ", "Africa/Johannesburg": "ZA", "Africa/Kampala": "UG",
	"Africa/Khartoum": "SD", "Africa/Kinshasa": "CD", "Africa/Lagos": "NG",
	"Africa/Nairobi": "KE", "Africa/Tunis": "TN", "Africa/Harare": "ZW",
	// Americas
	"America/Anchorage": "US", "America/Argentina/Buenos_Aires": "AR",
	"America/Bogota": "CO", "America/Caracas": "VE", "America/Chicago": "US",
	"America/Denver": "US", "America/Edmonton": "CA", "America/Halifax": "CA",
	"America/Lima": "PE", "America/Los_Angeles": "US", "America/Mexico_City": "MX",
	"America/Montevideo": "UY", "America/New_York": "US", "America/Phoenix": "US",
	"America/Santiago": "CL", "America/Sao_Paulo": "BR", "America/Toronto": "CA",
	"America/Vancouver": "CA", "America/Winnipeg": "CA", "America/Guatemala": "GT",
	"America/Panama": "PA", "America/Havana": "CU", "America/Jamaica": "JM",
	"America/Puerto_Rico": "PR", "America/Costa_Rica": "CR", "America/Santo_Domingo": "DO",
	// Asia
	"Asia/Almaty": "KZ", "Asia/Baghdad": "IQ", "Asia/Baku": "AZ", "Asia/Bangkok": "TH",
	"Asia/Beirut": "LB", "Asia/Colombo": "LK", "Asia/Dhaka": "BD", "Asia/Dubai": "AE",
	"Asia/Ho_Chi_Minh": "VN", "Asia/Hong_Kong": "HK", "Asia/Istanbul": "TR",
	"Asia/Jakarta": "ID", "Asia/Jerusalem": "IL", "Asia/Kabul": "AF",
	"Asia/Karachi": "PK", "Asia/Kathmandu": "NP", "Asia/Kolkata": "IN",
	"Asia/Kuala_Lumpur": "MY", "Asia/Kuwait": "KW", "Asia/Manila": "PH",
	"Asia/Qatar": "QA", "Asia/Riyadh": "SA", "Asia/Seoul": "KR",
	"Asia/Shanghai": "CN", "Asia/Singapore": "SG", "Asia/Taipei": "TW",
	"Asia/Tashkent": "UZ", "Asia/Tbilisi": "GE", "Asia/Tehran": "IR",
	"Asia/Tokyo": "JP", "Asia/Yangon": "MM", "Asia/Yerevan": "AM",
	"Asia/Amman": "JO", "Asia/Damascus": "SY", "Asia/Muscat": "OM",
	// Europe
	"Europe/Amsterdam": "NL", "Europe/Athens": "GR", "Europe/Belgrade": "RS",
	"Europe/Berlin": "DE", "Europe/Brussels": "BE", "Europe/Bucharest": "RO",
	"Europe/Budapest": "HU", "Europe/Copenhagen": "DK", "Europe/Dublin": "IE",
	"Europe/Helsinki": "FI", "Europe/Kiev": "UA", "Europe/Kyiv": "UA",
	"Europe/Lisbon": "PT", "Europe/Ljubljana": "SI", "Europe/London": "GB",
	"Europe/Madrid": "ES", "Europe/Minsk": "BY", "Europe/Moscow": "RU",
	"Europe/Oslo": "NO", "Europe/Paris": "FR", "Europe/Prague": "CZ",
	"Europe/Riga": "LV", "Europe/Rome": "IT", "Europe/Sofia": "BG",
	"Europe/Stockholm": "SE", "Europe/Tallinn": "EE", "Europe/Vienna": "AT",
	"Europe/Vilnius": "LT", "Europe/Warsaw": "PL", "Europe/Zagreb": "HR",
	"Europe/Zurich": "CH", "Europe/Bratislava": "SK", "Europe/Luxembourg": "LU",
	"Atlantic/Reykjavik": "IS",
	// Oceania
	"Australia/Adelaide": "AU", "Australia/Brisbane": "AU", "Australia/Melbourne": "AU",
	"Australia/Perth": "AU", "Australia/Sydney": "AU", "Pacific/Auckland": "NZ",
	"Pacific/Fiji": "FJ", "Pacific/Honolulu": "US",
}

// CountryForTZ maps an IANA timezone to an ISO country code, or "" when the
// zone is unknown or deliberately ignored.
//
// UTC and GMT are treated as unknown on purpose. A great many machines —
// servers, developer laptops, anything freshly installed — sit on UTC without
// their owner ever choosing it, so treating that as "not where the IP says"
// would flag a large population of ordinary visitors.
func CountryForTZ(tz string) string {
	t := strings.TrimSpace(tz)
	if t == "" {
		return ""
	}
	switch strings.ToUpper(t) {
	case "UTC", "GMT", "ETC/UTC", "ETC/GMT", "UCT", "UNIVERSAL", "ZULU":
		return ""
	}
	return tzCountry[t]
}

// TZMismatch reports whether the browser's timezone contradicts where the IP
// says the visitor is.
//
// Both sides must be known: an unmapped zone or an ungeolocated IP produces no
// opinion rather than a false one. This is a strong signal but not a certain
// one — travellers and expatriates genuinely trip it — so callers should treat
// it as evidence toward a verdict, never as the whole verdict.
func TZMismatch(tz, ipCountry string) bool {
	tzc := CountryForTZ(tz)
	if tzc == "" || ipCountry == "" {
		return false
	}
	return !strings.EqualFold(tzc, ipCountry)
}

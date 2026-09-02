"""Destination-URL threat scanning — legitimate campaign protection.

Checks a campaign's destination URL against Google Safe Browsing and/or
VirusTotal so you don't send your own visitors to a page that's been flagged
as malware/phishing (e.g. a hijacked redirect). Uses only the standard library.
No-ops cleanly when no keys are configured.
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

SB_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
VT_URL = "https://www.virustotal.com/api/v3/urls"


def _sb_key():
    return getattr(settings, "GOOGLE_SAFE_BROWSING_KEY", "") or ""


def _vt_key():
    return getattr(settings, "VIRUSTOTAL_KEY", "") or ""


def is_enabled():
    return bool(_sb_key() or _vt_key())


def _post_json(url, payload, headers=None):
    data = json.dumps(payload).encode()
    h = {"Content-Type": "application/json", "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)", "Accept": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    with urllib.request.urlopen(req, timeout=12) as r:
        return json.loads(r.read().decode())


def _safe_browsing(url):
    """Returns list of threat types matched (empty = clean)."""
    body = {
        "client": {"clientId": "borderless", "clientVersion": "1.0"},
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE",
                            "POTENTIALLY_HARMFUL_APPLICATION"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}],
        },
    }
    endpoint = f"{SB_URL}?key={urllib.parse.quote(_sb_key())}"
    resp = _post_json(endpoint, body)
    matches = resp.get("matches", [])
    return [m.get("threatType", "THREAT") for m in matches]


def scan_url(url: str) -> dict:
    """Scan a URL. Returns {safe, flagged_by, threats, checked}. Never raises."""
    if not url or not is_enabled():
        return {"safe": None, "flagged_by": [], "threats": [], "checked": False}
    flagged_by = []
    threats = []
    if _sb_key():
        try:
            t = _safe_browsing(url)
            if t:
                flagged_by.append("google_safe_browsing")
                threats.extend(t)
        except Exception:
            pass
    if _vt_key():
        try:
            hits = _vt_scan(url)
            if hits > 0:
                flagged_by.append("virustotal")
                threats.append(f"virustotal:{hits}_engines")
        except Exception:
            pass
    return {
        "safe": len(flagged_by) == 0,
        "flagged_by": flagged_by,
        "threats": threats,
        "checked": True,
    }


def _vt_scan(url: str) -> int:
    """Submit URL to VirusTotal, read the analysis stats. Returns malicious count."""
    import base64
    # VT v3: submit (form-encoded), then GET the url object by its id.
    submit = urllib.request.Request(
        VT_URL,
        data=urllib.parse.urlencode({"url": url}).encode(),
        headers={"x-apikey": _vt_key(), "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)",
                 "Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(submit, timeout=12):
        pass
    url_id = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
    get = urllib.request.Request(
        f"{VT_URL}/{url_id}", headers={"x-apikey": _vt_key(), "User-Agent": "TryNoBot/1.0 (+https://trynobot.com)"}, method="GET")
    with urllib.request.urlopen(get, timeout=12) as r:
        data = json.loads(r.read().decode())
    stats = data.get("data", {}).get("attributes", {}).get("last_analysis_stats", {})
    return int(stats.get("malicious", 0)) + int(stats.get("suspicious", 0))

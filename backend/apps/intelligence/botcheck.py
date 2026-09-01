"""Public 'bot exposure' check.

Given a website URL, fetch ONLY what is publicly visible (homepage response
headers + HTML, and robots.txt) and report how exposed the site is to bots and
how well it's protected. No login, no intrusive scanning.

Security: this fetches a user-supplied URL server-side, so it is a classic SSRF
surface. We only allow http/https on standard ports, resolve the host and reject
private/loopback/link-local/reserved IPs, and re-validate every redirect hop.
"""
import ipaddress
import socket
import urllib.error
import urllib.request
from urllib.parse import urljoin, urlparse

UA = "BorderlessBotCheck/1.0 (+https://borderless.io/bot-check)"
MAX_BYTES = 600_000
TIMEOUT = 8
MAX_REDIRECTS = 3

SECURITY_HEADERS = [
    ("content-security-policy", "Content-Security-Policy"),
    ("strict-transport-security", "HSTS (Strict-Transport-Security)"),
    ("x-frame-options", "X-Frame-Options"),
    ("x-content-type-options", "X-Content-Type-Options"),
    ("referrer-policy", "Referrer-Policy"),
]
CDN_HINTS = ["cloudflare", "cf-ray", "akamai", "fastly", "sucuri", "incapsula",
            "imperva", "cloudfront", "stackpath", "bunnycdn"]
BOTMGMT_HINTS = ["datadome", "perimeterx", "px-", "kasada", "cloudflare bot",
                "akamai bot", "botd", "fingerprintjs", "hcaptcha", "recaptcha",
                "challenges.cloudflare", "turnstile"]


def _validate(url):
    """Return (normalized_url, error). Blocks SSRF-unsafe targets."""
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return None, "Enter a full http(s) website URL."
    host = p.hostname
    if not host:
        return None, "That doesn't look like a valid URL."
    port = p.port or (443 if p.scheme == "https" else 80)
    if port not in (80, 443):
        return None, "Only standard web ports (80/443) are supported."
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except Exception:
        return None, "Could not resolve that domain."
    for info in infos:
        addr = ipaddress.ip_address(info[4][0])
        if (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast or addr.is_unspecified):
            return None, "That address range is not allowed."
    return url, None


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None  # never auto-follow; we handle hops manually


def _fetch(url):
    """Fetch a URL with manual, validated redirects. Returns (status, headers, body, final_url) or raises."""
    opener = urllib.request.build_opener(_NoRedirect)
    seen = 0
    while True:
        ok, err = _validate(url)
        if err:
            raise ValueError(err)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            resp = opener.open(req, timeout=TIMEOUT)
        except urllib.error.HTTPError as e:
            if e.code in (301, 302, 303, 307, 308) and seen < MAX_REDIRECTS:
                loc = e.headers.get("Location")
                if not loc:
                    raise ValueError("Redirect without a location.")
                url = urljoin(url, loc)
                seen += 1
                continue
            # non-redirect HTTP error still has headers/body worth reading
            body = e.read(MAX_BYTES).decode("utf-8", "replace")
            return e.code, {k.lower(): v for k, v in e.headers.items()}, body, url
        body = resp.read(MAX_BYTES).decode("utf-8", "replace")
        headers = {k.lower(): v for k, v in resp.headers.items()}
        return resp.status, headers, body, url


def _robots(url):
    p = urlparse(url)
    try:
        _, _, body, _ = _fetch(f"{p.scheme}://{p.netloc}/robots.txt")
        return bool(body.strip())
    except Exception:
        return False


def run_check(url: str) -> dict:
    url = (url or "").strip()
    if not url:
        return {"ok": False, "error": "Enter a website URL."}
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    ok, err = _validate(url)
    if err:
        return {"ok": False, "error": err}

    try:
        status, headers, body, final = _fetch(url)
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except Exception:
        return {"ok": False, "error": "We couldn't reach that site. Check the URL and try again."}

    body_l = body.lower()
    hdr_blob = " ".join(f"{k}:{v}" for k, v in headers.items()).lower()
    findings = []
    exposure = 0

    def add(status_, label, detail, pts=0):
        nonlocal exposure
        exposure += pts
        findings.append({"status": status_, "label": label, "detail": detail})

    # HTTPS
    if final.startswith("https://"):
        add("good", "Served over HTTPS", "Traffic to the site is encrypted.")
    else:
        add("bad", "No HTTPS", "The site is served over plain HTTP.", 20)

    # CDN / WAF
    if any(h in hdr_blob for h in CDN_HINTS):
        add("good", "CDN / WAF detected", "A CDN or web-application firewall sits in front of the site.")
    else:
        add("bad", "No CDN or WAF detected", "No Cloudflare/Akamai/Fastly-style edge protection was seen — bots reach your origin directly.", 25)

    # bot management / fingerprinting
    if any(h in body_l or h in hdr_blob for h in BOTMGMT_HINTS):
        add("good", "Bot management present", "A bot-detection or challenge system was detected.")
    else:
        add("bad", "No bot detection detected", "Nothing was found that scores or challenges automated visitors — this is the gap Borderless fills.", 25)

    # security headers
    missing = [name for key, name in SECURITY_HEADERS if key not in headers]
    if not missing:
        add("good", "Strong security headers", "All key protective headers are present.")
    else:
        add("warn", f"{len(missing)} security header(s) missing", "Missing: " + ", ".join(missing) + ".", min(30, len(missing) * 6))

    # server disclosure
    server = headers.get("server", "")
    if any(ch.isdigit() for ch in server):
        add("warn", "Server version exposed", f"The Server header reveals '{server}', helping attackers target known flaws.", 10)
    elif server:
        add("good", "Server software masked", "The Server header doesn't leak a version.")

    # robots.txt
    if _robots(final):
        add("good", "robots.txt found", "The site gives crawlers guidance.")
    else:
        add("warn", "No robots.txt", "Crawlers get no guidance about what to index.", 3)

    exposure = min(100, exposure)
    grade = "A" if exposure < 20 else "B" if exposure < 40 else "C" if exposure < 60 else "D" if exposure < 80 else "F"
    return {
        "ok": True,
        "url": final,
        "exposure": exposure,
        "grade": grade,
        "findings": findings,
        "summary": _summary(grade),
    }


def _summary(grade):
    return {
        "A": "Well protected. A few gaps aside, this site already resists most automated abuse.",
        "B": "Reasonably protected, but bots still have room to get through.",
        "C": "Partially exposed. Automated traffic can reach and probe this site fairly easily.",
        "D": "Highly exposed. There's little standing between bots and this site.",
        "F": "Wide open. This site has almost no defence against automated traffic.",
    }[grade]

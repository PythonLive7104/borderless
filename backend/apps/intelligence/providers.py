"""IP-intelligence providers. Return a normalized dict:
    {"proxy": bool, "vpn": bool, "datacenter": bool, "country": str, "isp": str, "fraud_score": int}
An empty dict means "no data" (feature off or lookup failed)."""
import json
import os
import urllib.parse
import urllib.request


def _get(url: str, timeout=3):
    req = urllib.request.Request(url, headers={"User-Agent": "TryNoBot/1.0 (+https://trynobot.com)", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


class NullProvider:
    def lookup(self, ip: str) -> dict:
        return {}


class IPQualityScoreProvider:
    """https://www.ipqualityscore.com — one call returns proxy/vpn/datacenter/fraud_score."""
    def __init__(self, key: str):
        self.key = key

    def lookup(self, ip: str) -> dict:
        try:
            url = f"https://ipqualityscore.com/api/json/ip/{self.key}/{urllib.parse.quote(ip)}"
            d = _get(url)
            if not d.get("success", True):
                return {}
            return {
                "proxy": bool(d.get("proxy")),
                "vpn": bool(d.get("vpn") or d.get("tor")),
                "datacenter": d.get("connection_type") == "Data Center" or bool(d.get("is_crawler")),
                "country": d.get("country_code", ""),
                "isp": d.get("ISP", ""),
                "fraud_score": int(d.get("fraud_score", 0)),
            }
        except Exception:
            return {}


def get_provider():
    name = os.getenv("IP_INTEL_PROVIDER", "none").lower()
    if name == "ipqualityscore" and os.getenv("IPQUALITYSCORE_KEY"):
        return IPQualityScoreProvider(os.getenv("IPQUALITYSCORE_KEY"))
    return NullProvider()

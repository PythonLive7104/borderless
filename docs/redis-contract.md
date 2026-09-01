# Redis contract (v1)

The only coupling between Django (control plane) and Go (data plane) is this Redis
schema. Django is the sole **writer** of config keys; Go is the sole **reader**.
Click events flow the other way through a stream.

## Config: campaign rules  (Django writes, Go reads)

Key: `campaign:{public_id}`  — a Redis HASH, or a single JSON string value.
We use a JSON string for simplicity in the MVP:

```
SET campaign:{public_id} '<json>'
```

JSON shape:

```json
{
  "v": 1,
  "public_id": "ab12cd34",
  "active": true,
  "money": { "mode": "redirect", "value": "https://offer.example/lp" },
  "white": { "mode": "html", "value": "<html>...safe page...</html>" },
  "rules": {
    "geo_allow": ["US", "CA", "GB"],
    "geo_deny": [],
    "device_allow": ["mobile", "desktop"],
    "block_headless": true,
    "block_datacenter_ip": true,
    "ip_blocklist_ref": "campaign:{public_id}:ipblock",
    "ua_deny_substrings": ["bot", "crawler", "python-requests"]
  }
}
```

`mode` ∈ `redirect` | `html` | `proxy` (proxy reserved for later).

## Config: per-campaign IP blocklist (optional, large sets)

Key: `campaign:{public_id}:ipblock` — a Redis SET of CIDR strings or exact IPs.
Kept separate from the JSON so big lists don't bloat the config blob.

## Global datacenter/proxy IP set (shared across campaigns)

Key: `ipintel:datacenter` — Redis SET of CIDRs. Populated by a Django task that
pulls from the IP-intelligence provider. Go checks membership on each request.

## Global TLS/JA3 blocklist (shared, Django writes, Go reads)

Key: `ja3:blocklist` — a Redis SET of known-bad JA3 fingerprint hashes. Managed
by staff via the `JA3Block` model; every save/delete resyncs the set (signal),
and `python manage.py sync_ja3` rebuilds it. Go checks membership on each request
using the JA3 supplied by a TLS-terminating upstream (Cloudflare `CF-JA3-Hash`,
or an Nginx/HAProxy JA3 module → `X-JA3-Hash`) and adds the `known_bad_ja3` risk
signal. In plain-HTTP dev there is no real JA3 unless a header is injected.

## Events: clicks  (Go writes, Django reads)

Stream: `events:clicks` — Go `XADD`s one entry per decision:

```
XADD events:clicks * \
  public_id ab12cd34 \
  ts 1712345678 \
  verdict money \
  reason ok \
  ip 1.2.3.4 \
  country US \
  device mobile \
  ua "Mozilla/5.0 ..." \
  is_headless 0
```

Django runs a consumer (`manage.py consume_clicks`) reading this stream with a
consumer group and writing rows into the `analytics_click` table.

## Versioning

`v` in the config JSON is the schema version. Bump it on breaking changes; Go
rejects configs whose `v` it doesn't understand and falls back to serving the
white page (fail-safe).

# Redis contract (v2)

The only coupling between Django (control plane) and Go (data plane) is this
Redis schema. **Django is the sole writer of config keys; Go is the sole
reader.** Scored events flow the other way through a stream. Neither service
calls the other over HTTP, and Go never touches Postgres.

> Superseded: v1 described a `campaign:{public_id}` config holding a "money"
> and a "white" page. That design and its code are gone. Scored traffic is
> recorded as `apps.traffic.TrafficEvent`, and verified crawlers are always
> served the same content as humans — see `decision/internal/crawler`.

## Config keys (Django writes, Go reads)

### `rules:{tracking_id}` — string (JSON array)

Active traffic rules for one website, ordered by priority. Written by
`apps/rules/sync.py::publish_org`. First fully-matching rule wins; every
condition in a rule must hold (AND).

```json
[{"action": "block", "tag": "", "redirect_url": "",
  "conditions": [{"field": "classification", "operator": "eq", "value": "bot"}]}]
```

`action` ∈ `allow` | `redirect` | `block` | `review` | `tag`. The fields a
condition may test are defined once in `apps/rules/models.py::FIELD_CHOICES`
and consumed in `decision/internal/rules`; the two lists must stay in step.

### `ipfilter:{tracking_id}` — string (JSON object)

The workspace's IP allow/deny lists, as exact IPs or CIDRs. Evaluated *after*
the rules and overriding them: an allow match forces `allow`, a deny match
forces `block`.

```json
{"allow": ["203.0.113.4"], "deny": ["10.0.0.0/8"]}
```

### `site:{tracking_id}` — string (org id)

Proves a site exists and says which workspace owns it. The Shield endpoints
(`/v1/decide`, `/v1/guard`) authorize on this alone; an API key is optional and,
when present, must resolve to the same org. **Its absence is how billing is
enforced** — see Entitlement below.

### `shortlink:{host}:{slug}` — string (JSON object)

One short link's destination and policy. Written by
`apps/links/sync.py::publish_link`. Keyed by host *and* slug because slugs are
unique per domain, so the same slug can exist on two domains for two
workspaces. A bare `shortlink:{slug}` key is the retired v1 form; writers no
longer create it and `unpublish_link` clears it opportunistically.

A link is published only when its domain is usable *and* the workspace is
entitled to that domain. Anything else is withdrawn rather than left stale —
that is how a burned or reclaimed domain is switched off.

### `apikey:{sha256}` — string (org id)

REST API key hash → owning workspace. Written by
`apps/integrations/shield.py`. Only the hash is ever stored.

### `ja3:blocklist`, `ja4:blocklist` — sets

Known-bad TLS fingerprint hashes, managed by staff through the `JA3Block` /
`JA4Block` models; every save/delete resyncs, and `manage.py sync_ja3` rebuilds.
Go gets the visitor's JA3/JA4 from a TLS-terminating upstream (Cloudflare
`CF-JA3-Hash`, or an nginx/HAProxy JA3 module → `X-JA3-Hash`). In plain-HTTP dev
there is no real JA3 unless a header is injected.

## Shared caches (both read and write)

### `ipintel:cache:{ip}` — string (JSON), TTL 24h

IP-intelligence results — datacenter / proxy / VPN / ASN / ISP / fraud score.
Both planes read and write it so one lookup serves both and the provider is not
billed twice for the same IP.

### `corpus:{ja3|ja4|fp}:{hash}` — set of IPs, sliding TTL

The cross-customer threat corpus. Each fingerprint holds the set of **distinct
IPs confirmed bad while carrying it**; the set's cardinality is the evidence. A
single sighting never blocklists a fingerprint, because thousands of real users
share one — only accumulation across many confirmed-bad IPs does. Written
off the hot path (goroutine), so it adds nothing to decision latency.

### Rate counters — `srate:{site}:{ip}`, `iprate:{ip}`, TTL 60s

Per-site and global per-IP request rates, feeding the `abnormal_request_rate`
risk signal and the `requests_per_min` rule field.

## Events (Go writes, Django reads)

### `events:traffic` — stream, MAXLEN ~5,000,000

One entry per scored event, from the tracker, the Shield or a short-link click.
`manage.py consume_traffic` reads it with a consumer group and writes
`Visitor` / `Session` / `TrafficEvent` rows into Postgres.

Fields: `site_id`, `visitor_id`, `session_id`, `type`, `url`, `referrer`, `ip`,
`country`, `device`, `browser`, `os`, `ua`, `is_headless`, `risk_score`,
`classification`, `confidence`, `signals`, `ja3`, `ja4`, `action`, `tag`,
`redirect_url`, `reviewer`, `reviewer_platform`, `ts`.

`reviewer` / `reviewer_platform` label a verified ad-network review crawler.
They exist for **reporting only** — a reviewer is served exactly what a human
is served. Serving it anything else is cloaking.

## Entitlement

`apps/billing/entitlements.py` enforces the billing window on the hot path by
withdrawing the keys above (`revoke_org`) and republishing them
(`restore_org`). `manage.py enforce_access` applies it hourly, since expiry is
a moment in time with no request behind it.

Revocation deliberately fails **open**: with `site:{tid}` gone, `/v1/decide`
answers `allow` and `/v1/guard` returns 204. An unpaid workspace stops being
protected; its website is never taken down over billing.

## Versioning

Breaking changes bump the version in this document's title and, where a payload
carries one, its `v` field. Go must reject a payload whose version it does not
understand and fall back to its safe default — which is to allow the visitor,
never to block one.

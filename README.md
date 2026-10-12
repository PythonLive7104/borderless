# Borderless (TryNoBot)

Traffic-intelligence and bot-filtering platform: it scores every visitor in real
time, classifies the visit as human / suspicious / bot / fraud with the signals
behind the score, and lets the site owner act on that — block, redirect, tag or
allow.

It is a fraud-detection product, not a cloaker. Verified search and ad-review
crawlers are **always** served exactly what a human is served; they are
identified only so an advertiser's reports can separate genuine clicks from a
platform's own automated review visits. See `decision/internal/crawler` for why
that rule exists and how it is enforced, and the acceptable-use section of the
Terms for the policy it implements.

Built as a two-plane system:

- **Control plane** — Django DRF: auth, workspaces, websites, traffic rules,
  short links, analytics, billing.
- **Data plane** — Go decision service: the real-time hot path that scores a
  visitor and returns allow / block / redirect in single-digit milliseconds.
- **Frontend** — React (Vite) dashboard + marketing site, server-rendered.

Django owns Postgres (source of truth) and publishes config into **Redis**. The
Go service reads config from Redis only (never touches Postgres) and emits
traffic events back through Redis Streams, which Django consumes into Postgres.

```
React ── Django DRF (control) ──┬── Postgres (truth)
                                └── Redis ──┬── Go engine (hot path) ── allow/block/redirect
                                            └── Cloudflare Worker (edge KV)
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard:  http://localhost:5173
- Django API: http://localhost:8000/api/
- Engine:     http://localhost:8080/healthz

Create an admin user:

```bash
docker compose exec backend python manage.py createsuperuser
```

## How traffic reaches the engine

Three surfaces, all scored by the same pipeline:

1. **Tracker** (`/bl.js`) — a script on the customer's page. Collects a browser
   fingerprint and passive behaviour, and enforces the verdict client-side.
   Strict mode hides the page until the verdict lands.
2. **Shield** (`/v1/decide`, `/v1/guard`) — a server-side check the customer
   calls *before* rendering, from PHP, Django, Node, nginx, a Cloudflare Worker
   or Pages middleware. Stops automation that never runs JavaScript.
3. **Short links** (`/<slug>`) — branded redirects that score the click, send
   real people to the destination and apply the link's bot policy to the rest.
   Links that filter nobody are mirrored into Cloudflare KV and served at the
   edge (see `edge/`).

## Scoring

`decision/internal/risk` is a deterministic weighted-signal model producing a
0–100 score mapped to human / suspicious / bot / fraud. Signals come from the
IP (datacenter, proxy/VPN, provider fraud score, abuse history), the TLS
fingerprint (JA3/JA4), the browser fingerprint, the request rate, and passive
behaviour. Observed human interaction *subtracts* risk, capped, so a real
visitor can be exonerated but a known-bad IP can never be fully whitewashed.

A cross-customer corpus (`corpus:*` in Redis) records the distinct confirmed-bad
IPs seen behind each fingerprint, so a bot farm rotating IPs behind one TLS
fingerprint becomes known to every customer. Cardinality is the evidence — a
single sighting never blocklists a fingerprint, because thousands of real users
share one.

## The Django <-> Go contract

Django is the only writer of Redis config keys; Go is the only reader. The keys:

| Key | Written by | Read by | Contents |
| --- | --- | --- | --- |
| `rules:{tracking_id}` | `apps/rules/sync.py` | engine | active traffic rules for a site |
| `ipfilter:{tracking_id}` | `apps/rules/sync.py` | engine | workspace IP allow/deny lists |
| `site:{tracking_id}` | `apps/rules/sync.py` | engine | site → org id (authorizes the Shield) |
| `shortlink:{host}:{slug}` | `apps/links/sync.py` | engine | one short link's destination + policy |
| `apikey:{sha256}` | `apps/integrations/shield.py` | engine | API key → org id |
| `ja3:blocklist`, `ja4:blocklist` | `apps/intelligence` | engine | known-bad TLS fingerprints |
| `ipintel:cache:{ip}` | both | both | shared IP-intelligence cache |
| `corpus:{kind}:{hash}` | engine | engine | shared threat corpus |
| `events:traffic` (stream) | engine | `manage.py consume_traffic` | scored events → Postgres |

Withdrawing a workspace's keys is how billing is enforced on the hot path — see
`apps/billing/entitlements.py`. Revocation deliberately fails **open**: an
expired workspace stops being protected, its site is never taken down.

Full payload shapes and semantics: `docs/redis-contract.md`.

## Workers

| Command | What it does |
| --- | --- |
| `manage.py consume_traffic` | Redis stream → Postgres (long-lived) |
| `celery -A config worker` | async tasks |
| `celery -A config beat` | retention enforcement (daily), JA3 resync (hourly) |
| `manage.py enforce_access` | applies billing expiry to Redis (hourly cron) |
| `manage.py check_domain_health` | registrar/blocklist health of short domains |

## Deploying

`docker-compose.yml` is the dev stack (Vite + runserver). Production is
`docker-compose.prod.yml` (gunicorn + nginx-served build), deployed with
`bash update.sh`, which backs up Postgres, checks the migration graph before
touching the running stack, and refuses to half-apply. See `deploy/README.md`.

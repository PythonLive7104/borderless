# TryNoBot edge redirector

A Cloudflare Worker that serves short-link redirects at the edge — in the
visitor's own city — for links that filter nobody. Everything else passes
through to the origin unchanged, so the origin stays the single source of truth
and no fraud filtering is ever skipped.

## How it works

1. Django (`apps/links/edge.py`) decides which links are **edge-safe**: active,
   `bot_action=off`, no challenge/deep-check/VPN/datacenter/geo/device/OS/risk
   filtering, and no rules. Only those are mirrored into Cloudflare KV. The sync
   happens automatically inside `publish_link` whenever a link changes.
2. The Worker looks up `<host>:<slug>` in KV. A hit → instant `302` at the edge.
   A miss (filtering link, unknown slug, reserved path) → `fetch(request)` to
   the origin, which decides exactly as before.
3. Every edge-served click is POSTed to the origin's `/v1/edge-click`
   (best-effort, `waitUntil`) so click counters, IP/fingerprint memory and the
   shared corpus keep updating centrally.

## One-time setup

```bash
cd edge
npm i -g wrangler            # or use npx
wrangler login

# 1. Create the KV namespace and paste its id into wrangler.toml
wrangler kv namespace create SHORTLINKS

# 2. Shared secret — MUST match EDGE_CLICK_SECRET in the origin .env
wrangler secret put EDGE_CLICK_SECRET

# 3. Add a [[routes]] block per short domain in wrangler.toml, then:
wrangler deploy
```

On the origin, set in `.env` (all optional — the sync stays inert until set):

```
CF_API_TOKEN=...            # token with "Workers KV Storage: Edit"
CF_ACCOUNT_ID=...
CF_KV_NAMESPACE_ID=...      # the id from step 1
EDGE_CLICK_SECRET=...       # same value as the Worker secret
```

Then backfill the edge:

```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py sync_shortlinks_kv
```

## Safety notes

- The Worker never *decides* to filter — it only serves links Django already
  proved need no filtering. A filtering link is simply absent from KV and falls
  through to the origin.
- If KV is unavailable, the Worker fails to the origin, never to a broken redirect.
- `/v1/edge-click` requires `X-Edge-Secret`, so clicks can't be forged to poison
  the corpus.
- JA3/JA4 reach the edge only with Cloudflare Bot Management; without it the
  origin's async scoring still runs on IP/UA/ASN, so protection degrades
  gracefully rather than breaking.

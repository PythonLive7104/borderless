# Deploying Borderless to a VPS (e.g. InterServer)

The dev stack (`docker-compose.yml`) runs Vite + runserver. **Production uses
`docker-compose.prod.yml`**: gunicorn for Django, the frontend built and served
by nginx, which also reverse-proxies the API and the Go engine. Single public
port is **80** (put Cloudflare or certbot in front for HTTPS).

## 1. Provision the server
- InterServer VPS, **Ubuntu 22.04+**, **4 GB RAM recommended** (2 GB works with swap).
- Point your domain's **A record** at the VPS IP. Using **Cloudflare** in front is
  recommended — it gives you free TLS **and** the real JA3 header the engine uses.

## 2. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out/in after this
```

## 3. Get the code
```bash
git clone <your-repo-url> borderless && cd borderless
# (or scp the project up if you're not using a git host yet)
```

## 4. Configure `.env`
```bash
cp .env.example .env
nano .env
```
Set these for production (the rest can stay as-is until you add the API keys):
```
DJANGO_DEBUG=0
DJANGO_SECRET_KEY=<64 random chars, NO $ signs>
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
CSRF_TRUSTED_ORIGINS=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
TRACKER_URL=https://yourdomain.com/bl.js

POSTGRES_PASSWORD=<strong password>
DATABASE_URL=postgresql://borderless:<same password>@postgres:5432/borderless
REDIS_URL=redis://redis:6379/0
```
> If you use **Cloudflare in "Flexible" SSL mode**, also set `DJANGO_SSL_REDIRECT=0`
> to avoid a redirect loop. With Cloudflare "Full" or certbot, leave it at 1.

## 5. Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
This builds the frontend, runs migrations + collectstatic, and starts every
service. First build takes a few minutes.

## 6. Create an admin user
```bash
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## 7. HTTPS
- **Easiest:** put the domain behind **Cloudflare** (proxied) → set SSL to *Full*.
- **Or certbot:** run nginx/certbot on the host in front of the `web` container on 80.

## 8. Verify
- `https://yourdomain.com` → marketing site
- `https://yourdomain.com/bl.js` → tracker script (served by the Go engine)
- `https://yourdomain.com/admin/` → Django admin
- Sign up → you should get a real verification email once RESEND_API_KEY is set.

## Updating later
```bash
bash update.sh
```
That's the whole deploy. It backs the database up first (and refuses to continue
if the dump is empty), pulls, **checks the migration graph before touching the
running stack**, rebuilds the images, waits for gunicorn to actually answer, then
runs `sync_shield` and `enforce_access`. Any failure stops the script with the
restore command printed.

Rebuilding is not optional: production bakes the code into the images, so
`docker compose restart` silently keeps running the previous build.

## 9. Short-link domain & abuse handling
Short links run on their own domain so that link abuse can't blacklist
`trynobot.com` (dashboard + email deliverability).

1. Register the short domain at a registrar that **forwards** abuse complaints
   rather than suspending on the first one. Cloudflare Registrar is the safe
   pick; Namecheap suspends aggressively on phishing reports, which takes every
   customer's links down at once.
2. Point its DNS at this box, then issue the cert **before** deploying —
   `deploy/shortdomain.sh` silently no-ops while the cert is missing.
3. Set `SHORT_DOMAIN`, `SHORTLINK_BASE` and `ABUSE_EMAIL` in `.env`, then
   `docker compose -f docker-compose.prod.yml up -d --force-recreate web`
   (a plain `restart` will not reload `.env`).
4. Put `ABUSE_EMAIL` in the domain's WHOIS record and **read it**. Complaints
   reach the registrar only when the reporter can't get action from us.
5. Verify the domain in Google Search Console now, while things are calm — if it
   ever gets flagged you want to click "request review", not scramble to prove
   ownership mid-outage.

## Scheduled jobs (host cron)
Celery was removed to save RAM, so these run from host cron:

```cron
0 3 * * *   docker compose -f docker-compose.prod.yml exec -T backend python manage.py enforce_retention
0 * * * *   docker compose -f docker-compose.prod.yml exec -T backend python manage.py sync_ja3
15 * * * *  docker compose -f docker-compose.prod.yml exec -T backend python manage.py rescan_links
30 * * * *  docker compose -f docker-compose.prod.yml exec -T backend python manage.py enforce_access
```

`enforce_access` is what makes the weekly window real. A subscription expires at
a moment in time with no request behind it, so nothing in the request path
notices; this command withdraws the Redis keys the Go engine reads (`rules:`,
`ipfilter:`, `site:`, `apikey:`, `shortlink:`) for any workspace past its period,
and republishes them on renewal. Without it an expired customer keeps full bot
protection and working short links indefinitely. The engine fails open when the
keys are gone — /v1/decide answers "allow", short links 404 — so we stop
protecting their traffic without ever taking their own website down.

`rescan_links` re-checks the destinations of live short links and disables any
that turned malicious after they were created — the slow bait-and-switch that
create/edit-time scanning can't catch. Defaults scan 60 links/hour to stay inside
the VirusTotal free-tier quota; raise `--limit` (and `--sleep`) as volume grows.

## Notes
- `deploy/nginx.conf` + `deploy/proxy.inc` are baked into the `web` image.
- The traffic stream consumer runs in `worker`; scheduled jobs are host cron
  (above), not Celery.
- Real TLS/JA3 needs a TLS-terminating proxy (Cloudflare or an nginx JA3 build).

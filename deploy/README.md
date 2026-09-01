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
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Notes
- `deploy/nginx.conf` + `deploy/proxy.inc` are baked into the `web` image.
- Scheduled jobs (retention, JA3 resync) run in `celery-beat`; the traffic
  stream consumer runs in `worker`.
- Real TLS/JA3 needs a TLS-terminating proxy (Cloudflare or an nginx JA3 build).

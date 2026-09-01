# Production deployment notes

The dev stack (`docker-compose.yml`) runs Vite + Django's runserver directly.
For production:

1. **Reverse proxy** — put `deploy/nginx.conf` in front of the stack as the only
   public service. It routes `/api`, `/admin`, `/static` to the Django backend and
   `/bl.js`, `/v1` to the Go decision engine, and serves the built React app for
   everything else. Copy `deploy/proxy.inc` to `/etc/nginx/proxy.inc`.
2. **App server** — run Django under gunicorn (already in requirements) instead of
   runserver; build the frontend (`npm run build`) and serve `dist/` from nginx.
3. **Scheduled jobs** — handled by `celery-worker` + `celery-beat` (retention
   enforcement daily, JA3 resync hourly). No sleep-loops.
4. **Real TLS/JA3** — terminate TLS at nginx (with the ja3 module) or HAProxy, or
   sit behind Cloudflare, so the decision engine receives a real JA3 fingerprint.
5. **Secrets** — set `DJANGO_SECRET_KEY` (no `$` — Compose interpolates it), plus
   the external API keys documented in `.env` (Bachs, Resend, IPQualityScore, etc.).

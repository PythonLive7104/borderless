# Borderless

Traffic-filtering / cloaking platform (Adspect-style), built as a two-plane system:

- **Control plane** — Django DRF: auth, campaigns, filter rules, analytics, billing.
- **Data plane** — Go decision service: the real-time hot path that classifies each
  visitor and returns a `money` or `white` verdict in <10ms.
- **Frontend** — React (Vite) dashboard.

Django owns Postgres (source of truth) and pushes campaign config into **Redis**.
The Go service reads config from Redis only (never touches Postgres) and emits click
events back through Redis Streams, which Django consumes into analytics.

```
React ── Django DRF (control) ──┬── Postgres (truth)
                                └── Redis ── Go decision (hot path) ── money/white
```

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard:  http://localhost:5173
- Django API: http://localhost:8000/api/
- Decision:   http://localhost:8080/d/<campaign_public_id>

Create an admin user:

```bash
docker compose exec backend python manage.py createsuperuser
```

## MVP scope (mirrors adspect.ai core)

- Campaigns: money page + white page (URL or inline HTML), per-campaign filter rules
- Filter pipeline: IP blocklist, geo allow/deny, device/OS, headless & bot detection,
  user-agent rules
- Decision endpoint serving money vs white page
- Click logging + per-campaign analytics (verdict breakdown, funnel)
- JWT auth, multi-campaign dashboard

## The Django <-> Go contract

See `docs/redis-contract.md` for the versioned Redis key schema shared by both services.

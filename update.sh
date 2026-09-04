#!/usr/bin/env bash
# One-command deploy.  Usage:  bash update.sh
#
# Encodes the things that are easy to get wrong by hand:
#   * prod BAKES code into the images — a plain `restart` silently runs the OLD
#     code, so this always rebuilds
#   * migrations run inside the backend container on boot; if the graph is bad
#     the container crash-loops and nginx serves 502 for everything, so this
#     checks the graph BEFORE touching the running stack
#   * a bad deploy should stop, not half-apply
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
cd "$(dirname "$0")"

say()  { printf "\n\033[1;34m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ok\033[0m %s\n" "$*"; }
die()  { printf "\n\033[1;31m!! %s\033[0m\n" "$*" >&2; exit 1; }

# --- 1. Backup ------------------------------------------------------------
say "Backing up the database"
mkdir -p "$BACKUP_DIR"
BACKUP="$BACKUP_DIR/db-$(date +%F-%H%M).sql"
$COMPOSE exec -T postgres pg_dump -U "${POSTGRES_USER:-borderless}" "${POSTGRES_DB:-borderless}" > "$BACKUP" \
  || die "pg_dump failed — is postgres up? Nothing was changed."
[ -s "$BACKUP" ] || die "Backup is empty; refusing to deploy. ($BACKUP)"
ok "$(du -h "$BACKUP" | cut -f1) -> $BACKUP"
ls -1t "$BACKUP_DIR"/db-*.sql 2>/dev/null | tail -n +15 | xargs -r rm --   # keep 14

# --- 2. Code --------------------------------------------------------------
say "Pulling latest code"
BEFORE=$(git rev-parse --short HEAD)
git fetch origin
git reset --hard origin/main      # safe: .env and certbot/ are untracked
AFTER=$(git rev-parse --short HEAD)
[ "$BEFORE" = "$AFTER" ] && ok "already at $AFTER" || ok "$BEFORE -> $AFTER"

# --- 3. Pre-flight --------------------------------------------------------
# Catch a broken migration graph here, where it costs nothing, instead of
# discovering it as a crash-looping container and a site-wide 502.
say "Checking the migration graph"
$COMPOSE run --rm --no-deps --entrypoint "" backend python -c "
import os, django
from collections import Counter
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.db.migrations.loader import MigrationLoader
leaves = MigrationLoader(None, ignore_no_migrations=True).graph.leaf_nodes()
dupes = sorted(a for a, c in Counter(app for app, _ in leaves).items() if c > 1)
raise SystemExit('CONFLICT: ' + ', '.join(dupes) if dupes else 0)
" >/dev/null 2>&1 || die "Conflicting migrations (multiple leaf nodes). Fix before deploying — the old stack is still running and untouched."
ok "single leaf per app"

# --- 4. Build + start -----------------------------------------------------
say "Building images (this leans on swap; a few minutes is normal)"
$COMPOSE build backend web decision worker || die "Build failed. The running stack is untouched."
ok "built"

say "Starting"
$COMPOSE up -d
ok "containers up"

# --- 5. Wait for the backend to actually serve ----------------------------
say "Waiting for the backend"
for i in $(seq 1 30); do
  if $COMPOSE exec -T backend python -c "import socket;socket.create_connection(('127.0.0.1',8000),1)" 2>/dev/null; then
    ok "gunicorn is answering"; BACKEND_UP=1; break
  fi
  sleep 4
done
if [ "${BACKEND_UP:-}" != "1" ]; then
  printf "\n\033[1;31mBackend never came up. Last 40 lines:\033[0m\n"
  $COMPOSE logs --tail=40 backend
  die "Deploy failed. Restore with:  $COMPOSE exec -T postgres psql -U ${POSTGRES_USER:-borderless} ${POSTGRES_DB:-borderless} < $BACKUP"
fi

# --- 6. Post-deploy -------------------------------------------------------
say "Syncing the engine"
$COMPOSE exec -T backend python manage.py sync_shield
$COMPOSE exec -T backend python manage.py enforce_access

say "Done"
$COMPOSE ps --format 'table {{.Service}}\t{{.Status}}'
printf "\nBackup: %s\n" "$BACKUP"

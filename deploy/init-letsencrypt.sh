#!/bin/sh
# One-time Let's Encrypt bootstrap for the dockerized nginx.
# Usage:  ./deploy/init-letsencrypt.sh <domain> <email>
#   e.g.  ./deploy/init-letsencrypt.sh echooconnet.com you@example.com
set -e

DOMAIN="${1:?Usage: init-letsencrypt.sh <domain> <email>}"
EMAIL="${2:?Usage: init-letsencrypt.sh <domain> <email>}"
COMPOSE="docker compose -f docker-compose.prod.yml"
CONF="./certbot/conf"

echo "==> Preparing directories"
mkdir -p "$CONF/live/$DOMAIN" ./certbot/www

echo "==> Creating a temporary self-signed cert so nginx can start on 443"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
  -keyout "$CONF/live/$DOMAIN/privkey.pem" \
  -out "$CONF/live/$DOMAIN/fullchain.pem" \
  -subj "/CN=localhost" >/dev/null 2>&1

echo "==> Starting nginx (web) with the temporary cert"
DOMAIN="$DOMAIN" $COMPOSE up -d --build web

echo "==> Removing temporary cert and requesting the real one from Let's Encrypt"
rm -rf "$CONF/live/$DOMAIN" "$CONF/archive/$DOMAIN" "$CONF/renewal/$DOMAIN.conf"
$COMPOSE run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "==> Reloading nginx with the real certificate"
$COMPOSE exec web nginx -s reload

echo "==> Done. https://$DOMAIN should now be live."

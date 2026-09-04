#!/bin/sh
# Serve the Link Shortener on a separate short domain, isolated from the main app
# so link abuse can't blacklist the brand/dashboard/email domain. Activates only
# when SHORT_DOMAIN is set (and its Let's Encrypt cert exists).
set -e
[ -z "$SHORT_DOMAIN" ] && exit 0
if [ ! -f "/etc/letsencrypt/live/$SHORT_DOMAIN/fullchain.pem" ]; then
  echo "shortdomain: SHORT_DOMAIN=$SHORT_DOMAIN set but no cert yet — skipping (issue it, then recreate web)."
  exit 0
fi
cat > /etc/nginx/conf.d/shortdomain.conf <<EOF
server {
    listen 80;
    server_name ${SHORT_DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    http2 on;
    server_name ${SHORT_DOMAIN};
    ssl_certificate     /etc/letsencrypt/live/${SHORT_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${SHORT_DOMAIN}/privkey.pem;
    ssl_session_cache   shared:SSL:10m;

    # Bare domain -> the main site (the short domain itself isn't a page).
    location = / { return 302 https://${DOMAIN}; }
    # Abuse reporting. Anyone who receives a malicious link finds it on THIS
    # domain, so it has to answer here — if a complainant can't reach us they
    # report the domain to the registrar, which suspends every customer's links.
    location = /report { return 302 https://${DOMAIN}/report; }
    location = /abuse  { return 302 https://${DOMAIN}/report; }
    # Bot pages the engine may send bots to (served from the same static bundle).
    location = /decoy.html        { root /usr/share/nginx/html; }
    location = /not-found.html    { root /usr/share/nginx/html; }
    location = /blocked.html      { root /usr/share/nginx/html; }
    location = /unauthorized.html { root /usr/share/nginx/html; }
    location = /favicon.ico       { root /usr/share/nginx/html; access_log off; log_not_found off; }
    # Every other path is a short-link slug: /<slug> (and legacy /l/<slug>).
    # -> the decision engine, which scores the click and routes human vs bot.
    location / {
        add_header X-Robots-Tag "noindex, nofollow" always;   # keep short links out of indexes
        set \$dec http://decision:8080; proxy_pass \$dec; include /etc/nginx/proxy.inc;
    }
}
EOF
echo "shortdomain: serving links on $SHORT_DOMAIN"

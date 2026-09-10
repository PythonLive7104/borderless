#!/bin/sh
# Serve the Link Shortener on a separate short domain, isolated from the main app
# so link abuse can't blacklist the brand/dashboard/email domain. Activates only
# when SHORT_DOMAIN is set (and its Let's Encrypt cert exists).
set -e
# SHORT_DOMAIN is the primary; SHORT_DOMAINS may list more, comma-separated.
# Each needs its own certificate — a domain without one is skipped rather than
# taking nginx down with it.
# Every domain nginx should answer for: the shared pool plus the private
# ones. Being served and being in the shared pool are different things —
# a private domain still needs a server block and a certificate.
ALL="$(echo "$SHORT_DOMAIN,$SHORT_DOMAINS,$SHORT_DOMAINS_PRIVATE" | tr ',' ' ')"
[ -z "$(echo $ALL)" ] && exit 0
: > /etc/nginx/conf.d/shortdomain.conf

for SHORT_DOMAIN in $ALL; do
[ -z "$SHORT_DOMAIN" ] && continue
if [ ! -f "/etc/letsencrypt/live/$SHORT_DOMAIN/fullchain.pem" ]; then
  echo "shortdomain: $SHORT_DOMAIN has no cert yet — skipping it (issue the cert, then recreate web)."
  continue
fi
cat >> /etc/nginx/conf.d/shortdomain.conf <<EOF
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

    # Renewal must work over HTTPS too. Behind Cloudflare's "Always Use HTTPS"
    # the ACME challenge is redirected to 443, and without this it would fall
    # through to the slug handler below and 404 — the cert would then fail to
    # renew silently, ~60 days later.
    location /.well-known/acme-challenge/ { root /var/www/certbot; }

    # Bare domain and abuse reporting are answered HERE, by a standalone page
    # that links nowhere. These used to 302 to the main domain, which handed
    # anyone investigating an abused link — and any blocklist that walks a
    # redirect chain — the connection between this domain and the brand. That
    # connection is the one thing putting short links on their own domain is
    # supposed to prevent.
    #
    # A complainant still has to reach us: a domain with no visible way to
    # report abuse gets reported to the registrar instead, and a registrar
    # suspension takes every customer's links down at once.
    location = /              { root /usr/share/nginx/html; try_files /short-report.html =404; }
    location = /report        { root /usr/share/nginx/html; try_files /short-report.html =404; }
    location = /abuse         { root /usr/share/nginx/html; try_files /short-report.html =404; }
    # The form posts here, same-origin, so nothing in the page or the network
    # tab names the main domain. Only this one endpoint is exposed.
    location = /api/v1/abuse/ {
        set \$up http://backend:8000; proxy_pass \$up; include /etc/nginx/proxy.inc;
    }
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
done

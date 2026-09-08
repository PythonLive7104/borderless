#!/bin/sh
# Regenerate deploy/cloudflare-realip.conf from Cloudflare's published ranges.
# They change rarely; run this if Cloudflare announces an update, then redeploy.
set -e
cd "$(dirname "$0")"
V4=$(curl -fsS https://www.cloudflare.com/ips-v4)
V6=$(curl -fsS https://www.cloudflare.com/ips-v6)
[ -n "$V4" ] || { echo "could not fetch v4 ranges — leaving the file alone"; exit 1; }
{
  echo "# Restore the real visitor IP when traffic arrives through Cloudflare."
  echo "# CF-Connecting-IP is trusted ONLY from the ranges below, so a request"
  echo "# straight to the origin cannot forge it."
  echo "# Generated $(date +%Y-%m-%d) by deploy/refresh-cloudflare-ips.sh"
  echo
  echo "$V4" | while read -r r; do [ -n "$r" ] && echo "set_real_ip_from $r;"; done
  echo
  echo "$V6" | while read -r r; do [ -n "$r" ] && echo "set_real_ip_from $r;"; done
  echo
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} > cloudflare-realip.conf
echo "cloudflare-realip.conf updated ($(grep -c set_real_ip_from cloudflare-realip.conf) ranges)"

proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
# Use ONLY the real TCP peer as the client IP — do NOT trust a client-supplied
# X-Forwarded-For. Appending to it ($proxy_add_x_forwarded_for) let a bot spoof
# its IP by sending its own XFF header, since the engine reads the leftmost value.
# (If a trusted proxy/CDN is ever placed in front, restore the real IP with the
# realip module FIRST, then $remote_addr is still correct here.)
proxy_set_header X-Forwarded-For   $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
# Pass a JA3 header through when an upstream/edge provides one (Cloudflare, JA3 module).
proxy_set_header CF-JA3-Hash       $http_cf_ja3_hash;

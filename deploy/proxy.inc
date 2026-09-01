proxy_http_version 1.1;
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
# Pass a JA3 header through when an upstream/edge provides one (Cloudflare, JA3 module).
proxy_set_header CF-JA3-Hash       $http_cf_ja3_hash;

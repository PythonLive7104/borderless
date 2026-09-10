# Security headers, shared by the main site and every short-link domain.
#
# NOTE ON add_header: nginx does NOT merge header sets. A location block that
# sets any add_header of its own discards every add_header inherited from the
# server block. So this file has to be included in each location that adds a
# header too — not just once at server level. Getting that wrong is silent:
# the headers simply vanish on those paths.
#
# `always` so they're sent on error responses as well, not just 2xx/3xx.

# Force HTTPS for a year. No `preload` on purpose: preloading is submitted to a
# browser-maintained list and is painful to undo if a subdomain ever needs
# plain HTTP.
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

# Don't let a browser second-guess a declared Content-Type (an uploaded file
# announced as text/plain must never be executed as script).
add_header X-Content-Type-Options "nosniff" always;

# Clickjacking: the dashboard has real actions behind a session, so it must not
# be framable by another origin.
add_header X-Frame-Options "SAMEORIGIN" always;

# Send the full URL only to ourselves; other origins get the bare origin. Short
# links carry campaign slugs, which shouldn't leak into a third party's logs.
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# CSP. 'unsafe-inline' is required for both script and style: the Tawk widget
# injects inline script at runtime, and the challenge/decoy pages the engine
# serves are self-contained with inline <style>. img-src allows any https so
# customer favicons and OG images render.
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://embed.tawk.to https://*.tawk.to; connect-src 'self' https://*.tawk.to wss://*.tawk.to; frame-src 'self' https://*.tawk.to" always;

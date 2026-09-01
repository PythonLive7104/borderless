FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git curl
COPY go.mod ./
COPY . .
# Resolve deps and generate go.sum inside the build (no local Go needed).
RUN go mod tidy && go vet ./... && go test ./... && go build -o /decision-bin .

# Bake the free DB-IP Lite country database into the image (no runtime download,
# no API key). Walk back a few months to find a published file; if none is found
# the file stays empty and the engine simply runs without real-time country.
RUN mkdir -p /geoip && : > /geoip/country.mmdb && \
    Y=$(date +%Y); M=$(date +%m); \
    for i in 0 1 2 3 4 5; do \
      MM=$(printf "%04d-%02d" "$Y" "$M"); \
      if curl -fsSL "https://download.db-ip.com/free/dbip-country-lite-$MM.mmdb.gz" -o /tmp/c.gz 2>/dev/null; then \
        gunzip -c /tmp/c.gz > /geoip/country.mmdb && echo "geoip: baked $MM" && break; \
      fi; \
      M=$((10#$M - 1)); if [ "$M" -lt 1 ]; then M=12; Y=$((Y - 1)); fi; \
    done; ls -l /geoip/country.mmdb

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /decision-bin /decision-bin
COPY --from=build /geoip/country.mmdb /geoip/country.mmdb
ENV GEOIP_DB=/geoip/country.mmdb
EXPOSE 8080
ENTRYPOINT ["/decision-bin"]

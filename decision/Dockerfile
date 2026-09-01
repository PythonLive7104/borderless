FROM golang:1.22-alpine AS build
WORKDIR /src
RUN apk add --no-cache git
COPY go.mod ./
COPY . .
# Resolve deps and generate go.sum inside the build (no local Go needed).
RUN go mod tidy && go vet ./... && go test ./... && go build -o /decision-bin .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /decision-bin /decision-bin
EXPOSE 8080
ENTRYPOINT ["/decision-bin"]

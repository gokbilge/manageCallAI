FROM golang:1.24-alpine AS builder

WORKDIR /src

COPY . .

WORKDIR /src/apps/freeswitch-agent

RUN go build -o /out/freeswitch-agent .

FROM alpine:3.22

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /out/freeswitch-agent /usr/local/bin/freeswitch-agent

CMD ["freeswitch-agent"]

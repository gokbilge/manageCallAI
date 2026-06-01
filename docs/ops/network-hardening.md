# Network Hardening Guide

Production network security checklist for manageCallAI. Work through each
section before enabling live SIP traffic.

## Minimum Production Rules

Before any production traffic:

1. ESL (8021/tcp) must not be reachable from the internet.
2. PostgreSQL (5432/tcp) must not be reachable from the internet.
3. Redis (6379/tcp) must not be reachable from the internet.
4. The manageCallAI API (3000/tcp) must be behind a reverse proxy; it must not
   receive plain-HTTP internet traffic directly.
5. Only SIP and RTP ports that are actively used should be open.
6. The FreeSWITCH ESL password must not be the default `ClueCon`.

Verify with:

```sh
pnpm check:network-config
```

## FreeSWITCH ESL Hardening

ESL (Event Socket Layer) is a full-control interface for FreeSWITCH. An
attacker with ESL access can execute arbitrary dialplan, read all call state,
and pivot into the internal network.

**Required:**

- Set `listen-ip` to `127.0.0.1` (or an internal-only subnet IP). Never `0.0.0.0`.
- Change the ESL password from `ClueCon` to a strong random value.
- Set `apply-inbound-acl` to a named ACL that covers only trusted hosts.
- Restrict ESL port at the firewall to localhost or the agent host CIDR.

Production example (`autoload_configs/event_socket.conf.xml`):

```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="listen-ip" value="127.0.0.1" />
    <param name="listen-port" value="8021" />
    <param name="password" value="CHANGE_ME_STRONG_PASSWORD" />
    <param name="apply-inbound-acl" value="loopback.auto" />
  </settings>
</configuration>
```

Set `FREESWITCH_ESL_HOST=127.0.0.1` and `FREESWITCH_ESL_PASSWORD=<strong>` in
the deployment environment. The production preflight will fail if the ESL
password is `ClueCon`. The network config check will fail if `FREESWITCH_ESL_HOST`
is `0.0.0.0`.

## PostgreSQL Hardening

- Bind PostgreSQL to the private network interface only (`listen_addresses = 'localhost'`
  or internal CIDR).
- Require certificate or password auth; disable trust auth.
- Use a dedicated database user for the API with least-privilege grants.
- Block port 5432/tcp at the firewall from all sources except the API and worker
  hosts.
- For managed databases (RDS, Cloud SQL), use VPC peering or private endpoints.

## Redis Hardening

If using `RATE_LIMIT_STORE=redis`:

- Bind Redis to the internal interface only (`bind 127.0.0.1`).
- Set a `requirepass` value; do not run Redis without a password.
- Block port 6379/tcp at the firewall.
- Use TLS (`tls-port`, `tls-cert-file`) for Redis connections crossing a network
  boundary.
- Treat `RATE_LIMIT_REDIS_URL` as a secret; include it in secret rotation.

## API Reverse Proxy

The manageCallAI API (port 3000) must not receive unauthenticated internet
traffic directly. Place it behind a reverse proxy that:

- Terminates TLS on 443/tcp.
- Enforces HTTP/S redirect from 80.
- Forwards `X-Forwarded-For` and `X-Forwarded-Proto` headers.
- Strips or normalizes the `Authorization` header in access logs.
- Applies edge-level connection limits and rate limits where possible.

Set `MANAGECALLAI_TRUST_PROXY=1` to enable Fastify's trusted proxy header
parsing (required for correct client IP detection behind a proxy).

Example nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/ssl/certs/api.example.com.pem;
    ssl_certificate_key /etc/ssl/private/api.example.com.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Strip secrets from access logs
    log_format redacted '$remote_addr "$request" $status $body_bytes_sent';
    access_log /var/log/nginx/managecallai.log redacted;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Runtime HTTP Endpoints

FreeSWITCH-facing endpoints (`/api/v1/freeswitch/*`, `/api/v1/runtime/*`) should
be on a separate internal listener or behind a private network boundary that only
FreeSWITCH nodes can reach. Options:

- Separate reverse proxy `location` block restricted to internal CIDRs.
- Private network interface with a second port.
- API gateway or service mesh policy.

See `docs/ops/runtime-edge-security.md` for the full runtime HTTP protection model.

## SIP Ports

Open only the SIP ports your deployment actually uses:

| Port | When to open |
|---|---|
| 5060/udp | Only if using plain SIP UDP profile |
| 5061/tcp | SIP TLS — recommended for production |
| 5080/tcp | Only if external SIP profile is active |
| 5080/udp | Only if external SIP profile is active |

Restrict inbound SIP to carrier IP ranges wherever available. Enable FreeSWITCH
ACLs to reject SIP from unlisted sources.

See `docs/ops/sip-tls-srtp-nat.md` for TLS and SRTP configuration.

## RTP Port Range

Open only the configured RTP port range (default 16384–32768/udp) at the
firewall. Configure this range explicitly in FreeSWITCH `vars.xml`:

```xml
<X-PRE-PROCESS cmd="set" data="rtp_start_port=16384"/>
<X-PRE-PROCESS cmd="set" data="rtp_end_port=32768"/>
```

Document the range in your deployment:

```sh
FREESWITCH_RTP_PORT_MIN=16384
FREESWITCH_RTP_PORT_MAX=32768
```

## Admin Panel Exposure

The web UI is served by the API. It should only be accessible through the
reverse proxy over HTTPS. Do not expose port 3000 directly or run the API
without TLS termination in front of it.

If the admin panel needs to be restricted further (e.g. only accessible from
corporate IPs), apply IP allowlist rules at the reverse proxy level.

## Pre-Deployment Verification

Run all network-related checks before enabling production traffic:

```sh
pnpm production:preflight      # secrets, env, token fallback, multi-instance gate
pnpm check:network-config      # ESL exposure, NAT, TLS, RTP range, proxy config
```

Both must pass with zero failures before SIP traffic is enabled.

## Related Documents

- `docs/ops/firewall-rules.md` — port-by-port firewall baseline
- `docs/ops/sip-tls-srtp-nat.md` — SIP TLS, SRTP, and NAT traversal
- `docs/ops/runtime-edge-security.md` — ESL and runtime HTTP edge policy
- `docs/ops/production-preflight.md` — preflight gate
- `docs/ops/production-deployment.md` — deployment prerequisites

# Production Deployment Guide

## Prerequisites

- PostgreSQL 17 (managed or self-hosted)
- Node.js 22 on the API/worker hosts
- Go 1.23+ on the FreeSWITCH agent host
- FreeSWITCH 1.10.x with `mod_lua`, `mod_xml_curl`, `mod_callcenter`, `mod_voicemail`
- Docker (optional; all components have Dockerfiles)

## Environment variables

Every required variable is documented in `apps/api/src/config/env.ts`. Minimum required:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | At least 32 random bytes (hex/base64). Must not be the sample value. |
| `RUNTIME_API_TOKEN` | At least 32 random bytes. Used by FreeSWITCH adapter and mod_xml_curl. |
| `RUNTIME_API_TOKEN_SECONDARY` | Optional short-lived secondary token for rolling runtime credential rotation. Leave empty unless rotating. |
| `ALLOW_RUNTIME_TOKEN_FALLBACK` | Must be `false` in production unless an explicitly isolated compatibility path is approved. |
| `SIP_SECRET_MASTER_KEY` | 64-char hex. Master key for SIP password encryption. |
| `SIP_SECRET_KEY_ID` | Label for the active key version. |
| `APP_ENV` | Set to `production`. Enables secret validation and disables token fallback. |
| `PLATFORM_OPERATOR_EMAILS` | Comma-separated list of emails that receive `platform_admin` role at login. |
| `RECORDING_STORAGE_ROOT` | Root path for recording and voicemail media. Back this up with the database. |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window. Default `60000`. |
| `RATE_LIMIT_AUTH_MAX` | Auth requests per window per client key. Default `100`. |
| `RATE_LIMIT_RUNTIME_MAX` | Runtime and FreeSWITCH requests per window per client key. Default `1200`. |
| `RATE_LIMIT_WEBHOOK_MAX` | Webhook-management requests per window per client key. Default `300`. |
| `RATE_LIMIT_OUTBOUND_MAX` | Outbound call-initiation requests per window per client key. Default `60`. |
| `RATE_LIMIT_API_MAX` | General authenticated API requests per window per client key. Default `600`. |
| `RATE_LIMIT_SCRAPE_MAX` | Scrape-sensitive unauthenticated requests per window per client key. Default `30`. |
| `RATE_LIMIT_STORE` | `memory` for single-instance, `redis` for shared multi-instance enforcement. |
| `RATE_LIMIT_REDIS_URL` | Required when `RATE_LIMIT_STORE=redis`. Treat as a secret if it contains credentials. |
| `RATE_LIMIT_REDIS_KEY_PREFIX` | Optional Redis key prefix. Default `managecallai:rate-limit`. |

The FreeSWITCH agent requires:

| Variable | Description |
|---|---|
| `API_BASE_URL` | Internal URL of the managecallai API |
| `RUNTIME_API_TOKEN` | Must match the API's token |
| `FREESWITCH_ESL_HOST` | FreeSWITCH ESL host (default 127.0.0.1) |
| `FREESWITCH_ESL_PORT` | FreeSWITCH ESL port (default 8021) |
| `FREESWITCH_ESL_PASSWORD` | Must not be `ClueCon` in production |
| `MANAGECALLAI_TENANT_ID` | Default tenant UUID for unresolvable events |

## Admin bootstrap

The first tenant and admin user are created via `POST /api/v1/auth/register`. No default
admin credentials exist. The registration endpoint is rate-limited in production.

If `PLATFORM_OPERATOR_EMAILS` includes the registering email, the JWT will carry
`role=platform_admin`. This is the recommended bootstrap path for the platform operator.

## Production preflight

Before starting production traffic, run:

```sh
pnpm production:preflight
```

This blocks known unsafe defaults such as non-production `APP_ENV`, weak JWT or
runtime secrets, malformed SIP master keys, and the stock FreeSWITCH ESL
password. Treat warnings as deployment review items before enabling live SIP
traffic. See `docs/ops/production-preflight.md`.

## Edge rate limits and TDoS controls

The API applies in-process rate limits to auth, runtime/FreeSWITCH, webhook
management, and outbound call-initiation endpoints. For FreeSWITCH nodes, the client
key includes the source IP plus a one-way hash of the runtime credential and tenant
header, so leaked logs do not expose bearer tokens.

Production deployments should still place `/api/v1/freeswitch/*` and
`/api/v1/runtime/*` behind a private network, reverse proxy, or API gateway. Enforce
TLS, allowlist FreeSWITCH node IPs, block known SIP scanner paths at the edge, and
ensure access logs redact `Authorization`, `x-managecallai-runtime-token`, and any
legacy `runtime_token` query parameter.

For multi-instance API deployments, run:

```sh
pnpm production:rate-limit-check
```

The check must pass before live traffic is enabled. It requires a shared limiter
store or edge-enforced rate limits when more than one API instance serves traffic.
See `docs/ops/rate-limit-topology.md`.

## Database migrations

Apply all migrations before starting the API:

```sh
DATABASE_URL=<url> node db/migrate.mjs
```

Migrations are idempotent and ordered by filename. Never skip migrations. Never edit
an applied migration; always write a new one.

## TLS / NAT for SIP

### TLS

For TLS SIP trunks (`transport=tls`), FreeSWITCH requires:
- `mod_sofia` compiled with TLS support
- A valid certificate chain in `/etc/freeswitch/tls/`
- `sofia.conf.xml` profile `tls-bind-params` pointing to the cert

manageCallAI passes `transport=tls` in the FreeSWITCH gateway XML. The API itself does
not terminate SIP -- TLS is negotiated between FreeSWITCH and the carrier.

### NAT traversal

For deployments behind NAT:
- Set `ext-rtp-ip` and `ext-sip-ip` in the FreeSWITCH sofia profile to the public IP.
- Alternatively, configure STUN/TURN in the sofia profile for dynamic IP discovery.
- The manageCallAI API does not manage NAT config; it only generates gateway XML.

### SRTP

Enable SRTP by adding `inbound-late-negotiation=true` and `rtp-secure-media=true` to
the FreeSWITCH sofia profile. The manageCallAI API exposes `srtp_policy` per trunk:
`disabled`, `optional`, or `required`. Treat `required` as an operational contract
that the selected FreeSWITCH profile or gateway must be SRTP-capable before traffic
is enabled.

## DTMF modes

Set `dtmf_mode` on each SIP trunk via `PATCH /api/v1/sip-trunks/:id`:

| Mode | When to use |
|---|---|
| `rfc2833` | Default. Most carriers and IP phones support this. |
| `info` | Some older carriers require SIP INFO. Use only when RFC2833 fails. |
| `inband` | Requires `mod_spandsp`. Lowest quality; last resort. |
| `auto` | FreeSWITCH negotiates. May cause interop issues. |

## Codec policy

Set `codec_prefs` on each SIP trunk as an ordered array, e.g.:
`["PCMU", "PCMA", "G729", "G722"]`

The FreeSWITCH gateway XML builder includes these as the codec preference list.
`null` means use the FreeSWITCH global codec preference.

## Backup and restore

### PostgreSQL

1. Continuous WAL archiving via `pg_basebackup` or managed service (RDS, Cloud SQL).
2. Daily logical backup: `pg_dump -Fc managecallai > backup_$(date +%Y%m%d).pgdump`
3. Test restore quarterly: `pg_restore -d managecallai_test backup.pgdump`

Critical tables: `tenants`, `users`, `extensions`, `ivr_flows`, `flow_versions`,
`automation_api_keys`, `automation_webhooks`. Do not truncate these outside of a tested
DR procedure.

### Media files (recordings, voicemail)

Media is stored at `RECORDING_STORAGE_ROOT`. Back up this directory to object storage
(S3, GCS) using rsync or a dedicated backup agent. The DB row in `call_recordings` or
`voicemail_messages` references `storage_path`; if the file is missing the DB row
becomes an orphaned reference.

## Upgrade and migration playbook

1. Take a PostgreSQL snapshot before any migration.
2. Deploy the new API version with `APP_ENV=production`.
3. Run `node db/migrate.mjs` against the database.
4. Run `pnpm db:contracts`, `pnpm db:constraints`, and `pnpm production:preflight`.
5. Verify `GET /health` returns `{ status: "ok" }`.
6. Run `pnpm production:e2e` on a runtime-capable deployment before promoting.
7. Run `pnpm production:soak` and attach the sanitized evidence to the release.
8. Run `pnpm production:slo-check -- --evidence=<file>` with runtime lookup latency evidence.
9. Run `pnpm carrier:interop-check -- --evidence=<file>` for each supported carrier profile.
10. Run `pnpm release:evidence-check -- --manifest=<file>` before final promotion.
11. Roll back: restore the snapshot and redeploy the previous API version.
   Migrations are not automatically reversible -- write a rollback migration if needed.

## SLOs for runtime lookup endpoints

| Endpoint | Target p99 | Breach threshold |
|---|---|---|
| `GET /api/v1/freeswitch/directory` | < 50ms | > 200ms for 1 min |
| `GET /api/v1/freeswitch/dialplan` | < 100ms | > 500ms for 1 min |
| `GET /health/ready` | < 20ms | > 100ms for 1 min |

These SLOs represent FreeSWITCH's real-time requirements. If the API is too slow,
FreeSWITCH falls back to its internal default dialplan, breaking routing.

Monitor via `GET /metrics` (Prometheus format). Alert when p99 breaches the threshold.
Validate release-candidate evidence with `pnpm production:slo-check -- --evidence=<file>`.

# Local Alpha Deployment

This guide is for public-alpha evaluation on a developer workstation or a
single non-production server. It is not a production deployment guide.

For production-oriented controls, see:

- `docs/ops/production-deployment.md`
- `docs/release/public-alpha-readiness.md`
- `docs/release/release-checklist.md`

## Supported Alpha Modes

### API proof

Use this mode to verify the control plane without live SIP traffic:

- PostgreSQL starts
- migrations apply
- API boots
- tenant registration/login works
- extension CRUD works
- FreeSWITCH directory XML endpoint returns expected XML
- call-event ingest/query works

Runbook:

```text
docs/development/demo-loop.md
```

### Runtime proof

Use this mode to verify the local FreeSWITCH runtime path:

- API proof passes
- FreeSWITCH starts locally
- SIP REGISTER succeeds against FreeSWITCH
- runtime lookup endpoints respond
- Go FreeSWITCH agent can ingest events where configured

Runbooks:

```text
docs/development/live-freeswitch-registration.md
docs/development/live-freeswitch-ivr-loop.md
```

## Prerequisites

- Node.js 22
- pnpm 10
- Docker Desktop or Docker Engine
- PostgreSQL through the repository compose stack or a local database
- FreeSWITCH if running the runtime proof
- Go 1.23+ if running the FreeSWITCH agent directly

## Environment

Start from `.env.example` and set strong local values for:

- `DATABASE_URL`
- `JWT_SECRET`
- `RUNTIME_API_TOKEN`
- `SIP_SECRET_MASTER_KEY`
- `SIP_SECRET_KEY_ID`
- `PLATFORM_OPERATOR_EMAILS`

For alpha evaluation, keep `APP_ENV=development` unless explicitly testing
production-mode secret validation and runtime token fallback behavior.

Never commit `.env`.

## Basic Alpha Verification

```sh
pnpm install --frozen-lockfile
pnpm db:up
pnpm db:migrate
pnpm --filter @managecallai/api dev
```

Then run the demo loop:

```text
docs/development/demo-loop.md
```

## Runtime Verification

When local FreeSWITCH runtime support is needed:

```sh
pnpm runtime:up
pnpm runtime:smoke
```

If SIP registration is not available on the host, run the smoke without SIP
registration and document that limitation in the release notes.

## Alpha Limitations

- No normal GitHub-hosted CI job currently boots full FreeSWITCH runtime.
- Production NAT, SIP TLS, SRTP, and carrier interop require operator setup.
- Visual IVR and observability surfaces may lag backend capability.
- Coverage is not uniformly at production-release targets.
- Multi-instance production rate limiting requires an external store.
- This alpha is intended for local demos, internal evaluation, and contributor
  testing.

## Clean-Clone Public Alpha Gate

Before tagging public alpha, verify on a clean machine:

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm db:up`
- [ ] `pnpm db:migrate`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `pnpm test:coverage`
- [ ] `pnpm runtime:smoke` or documented manual equivalent
- [ ] Docker images build
- [ ] README links to alpha limitations


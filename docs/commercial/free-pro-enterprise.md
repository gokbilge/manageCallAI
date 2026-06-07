# Free / Pro / Enterprise Editions

See also: [edition-entitlement-license-alignment.md](./edition-entitlement-license-alignment.md)

## Overview

manageCallAI ships in three editions, all running the same codebase. Edition
differences are enforced entirely through the `EntitlementService` layer — no
separate build artifacts, no FreeSWITCH changes.

| Edition | Target | Subscription |
|---------|--------|-------------|
| **Free** | Self-hosted evaluation, small deployments | Default; no subscription required |
| **Pro** | Growing teams and multi-site deployments | Tenant subscription record required |
| **Enterprise** | Large or regulated deployments | Contract-defined; overrides on request |

## Free

The default edition. Any tenant without an explicit subscription record is on
Free. Limits are enforced at the API layer at create time.

Key limits:
- 25 extensions, 25 devices, 2 SIP trunks, 10 DIDs
- 5 IVR flows, 2 queues, 5 ring groups
- 5,000 call events/month, 14-day retention
- 500 MB recording storage, 7-day recording retention
- 25 AI failure explanations/month
- 1 API key, 1 webhook, 1 n8n connection

## Pro

Full-featured for teams. Requires a `tenant_subscriptions` row with
`plan_name='pro'`.

Key limits:
- 250 extensions, 300 devices, 10 SIP trunks, 250 DIDs
- 50 IVR flows, 25 queues, 50 ring groups
- 500,000 call events/month, 90-day retention
- 50 GB (51,200 MB) recording storage, 30-day recording retention
- 2,500 AI failure explanations/month
- 25 API keys, 25 webhooks, 10 n8n connections

## Enterprise

No hard integer blocks by default. All capabilities carry
`string_value='contract'` and `integer_value=NULL`, meaning the platform will
not block based on count unless a specific `tenant_entitlement_overrides` row
is set. This enables bespoke negotiated limits per enterprise customer.

Requires a `tenant_subscriptions` row with `plan_name='enterprise'`.

## Upgrade Path

1. Provision a `tenant_subscriptions` row pointing to the `pro` or `enterprise`
   plan in `commercial_plans`.
2. For enterprise bespoke overrides, insert rows into
   `tenant_entitlement_overrides`.
3. No application restart is required — entitlement checks query live DB state.

No payment processing is integrated. Subscription provisioning is an
administrative operation.

## Limits Table

See [edition-capability-matrix.md](./edition-capability-matrix.md) for the
full table of all capability keys with exact limits for each edition.

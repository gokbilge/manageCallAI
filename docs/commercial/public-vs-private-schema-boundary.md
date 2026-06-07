# Public vs Private Schema Boundary

Last updated: 2026-06-07.

This document defines which database schema belongs in the public repository
and which schema must live in private commercial or enterprise modules.

## Principle

The public repository is the permanent home of the core telephony control plane
and the Free edition entitlement framework. All schema committed here becomes
Apache-2.0 open-source and cannot be clawed back. Future commercial value is
protected by keeping implementation schema, proprietary tables, and private
module code outside this repository entirely.

## What stays public

The following schema areas are permanently public:

- **tenants** and multi-tenant user/auth model
- **PBX objects** — extensions, devices, SIP trunks, DIDs, phone numbers
- **Call routing** — inbound routes, outbound routes, schedules, holiday calendars
- **IVR lifecycle** — flows, versions, validation, simulation, publish, rollback
- **Queues, call groups, voicemail boxes** — core ACD and voicemail infrastructure
- **Feature codes, parking lots, conference rooms**
- **Call events and basic audit** — ingestion, storage, retention metadata
- **FreeSWITCH integration** — directory, dialplan, registration, event ingestion
- **Entitlement foundation** — `commercial_plans`, `commercial_plan_entitlements`,
  `tenant_subscriptions`, `tenant_entitlement_overrides`, `tenant_usage_counters`,
  `usage_events` (migration 0077, already public)
- **Public module registry metadata** — module descriptors and capability keys
  that private modules may register against

## What must remain private

The following schema areas must never be committed to this repository:

| Category | Examples |
|----------|---------|
| License lifecycle | license activation, license revocation, license generator |
| Commercial agreements | customer contracts, invoice line items, subscription billing |
| Reseller/channel | reseller accounts, partner billing, channel margins |
| Identity federation | SSO connections, SAML metadata, OIDC client tables |
| Enterprise migration | migration project records, migration job queues |
| Proprietary importers | CUCM, Avaya, Alcatel, Cisco UCCX schema importers |
| Analytics/BI | compatibility scoring, migration intelligence tables |
| Enterprise audit | legal-hold tables, compliance export queues |
| HA deployment | cluster node registry, deployment instance registry |
| Carrier certification | private carrier evidence, certification test records |
| Support | support ticket tables, escalation records |
| License enforcement metadata | signing key records, activation nonces |

See `private-schema-extension-policy.md` for the exhaustive allow/deny list.

## Architecture model

```
Public repo (this repo)
  db/migrations/0001 ... 0077        Core + entitlement framework
  packages/contracts/src/commercial/ Public descriptors and interfaces

Private commercial repo
  db/migrations/commercial/...       Pro schema in managecallai_commercial schema
  src/modules/...                    Pro implementation

Private enterprise repo
  db/migrations/enterprise/...       Enterprise schema in managecallai_enterprise schema
  src/modules/...                    Enterprise implementation
```

Private repos consume the public entitlement service and module registry
interfaces. They do not modify core public tables directly; they use documented
extension columns, separate schemas, or foreign-key referencing public IDs.

## Schema namespacing

Core schema lives in the default `public` PostgreSQL schema.
Private commercial tables must use the `managecallai_commercial` schema.
Private enterprise tables must use the `managecallai_enterprise` schema.

This separation makes schema ownership unambiguous and allows private modules
to be dropped without affecting core public schema.

## Historical note on migration 0077

Migration 0077 (`0077_commercial_entitlement_foundation.sql`) is already public
Apache-2.0. It establishes the Free/Pro/Enterprise plan seed data and the
entitlement counter framework. This is the intended public boundary: the
entitlement framework is public so that community self-hosted deployments can
work with it, but the commercial implementation that sits on top of it lives in
private modules.

## Related documents

- [`private-schema-extension-policy.md`](./private-schema-extension-policy.md)
- [`private-migration-contract.md`](./private-migration-contract.md)
- [`open-core-architecture.md`](./open-core-architecture.md)
- [`entitlement-enforcement.md`](./entitlement-enforcement.md)

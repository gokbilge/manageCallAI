# SLICE-54 Backup, Restore, Upgrade, And Disaster Recovery

## Priority

P0 - production release gate

## Status

PLANNED

## Goal

Make backup, restore, upgrade, migration rollback, and disaster recovery
procedures testable release gates instead of documentation-only guidance.

## Context

PostgreSQL is the source of truth. Recordings, voicemail, prompt media, and
generated/runtime artifacts may also have storage references. A production
release must prove that operators can recover tenant desired state and media
references after failure, and that migrations can be applied safely with known
rollback boundaries.

## Depends On

- `SLICE-53-production-deployment-and-network-hardening.md`
- `SLICE-22-recorded-media-and-export-operations.md`
- `SLICE-47-recording-retention-privacy.md`

## Scope

- Create tested backup and restore runbooks for PostgreSQL and media storage.
- Define RPO/RTO targets for alpha, beta, and production profiles.
- Add a restore smoke test that loads a backup into a clean database and verifies
  tenants, users, IVR flows, published versions, routes, prompts, webhooks,
  recordings/voicemail metadata, and audit/export access.
- Define migration upgrade and rollback playbooks.
- Add migration rollback boundary docs for irreversible migrations.
- Document media orphan detection and repair procedures.
- Add release checklist entries for backup freshness, restore proof, migration
  dry run, and rollback plan.

## Acceptance Criteria

- Restore smoke test can run locally or in CI against a generated test backup.
- Upgrade playbook includes preflight, migration, verification, and rollback
  steps.
- Operators know which migrations are irreversible and what snapshot is required.
- Media references can be validated after restore.
- Release cannot be marked production-ready without restore evidence.

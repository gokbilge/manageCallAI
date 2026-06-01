# SLICE-54 Backup, Restore, Upgrade, And DR

## Priority

P0 - production recovery gate

## Status

COMPLETED

## Goal

Make recovery and upgrade safety testable instead of only documented.

## Context

Telecom control-plane state is production-critical. A release cannot be called
production-ready until operators can prove that PostgreSQL desired state,
recording references, migration history, and IVR relationships survive restore
and upgrade workflows.

## Scope

- Add `pnpm restore:smoke` to verify a restored database has required tables,
  migration history, active tenant visibility, and IVR flow-version integrity.
- Update backup/restore docs with restore smoke verification and production RTO
  and RPO expectations.
- Document upgrade sequencing: snapshot, preflight, migrate, contracts,
  constraints, restore smoke, runtime E2E, and rollback decision.
- Clarify that database dumps and environment secrets are backed up separately.
- Keep recording/voicemail media restore verification explicit.

## Acceptance Criteria

- Restore smoke fails non-zero on missing critical tables, missing migration
  history, or broken IVR version references.
- Backup/restore docs give exact commands to verify a restored deployment.
- Release checklist requires restore or restore rehearsal evidence before a
  production tag.
- Disaster recovery gaps are documented as release blockers, not hidden as
  operational assumptions.

## Dependencies

- Depends on `SLICE-53` deployment preflight.
- Supports `SLICE-52` by proving the restored deployment can run the runtime E2E
  gate after recovery.

# SLICE-59 Release Evidence Bundle

## Priority

P0 - production promotion gate

## Status

COMPLETED

## Goal

Create a single manifest gate for release-candidate evidence so production
promotion requires an auditable bundle instead of scattered links and notes.

## Context

Production readiness now has multiple gates: CI, CodeQL, coverage, Docker
images, preflight, runtime E2E, restore smoke, soak, SLO, rate-limit topology,
carrier interop, security review, rollback plan, and operator signoff. A
release manager needs one manifest that proves each gate has evidence.

## Scope

- Add `pnpm release:evidence-check`.
- Validate a JSON release evidence manifest.
- Require CI/security/coverage/runtime/restore/soak/SLO/carrier evidence.
- Require rollback plan and operator signoff fields.
- Allow optional local artifact paths and verify they exist when declared.
- Keep normal PR verification deterministic via `--check-config`.

## Acceptance Criteria

- Missing required evidence fails non-zero.
- Missing declared artifact files fail non-zero.
- Operator signoff requires name, role, and timestamp.
- Release checklist requires the manifest before production promotion.

## Dependencies

- Depends on `SLICE-52` through `SLICE-58` evidence-producing gates.
- Feeds production release approval and audit records.

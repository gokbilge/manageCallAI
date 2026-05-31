# SLICE-59 Production Release Candidate Governance

## Priority

P0 - final production release gate

## Status

PLANNED

## Goal

Define the final production release candidate process, required evidence,
approval workflow, rollback decision points, and go/no-go checklist.

## Context

By the time this slice starts, technical controls should already exist. This
slice makes production release execution repeatable: who signs off, what
evidence is required, how rollout proceeds, how rollback is triggered, and how
post-release monitoring is handled.

## Depends On

- `SLICE-52-production-runtime-e2e-gate.md`
- `SLICE-53-production-deployment-and-network-hardening.md`
- `SLICE-54-backup-restore-upgrade-dr.md`
- `SLICE-55-production-fraud-abuse-and-rate-limits.md`
- `SLICE-56-production-observability-soak-and-slos.md`
- `SLICE-57-production-tenant-isolation-and-compliance-evidence.md`
- `SLICE-58-production-sdk-mcp-n8n-release-packaging.md`

## Scope

- Create a production release candidate checklist and evidence template.
- Define required signoffs: engineering, security, telecom operations, release
  management, and product owner.
- Define release train steps: branch cut, version bump, changelog, migration dry
  run, E2E evidence, restore evidence, soak evidence, security evidence, artifact
  publication, tag, deploy, monitor, rollback window, post-release review.
- Define release-blocking severity levels.
- Define rollback decision points and communication templates.
- Define post-release monitoring window and incident escalation.
- Add GitHub issue/PR templates where helpful.

## Acceptance Criteria

- Production release candidates have a repeatable checklist.
- Required evidence from slices 52-58 is referenced directly.
- Rollback and go/no-go decisions are explicit.
- Release notes, artifacts, and deployment evidence are complete before tagging.
- The process avoids direct pushes to `main` and preserves protected-branch CI.

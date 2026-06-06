# Audit Record

Date: 2026-06-06
Scope: Issue #261 and #262

## Summary

Implemented API-owned AI lineage persistence for IVR flow versions, approval
requests, and publish records. AI-originated live changes now require a human
approval record before publish or rollback can affect active behavior.

## Checks

- Added migration `0056_ai_audit_and_approval_lineage.sql`
- Added service tests covering AI-origin approval enforcement
- Added web tests covering approval and flow-history visibility
- Added operator-context audit-log filters for `actor_id` and `actor_role`

## Findings

- Resolved: AI-originated IVR drafts were not previously distinguishable from
  manual drafts at approval time.
- Resolved: AI-agent initiated publish and rollback requests could previously
  follow the same direct-publish path as privileged human actors.
- Residual: the structured lineage is bounded metadata, not a full provider
  transcript store; deeper transcript and semantic-search work remains tracked
  in later `v0.6.x` issues.

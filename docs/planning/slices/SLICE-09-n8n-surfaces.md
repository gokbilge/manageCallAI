# SLICE-09 n8n Surfaces

## Goal

Expose safe workflow automation entry points over the same desired-state IVR lifecycle.

## Status

**CLOSED** — 2026-05-28 (shipped inside the SLICE-09 automation commit `8f9004f`)

- ✓ `mcak_` API keys — create, list, revoke at `POST/GET/DELETE /api/v1/automation/keys`
- ✓ API key auth wired into `requireCapability` alongside JWT — n8n authenticates with a Bearer `mcak_` token
- ✓ All IVR lifecycle endpoints (`/ivr-flows`, validate, simulate, publish) reachable via API key with `tenant_admin` claims
- ✓ Approval policy enforced — API key cannot bypass the human-approval gate
- ✓ Event delivery — `ivr_flow.published`, `ivr_flow.publish_pending`, `ivr_flow.rollback_completed`, `approval.approved`, `approval.rejected` fired to registered webhooks
- ✓ `docs/automation/n8n-guide.md` — step-by-step n8n credential setup, 5-step IVR lifecycle workflow, webhook registration, HMAC verification

## Scope

- draft creation/update webhooks or REST wrappers
- validate and simulate triggers
- publish-request trigger
- event emission for approval and publish outcomes
- example n8n flows

## Depends On

- `SLICE-02`
- `SLICE-04`

## Parallel With

- `SLICE-08`
- `SLICE-10`

## Unblocks

- release-level automation story

## Exit Criteria

- n8n can create drafts, validate, simulate, and request publish
- n8n cannot bypass approval policy or runtime boundaries

## Out Of Scope

- real-time IVR execution inside n8n
- custom n8n node package unless needed later

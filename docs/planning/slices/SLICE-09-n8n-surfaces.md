# SLICE-09 n8n Surfaces

## Goal

Expose safe workflow automation entry points over the same desired-state IVR lifecycle.

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

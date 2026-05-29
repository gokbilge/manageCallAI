# SLICE-18 Outbound Routing and Trunk Policy

## Goal

Add a safe desired-state model for outbound routing, trunk selection, and basic
fraud-control policy.

## Status

**PLANNED**

## Scope

- outbound route resources
- dial rule and prefix matching
- trunk selection and failover policy
- basic outbound guardrails such as rate caps or policy blocks
- API and UI surfaces for safe operator control

## Depends On

- `SLICE-03`
- `SLICE-06`
- `SLICE-11`

## Parallel With

- `SLICE-19`

## Unblocks

- click-to-call and supervised outbound features
- policy-aware carrier control
- later call supervision work

## Exit Criteria

- outbound routes exist as tenant-scoped desired state
- outbound trunk policy is validated before production use
- no raw FreeSWITCH dialplan editing or raw ESL control is exposed publicly

## Out Of Scope

- full campaign dialer
- compliance integrations unless explicitly scoped

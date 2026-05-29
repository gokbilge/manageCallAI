# SLICE-29 Outbound Call Execution Hardening

## Goal

Turn outbound call requests into a release-ready click-to-call workflow with clear
runtime execution, status updates, and operator visibility.

## Status

**PLANNED**

## Context

SLICE-23 introduced outbound call requests, route resolution, and runtime polling. The
next release feature is to harden the actual execution loop so operators can initiate
an outbound call and track whether FreeSWITCH dispatched, failed, or completed it.

## Scope

- Verify and harden FreeSWITCH agent execution of pending outbound call requests.
- Add status transitions for pending, dispatched, answered, completed, failed, and
  expired where runtime data supports them.
- Add idempotent claim/dispatch behavior so requests are not double-dialed.
- Add operator UI for creating and viewing outbound call requests.
- Add bounded tenant/operator permissions for outbound call creation.
- Add audit events for outbound call request creation and terminal state changes.
- Add tests for route resolution, claim safety, status updates, and tenant isolation.

## Depends On

- `SLICE-18`
- `SLICE-23`
- `SLICE-26`

## Parallel With

- `SLICE-28`
- `SLICE-30`

## Unblocks

- click-to-call release workflow
- outbound operator demos
- future supervision features

## Exit Criteria

- operator can create an outbound call request from the UI or API
- FreeSWITCH agent can claim and dispatch the request once
- API exposes current request status and terminal failure reason when available
- runtime smoke automation covers the outbound polling/dispatch path

## Out Of Scope

- predictive or bulk dialing
- call supervision controls such as barge, whisper, or monitor
- DNCL/CNAM integrations
- advanced fraud analytics

# SLICE-52 Production Runtime E2E Gate

## Priority

P0 - production release gate

## Status

PLANNED

## Goal

Make the full telecom runtime loop a required release gate before any production
tag: API, PostgreSQL, FreeSWITCH, Lua helpers, Go ESL agent, runtime callbacks,
event ingestion, and observability must work together in a production-like test
environment.

## Context

Golden XML tests and API-only E2E tests are necessary but not sufficient for a
production telecom control plane. Production readiness requires evidence that
stock FreeSWITCH can consume API-generated desired state and that runtime events
return to the control plane without leaking secrets or crossing tenant
boundaries.

This slice builds on `SLICE-50`; it turns smoke automation into a production
release gate with versioned evidence, artifacts, and failure diagnostics.

## Depends On

- `SLICE-50-self-hosted-freeswitch-smoke-ci.md`
- `SLICE-51-release-grade-product-coverage-and-runbooks.md`
- `SLICE-26-live-runtime-smoke-automation.md`

## Scope

- Add a production-release E2E workflow that runs on a self-hosted or dedicated
  runtime test runner.
- Boot PostgreSQL, API, worker where applicable, FreeSWITCH, Lua helpers, and
  Go FreeSWITCH agent.
- Provision a tenant, extension, SIP trunk or test gateway, phone number,
  prompt, IVR flow, and inbound route.
- Validate, simulate, publish, resolve dialplan, start runtime IVR session,
  advance DTMF, ingest call events, query timeline/observability, rollback IVR,
  and verify runtime resolver uses the rolled-back version.
- Capture runtime versions, git SHA, test tenant IDs, flow/version IDs, and
  sanitized logs as release artifacts.
- Fail closed on any missing runtime callback, stale published state, tenant
  leakage, or secret appearing in logs.

## Acceptance Criteria

- Production release checklist requires this gate.
- The E2E workflow produces a concise pass/fail release evidence artifact.
- Failure output is specific enough to diagnose directory, dialplan, SIP
  registration, IVR callback, event ingestion, observability, or rollback issues.
- Runtime tokens, SIP passwords, JWTs, webhook secrets, and recording paths are
  redacted from artifacts.
- The workflow is documented for both CI and manual release-candidate execution.

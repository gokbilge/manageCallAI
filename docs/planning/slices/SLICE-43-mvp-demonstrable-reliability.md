# SLICE-43 MVP Demonstrable Reliability

## Priority

P1 - MVP critical

## Status

**PARTIALLY IMPLEMENTED**

Audited 2026-05-30. CI and local scripts include telecom safety gates, MCP contract
checks, IVR simulation regression, XML golden-file coverage, Docker build checks,
and a local FreeSWITCH profile smoke script. The SDK package has generated-client
coverage. Remaining work is a one-command FreeSWITCH E2E proof, publish/rollback
runtime smoke coverage, broader SDK-backed API flows, importable n8n workflow JSON
examples, and visual IVR publish/diff/rollback completion.

## Goal

Make the MVP demonstrably reliable by proving the runtime, publish lifecycle,
generated contracts, XML rendering, automation examples, and visual IVR workflow
with repeatable tests and operator-facing validation.

This slice is the release-confidence lane. It should be completed before broad
production-readiness work, because it proves that the current MVP behavior is
stable enough to harden.

## Depends On

- `SLICE-08-visual-builder.md`
- `SLICE-26-live-runtime-smoke-automation.md`
- `SLICE-35-bpmn-inspired-ivr-graph-model.md`
- `SLICE-36-visual-ivr-execution-engine.md`
- `SLICE-39-ci-telecom-safety-gates.md`

## Scope

### FreeSWITCH runtime E2E test profile

- Add a documented FreeSWITCH E2E profile for local and self-hosted CI use.
- Boot API, PostgreSQL, worker, FreeSWITCH, Lua runtime helpers, and
  `freeswitch-agent` with deterministic test credentials.
- Prove directory lookup, inbound route lookup, IVR runtime callback, ESL event
  ingestion, and graceful failure behavior.
- Keep this outside standard hosted CI unless a self-hosted runner with SIP/media
  support is available.

### Route publish and rollback smoke tests

- Add smoke coverage for publish -> runtime lookup -> rollback -> runtime lookup.
- Prove FreeSWITCH consumes the currently active version after rollback.
- Include both direct inbound route targets and IVR targets.

### OpenAPI-generated SDK usage in tests

- Add web/API tests that call the API through the generated SDK instead of hand-built
  fetch payloads for representative flows.
- Cover login, extension creation, IVR draft creation, validation, simulation,
  publish request, and runtime read paths.
- Fail CI when generated SDK types drift from API behavior.

### XML golden tests

- Expand deterministic FreeSWITCH XML golden tests to cover:
  - extension directory XML
  - inbound IVR dialplan XML
  - queue target XML
  - call-group target XML
  - voicemail target XML
- Keep golden expectations small and focused on security-sensitive application
  arguments, escaped values, runtime URLs, and target selection.

### n8n example workflows

- Add importable workflow examples for:
  - missed call
  - voicemail received
  - IVR publish failed
  - route rollback
  - recording transcribed
- Each example must use API-key auth, webhook signature verification, idempotent
  event handling, and no raw secrets in exported JSON.

### Visual IVR builder completion

- Finish the React visual IVR builder workflow over the shared IVR schema.
- Enforce the node support matrix in UI controls and backend validation.
- Add validation and simulation UI with branch coverage feedback.
- Add publish diff preview and clear rollback affordance.
- Provide empty, invalid, simulated, pending approval, published, and rollback
  states.

## Validation

- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm generate:openapi`
- SDK generation drift check
- XML golden-file tests
- FreeSWITCH E2E smoke on a local or self-hosted runtime profile
- Browser/UI test for the visual IVR validation and simulation path

## Acceptance Criteria

- A maintainer can run one documented command to prove the MVP runtime path against
  a local FreeSWITCH stack.
- Publish and rollback smoke tests prove the active runtime version changes as
  expected.
- At least one representative web/API test path uses the generated SDK.
- XML golden tests cover extension, IVR, queue, call group, and voicemail output.
- n8n examples are importable and documented.
- The visual IVR builder can create, validate, simulate, diff, request publish, and
  show rollback state for a supported flow.

## Out Of Scope

- Hosted carrier certification.
- Full load testing.
- Production fraud policy enforcement.
- OpenTelemetry tracing and long-term observability storage.
- Official packaged n8n community node.

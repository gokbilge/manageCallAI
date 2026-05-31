# SLICE-51 Release-Grade Product Surfaces, Coverage, And Runbooks

## Priority

P1 - beta and production readiness

## Status

PLANNED

## Goal

Move the product from developer-focused alpha to beta readiness by hardening the
operator UI, test coverage, SDK/MCP/n8n docs, and production runbooks.

## Context

The backend domains are broad and CI is mature, but release confidence depends
on workflows operators actually use: visual IVR authoring, live observability,
automation safety, SDK usability, deployment, backup/restore, and upgrade
procedures.

## Scope

- Make the visual IVR builder usable for the primary authoring workflow.
- Make the observability HUD usable for live operations triage.
- Add tenant isolation matrix tests across major domains.
- Add runtime actor boundary tests.
- Expand API, Web, MCP, SDK, and Go agent coverage toward beta/production gates.
- Verify MCP setup and capability matrix docs.
- Verify n8n example workflows from docs alone.
- Add or update single-server deployment, backup/restore, and upgrade runbooks.
- Add release-grade gap report with follow-up issue titles.

## Acceptance Criteria

- Core operator workflows are covered by behavior tests.
- UI does not fake backend safety decisions.
- Tenant isolation and runtime actor boundaries are tested.
- MCP/n8n docs can be followed without reading source code.
- Deployment, backup/restore, and upgrade docs are actionable.
- Coverage does not decrease in any package.
- Remaining production gaps are tracked as explicit follow-up issues.

## Suggested Claude Prompt

```text
You are a senior product engineer, test architect, telecom operations designer,
and release-readiness reviewer.

Repository:
https://github.com/gokbilge/manageCallAI

Task:
Complete SLICE-51: Release-Grade Product Surfaces, Coverage, And Runbooks.

Goals:
- Make the operator-facing product credible for beta.
- Raise meaningful coverage on critical telecom control paths.
- Make MCP, n8n, SDK, deployment, backup/restore, and upgrade docs usable from
  docs alone.

Required work:
1. Audit visual IVR builder and observability HUD workflows.
2. Add behavior tests for:
   - visual IVR create/edit/validate/simulate/request-publish
   - observability summary, active calls, timeline, alerts, runtime health
   - auth/role-aware navigation
   - automation API keys and webhook delivery/DLQ states
3. Add API integration tests for:
   - tenant isolation matrix across major domains
   - runtime actor cannot use normal tenant CRUD
   - IVR publish/rollback failure behavior
   - webhook signing/replay/idempotency
4. Add MCP and SDK tests for safety, errors, idempotency, and representative
   endpoint behavior.
5. Add Go agent tests for ESL parsing, delivery retries, heartbeat/reconnect,
   and redaction.
6. Verify or update docs for:
   - MCP setup and capability matrix
   - n8n workflows
   - single-server deployment
   - backup/restore
   - upgrade/migration rollback
7. Run:
   - pnpm test
   - pnpm test:coverage
   - pnpm build
   - pnpm lint
   - cd apps/freeswitch-agent && go test ./... -cover

Acceptance criteria:
- Coverage does not decrease in any package.
- Critical live-call-impacting paths have meaningful tests.
- Operator workflows have release-grade empty/loading/error states.
- Docs are executable by a new evaluator.
- Remaining gaps are listed with risk and follow-up issue titles.
```


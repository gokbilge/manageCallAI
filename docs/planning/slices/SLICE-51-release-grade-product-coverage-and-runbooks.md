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

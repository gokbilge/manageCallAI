# Audit - architecture boundary review - 2026-05-31

**Commit:** current working tree
**Scope:** Architecture boundaries across API, web, MCP, n8n, Go agent, Lua,
contracts, PostgreSQL, and FreeSWITCH runtime integration.
**Result:** PASS

## Findings

No open findings.

## Drift Risks Identified

- API drift: lifecycle and validation logic can move into SQL, route handlers,
  runtime callbacks, or generated XML.
- Web drift: operator screens can expose raw FreeSWITCH concepts instead of
  business objects and lifecycle operations.
- MCP drift: AI tools can grow toward REST parity or raw runtime control.
- n8n drift: workflow templates can call runtime-internal endpoints or pass
  arbitrary provider/runtime payloads.
- Go agent drift: the adapter can become a second control plane if it owns
  tenant policy, lifecycle, or IVR graph traversal.
- Lua drift: in-switch helpers can accumulate business logic or graph traversal.
- Contract drift: REST, SDK, MCP, OpenAPI, and examples can diverge from Zod
  schemas.
- DB drift: PostgreSQL can become a passive cache for runtime state rather than
  the canonical desired-state store.

## Actions Taken

- Added ADRs for Zod contracts, MCP/workflow boundaries, runtime auth,
  publishable lifecycle, Lua executor limits, and IVR graph ownership.
- Added runtime boundary, publishable lifecycle, contributor checklist, and drift
  risk architecture documents.
- Linked the new documents from the ADR index and architecture overview.

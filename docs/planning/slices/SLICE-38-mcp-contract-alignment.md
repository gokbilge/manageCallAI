# SLICE-38 MCP Contract Alignment

## Status

**IMPLEMENTED**

## Goal

Eliminate drift between MCP tool schemas, REST contracts, and IVR graph validation by
making MCP inputs derive from the same contract source as the API.

## Canonical MCP server

**`apps/mcp`** is the canonical MCP server. It:
- Uses an API key (`MANAGECALL_API_KEY`) via env var — no JWT token in tool inputSchemas.
- Is organized into per-domain tool modules (`tools/ivr-flows.ts`, `tools/approvals.ts`, etc.).
- Has vitest tests for every tool handler.
- Has a `bin` entry and is the recommended Claude Desktop / n8n MCP integration target.

**`apps/mcp-server`** is a legacy prototype:
- Required `access_token` as an argument in every tool call (security anti-pattern).
- Has fewer tools and no vitest tests.
- Is retained for the `managecallai-mcp-server` Docker image but should not receive new tool additions.
- New tools should be added to `apps/mcp` only.

## What changed

1. **Canonical node types** — `IVR_NODE_TYPES` and `IvrNodeType` added to
   `packages/contracts/src/schemas/ivr-flows.ts`. The API validator
   (`apps/api/src/modules/ivr-flows/ivr-flow.validation.ts`) now imports from contracts
   instead of duplicating the list. Any addition to the supported node types must go to
   the contracts package first.

2. **`simulate_flow` inputSchema expanded** — `apps/mcp/src/tools/ivr-flows.ts`
   `simulate_flow` now exposes all fields from `SimulationScenarioSchema`:
   `digits`, `collected_digits`, `caller_number`, `now`, `force_timeout`,
   `force_timeout_nodes`, `force_invalid`, `force_invalid_nodes`, `variables`.

3. **Contract drift test** — `apps/mcp/src/tools/contract-drift.test.ts` enforces:
   - `IVR_NODE_TYPES` includes all expected types.
   - `simulate_flow` inputSchema properties cover all `SimulationScenarioSchema` keys.
   - `simulate_flow` does not mark optional contract fields as required.
   - `request_publish` requires `flow_id` and `version_id`.

4. **`@managecallai/contracts` dependency** added to `apps/mcp/package.json`.

## Out Of Scope

- New MCP tool categories.
- Direct FreeSWITCH or runtime command tools.
- Relaxing IVR validation rules for agent convenience.

## Acceptance Criteria (met)

- MCP IVR tools no longer duplicate node type lists — they reference `IVR_NODE_TYPES`.
- MCP drift tests fail when a shared contract changes without updating the tool adapter.
- Documentation identifies the canonical MCP server and the contract generation path.

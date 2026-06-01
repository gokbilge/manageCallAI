# MCP Capability Matrix

This document describes every tool exposed by the canonical MCP server
(`apps/mcp`), its required API key capability, risk category, and what it
can and cannot do.

## Authentication

Every MCP tool uses the `MANAGECALL_API_KEY` environment variable set in the
MCP server configuration. The key must have the capabilities listed for each
tool. See `docs/development/release-runbook.md` for setup instructions.

## Risk Categories

| Category | Meaning |
|---|---|
| `read` | Read-only. No state mutation. |
| `low` | Creates or updates non-published draft state. Reversible. |
| `medium` | Triggers validation or simulation. No persistent side effects. |
| `high` | Requests publication, rollback, or approval decision. Irreversible without additional action. |

## IVR Flow Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `list_ivr_flows` | `tenant.ivr_flows.view` | `read` | Returns all IVR flows for the tenant. |
| `get_ivr_flow` | `tenant.ivr_flows.view` | `read` | Returns one flow with all versions. |
| `explain_ivr_flow` | `tenant.ivr_flows.view` | `read` | Human-readable summary of draft graph. Does not mutate state. |
| `create_ivr_flow` | `tenant.ivr_flows.create` | `low` | Creates a new flow with a draft version. |
| `update_ivr_flow` | `tenant.ivr_flows.update` | `low` | Updates flow metadata (name, description). |
| `create_ivr_flow_version` | `tenant.ivr_flows.update` | `low` | Appends a new draft version to an existing flow. |
| `update_ivr_flow_version` | `tenant.ivr_flows.update` | `low` | Replaces the graph_json of a draft version. |
| `add_ivr_node` | `tenant.ivr_flows.update` | `low` | Appends a node to the draft version's graph. |
| `connect_ivr_nodes` | `tenant.ivr_flows.update` | `low` | Sets `next_node_id` on a source node. |
| `validate_ivr_flow` | `tenant.ivr_flows.validate` | `medium` | Runs structural validation on the current draft. |
| `simulate_ivr_flow` | `tenant.ivr_flows.simulate` | `medium` | Simulates a call scenario through the draft graph. |
| `request_publish` | `tenant.ivr_flows.publish` | `high` | Requests publication of a validated version. May return `pending_approval` if tenant policy requires human review. |

## Approval Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `list_approvals` | `tenant.approvals.view` | `read` | Lists pending approval requests. |
| `get_approval` | `tenant.approvals.view` | `read` | Returns one approval request. |
| `approve_request` | `tenant.approvals.decide` | `high` | Approves a pending publish/rollback request. |
| `reject_request` | `tenant.approvals.decide` | `high` | Rejects a pending publish/rollback request. |

## Prompt Asset Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `list_prompts` | `tenant.prompts.view` | `read` | Lists prompt assets. |
| `get_prompt` | `tenant.prompts.view` | `read` | Returns one prompt asset. |
| `create_prompt` | `tenant.prompts.create` | `low` | Creates a prompt asset (metadata only; upload is separate). |
| `update_prompt` | `tenant.prompts.update` | `low` | Updates prompt asset metadata. |

## Runtime Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `get_runtime_health` | `platform.runtime.view` or `tenant.dashboard.view` | `read` | Returns ESL connection status, session counts, and queue depths. |
| `list_runtime_sessions` | `tenant.ivr_flows.view` | `read` | Lists active IVR runtime sessions. |
| `get_runtime_session` | `tenant.ivr_flows.view` | `read` | Returns one runtime session with step history. |

## Schedule Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `list_schedules` | `tenant.schedules.view` | `read` | Lists schedules. |
| `create_schedule` | `tenant.schedules.create` | `low` | Creates a new schedule. |
| `update_schedule` | `tenant.schedules.update` | `low` | Updates a schedule. |

## Recording Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `list_recordings` | `tenant.recordings.view` | `read` | Lists call recordings. |
| `get_recording` | `tenant.recordings.view` | `read` | Returns one recording metadata record. |
| `request_transcription` | `tenant.recordings.view` | `low` | Creates a transcription/analysis request. |

## Export Tools

| Tool | Required Capability | Risk | Description |
|---|---|---|---|
| `export_tenant_data` | `tenant.export.run` | `medium` | Triggers a tenant data export job. |

## What MCP Cannot Do

The MCP server is intentionally narrower than the REST API.

| Prohibited action | Why |
|---|---|
| Direct FreeSWITCH ESL commands | Bypasses the desired-state safety layer |
| Raw XML dialplan edits | Circumvents validation and simulation |
| Shell or process execution | Arbitrary code execution risk |
| Runtime call control (transfer, hold, drop) without a high-risk tool | Uncontrolled live call impact |
| Access to signing secrets, SIP passwords, or JWT secrets | Credentials must never appear in LLM context |
| Tenant admin user management | Privilege escalation risk |

These invariants are tested in `apps/mcp/src/tool-registry.safety.test.ts`.

## Error Handling

All MCP tools return `{ text, isError }`. When `isError` is true, `text`
contains a human-readable error description safe to show to an AI agent.

Common errors:

| Error | Cause | Suggested action |
|---|---|---|
| `401 Unauthorized` | API key missing, revoked, or capability not granted | Check `MANAGECALL_API_KEY` and key capabilities |
| `403 Forbidden` | Capability not in key's capability list | Update the API key capabilities |
| `409 Conflict` | Version not validated before publish | Call validate first |
| `422 Validation failed` | IVR graph has structural errors | Call explain_ivr_flow and fix the graph |
| `202 pending_approval` | Tenant policy requires human approval | Monitor the approvals queue |

## Recommended API Key Capabilities for AI Agents

A minimal AI agent working on IVR authoring needs:

```text
tenant.ivr_flows.view
tenant.ivr_flows.create
tenant.ivr_flows.update
tenant.ivr_flows.validate
tenant.ivr_flows.simulate
tenant.ivr_flows.publish
tenant.approvals.view
tenant.prompts.view
tenant.schedules.view
tenant.recordings.view
```

Add `tenant.approvals.decide` only if the agent is explicitly trusted to make
approval decisions without human review.

Do not grant `*` (wildcard) to AI agents. Wildcard keys grant the full
`tenant_admin` capability set, which includes user management, webhook
management, and deactivation operations that should require a human decision.

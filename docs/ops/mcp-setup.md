# MCP Server Setup Guide

The manageCallAI MCP server (`apps/mcp`) exposes an AI-agent interface for managing IVR flows, extensions, schedules, calls, and more via the Model Context Protocol.

---

## Prerequisites

- A running manageCallAI API stack
- A tenant API key with the capabilities you intend to use
- Node.js 22+
- An MCP-compatible client (e.g. Claude Code, Claude Desktop)

---

## Installation

```sh
# From the repo root
pnpm install
pnpm build

# Or globally from the built package
node apps/mcp/dist/index.js
```

The MCP server communicates over **stdio**. Configure your MCP client to launch it as a subprocess.

---

## Claude Code / Claude Desktop Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "managecallai": {
      "command": "node",
      "args": ["/path/to/manageCallAI/apps/mcp/dist/index.js"],
      "env": {
        "MANAGECALLAI_API_BASE": "https://your-api.example.com",
        "MANAGECALLAI_API_KEY": "mca_live_..."
      }
    }
  }
}
```

---

## Required Environment Variables

| Variable | Description |
|---|---|
| `MANAGECALLAI_API_BASE` | Base URL of the manageCallAI API (no trailing slash) |
| `MANAGECALLAI_API_KEY` | API key for authentication |

---

## Capability Requirements by Tool Category

The API key must have the capabilities listed below for each tool category you intend to use.

| Tool category | Required capability |
|---|---|
| IVR Flows — read | `tenant.ivr_flows.view` |
| IVR Flows — create/update | `tenant.ivr_flows.create`, `tenant.ivr_flows.update` |
| IVR Flows — validate | `tenant.ivr_flows.validate` |
| IVR Flows — simulate | `tenant.ivr_flows.simulate` |
| IVR Flows — publish | `tenant.ivr_flows.publish` |
| IVR Flows — rollback | `tenant.ivr_flows.rollback` |
| Approvals — read | `tenant.approvals.view` |
| Approvals — decide | `tenant.approvals.decide` |
| Runtime sessions | `tenant.dashboard.view` |
| Schedules — read | `tenant.schedules.view` |
| Schedules — create | `tenant.schedules.create` |
| Recordings | `tenant.recordings.view` |
| Exports | `tenant.export.run` |

**Capability gating**: The MCP server cannot publish or rollback IVR flows unless the API key explicitly carries `tenant.ivr_flows.publish` or `tenant.ivr_flows.rollback`. This prevents unauthorized automated flow changes.

---

## Available Tools (22 total — verified by `pnpm beta:mcp-smoke`)

### IVR Flows (8 tools)
- `list_ivr_flows` — list all flows for the tenant
- `get_ivr_flow` — get flow details and current version
- `create_ivr_flow` — create a new draft flow
- `update_flow_definition` — update nodes and edges on a draft version
- `validate_flow` — run validation without publishing
- `simulate_flow` — simulate a call path through the flow
- `request_publish` — submit a validated flow for publish (may require approval)
- `run_simulation_suite` — run multiple scenarios in one call

### Approvals (3 tools)
- `list_approvals` — list pending approval requests
- `get_approval` — get approval details
- `decide_approval` — approve or reject a request

### Prompt Assets (2 tools)
- `list_prompts` — list prompt assets for the tenant
- `get_prompt` — get prompt asset details

### Runtime Sessions (2 tools)
- `list_sessions` — list IVR sessions (active and recent)
- `get_session` — get session details and step replay

### Schedules (1 tool)
- `list_schedules` — list time-based routing schedules

### Recordings (4 tools)
- `list_recordings` — list call recordings
- `get_recording` — get recording metadata
- `list_recording_analyses` — list analysis results for a recording
- `get_recording_analysis` — get transcript/summary analysis result

### Exports (2 tools)
- `export_call_events` — export call event records for the tenant
- `export_sessions` — export IVR session records for the tenant

---

## Security Constraints

- **No raw ESL/XML/shell surface**: MCP tools do not expose FreeSWITCH-internal commands. All operations go through the REST API.
- **No runtime secrets**: The MCP server never returns signing secrets, SIP passwords, or encryption keys.
- **Tenant isolation**: all MCP tool calls are scoped to the API key's tenant. Cross-tenant access is not possible.
- **Capability gating enforced server-side**: Even if you call a publish tool, the API will reject it if the key lacks the capability.

---

## Verifying MCP Schema Drift

```sh
pnpm check:mcp-schemas
```

This confirms MCP tool schemas match the contracts package. Run after any schema change.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Invalid or expired API key | Generate a new API key |
| `403 Forbidden` | Missing capability on API key | Add the required capability |
| Tool returns empty list | Wrong `MANAGECALLAI_API_BASE` | Check the URL includes `/api/v1` if your server requires it |
| Schema drift detected | MCP schemas out of sync | Run `pnpm check:mcp-schemas` and regenerate if needed |

---

## Related

- `apps/mcp/` — MCP server source
- `docs/architecture/source-of-truth.md` — architectural constraints on MCP
- `pnpm check:mcp-schemas` — CI schema drift check

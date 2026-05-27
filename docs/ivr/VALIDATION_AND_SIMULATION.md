# Validation And Simulation

## 1. Purpose

Validation and simulation are the core safety layer for IVR programmability.

Humans, n8n, and future MCP tools must not be able to push unvalidated call
logic directly into production.

## 2. Validation

Validation must check:

- graph has one entry
- all nodes are reachable or explicitly allowed as detached draft nodes
- all references are valid
- all prompts exist and are active
- all extension targets exist and are active
- switch cases are unique
- timeout / invalid fallback exists where needed
- retry values are bounded
- no unsupported node types are used for the current runtime slice
- publish is blocked if validation fails

## 3. Simulation

Simulation should support:

- DTMF sequence input
- node-specific collected digits for multi-step menus
- timeout path
- invalid input path
- selected time
- caller number
- explicit simulation variables
- expected path output
- final action output

Example simulation request:

```json
{
  "digits": ["2"],
  "caller_number": "+905551112233",
  "now": "2026-05-27T10:00:00+03:00"
}
```

Example simulation response:

```json
{
  "status": "passed",
  "path": ["start", "welcome", "route_digit", "support"],
  "final_action": {
    "type": "transfer_extension",
    "extension_number": "201"
  }
}
```

## 4. Why simulation matters

- AI and workflow automation need deterministic preview before publish
- structural validation alone does not prove the intended path
- telecom production changes must be explainable before activation

Simulation is required for AI/MCP/n8n safety. It is not a replacement for live
runtime testing.

## 5. Audit

If simulation is used as part of a publish decision, the simulation input and
result should be persisted or at least referenced from the publish audit trail.

## 6. Current implementation status

Current slice now includes:

- structural validation endpoint
- simulation endpoints for current draft and specific versions
- persisted simulation results in `simulation_results`
- `simulated_at` stamping on successful runs
- approval-gated publish / rollback behavior driven by tenant policy
- `switch` resolution from `{{last_digits}}`, `{{caller_number}}`, `{{now.hour}}`, and scenario variables
- node-specific `collected_digits` plus per-node timeout/invalid forcing for multi-step simulations

Still intentionally out of scope:

- prompt existence checks during validation
- extension existence checks during validation
- business-hours, queue, ring-group, webhook, or AI-action node execution
- live runtime call testing through FreeSWITCH

# n8n And MCP Programmability

## 1. n8n

n8n should interact with IVR through safe REST interfaces.

n8n responsibilities:

- create drafts
- update prompts, routes, and flows
- trigger validation and simulation
- request publish
- react to events such as missed call, flow publish requested, or rollback completed

n8n must not be the real-time IVR runtime engine.

## 2. MCP

MCP should expose safe AI tools over the same desired-state lifecycle.

Safe future MCP tools:

- `list_ivr_flows`
- `get_ivr_flow`
- `create_ivr_flow_draft`
- `add_ivr_node`
- `connect_ivr_nodes`
- `validate_ivr_flow`
- `simulate_ivr_flow`
- `request_publish_ivr_flow`
- `explain_ivr_flow`

MCP must not expose:

- `raw_esl_command`
- `update_xml`
- `reload_freeswitch`
- `execute_lua`

## 3. Shared safety lifecycle

```text
draft → validate → simulate → approval/policy → publish → audit → rollback
```

Humans, n8n, and MCP all operate inside the same lifecycle.

## 4. Event names

Future event names:

- `ivr.flow_draft_created`
- `ivr.validation_failed`
- `ivr.publish_requested`
- `ivr.published`
- `ivr.rollback_completed`
- `call.ivr_entered`
- `call.ivr_completed`
- `call.ivr_failed`

## 5. Principle

n8n and MCP are allowed to program desired state, not live switch internals.

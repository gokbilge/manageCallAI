# Flow Schema

## 1. Scope

This document defines the initial IVR flow graph schema for `manageCallAI`.

The graph is tenant-scoped, versioned, and intended to be validated and
simulated before publish.

## 2. Core Concepts

- `ivr_flow`
- `flow_version`
- `graph_json`
- BPMN-inspired execution category
- `entry_node_id`
- `nodes`
- `edges`
- `node types`
- `node config`
- `version status`

## 3. Resource Model

### ivr_flow

Represents the stable business object:

- identity
- display metadata
- active version pointer
- draft version pointer
- lifecycle status

### flow_version

Represents one immutable graph snapshot once published.

- version number
- graph payload
- validation status
- publish timestamp

## 3.1 External And Internal Field Mapping

To avoid confusion, the IVR graph currently has two names depending on layer:

- External API field: `graph_json`
- Internal database column: `flow_versions.definition`

Current mapping rule:

- controllers and DTOs expose `graph_json`
- the repository stores the payload in `definition`
- repository queries map `definition AS graph_json` when returning version data

This means:

- API clients should send and read `graph_json`
- database readers will still see `definition` in the underlying table
- `definition` may still appear as a temporary compatibility alias in some endpoints during the transition to the fully normalized external `graph_json` contract

## 4. Graph Shape

```json
{
  "entry_node_id": "start",
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "next_node_id": "welcome"
    },
    {
      "id": "welcome",
      "type": "play_collect",
      "prompt_id": "welcome_tr",
      "max_digits": 1,
      "timeout_ms": 5000,
      "retries": 2,
      "next_node_id": "route_digit",
      "timeout_node_id": "timeout",
      "invalid_node_id": "invalid"
    },
    {
      "id": "route_digit",
      "type": "switch",
      "input": "{{last_digits}}",
      "cases": {
        "1": "sales",
        "2": "support",
        "0": "operator"
      },
      "default_node_id": "invalid"
    },
    {
      "id": "sales",
      "type": "transfer_extension",
      "extension_id": "ext_sales_001"
    },
    {
      "id": "timeout",
      "type": "hangup"
    },
    {
      "id": "invalid",
      "type": "hangup"
    }
  ]
}
```

## 4.1 BPMN-Inspired Execution Subset

The IVR graph should follow BPMN principles without becoming a full BPMN 2.0
runtime. `graph_json` remains the canonical API and persistence format.

Supported concepts:

| BPMN-inspired concept | IVR graph meaning |
|-----------------------|-------------------|
| Start event | `start` node / `entry_node_id` |
| Task | Action node such as `play_prompt`, `play_collect`, `transfer_extension`, `queue`, or `voicemail_drop` |
| Exclusive gateway | Branching node such as `switch`, `business_hours`, or `caller_id_match` |
| End event | Terminal `hangup`, transfer, queue, or voicemail completion |
| Sequence flow | Explicit edge or node reference from one node to the next |

Unsupported BPMN features:

- pools and lanes
- parallel gateways and concurrent branches
- compensation events
- human tasks
- raw BPMN XML as the runtime source of truth
- arbitrary message events that bypass managed webhook/provider contracts

This subset gives the visual builder, simulator, and runtime resolver a common
state-machine vocabulary while keeping call execution constrained.

## 5. MVP Node Types

Implemented / foundational:

1. `start`
2. `play_prompt`
3. `play_collect`
4. `switch`
5. `transfer_extension`
6. `hangup`
7. `business_hours`
8. `caller_id_match`
9. `set_variable`
10. `queue`
11. `voicemail_drop`

## 6. Future Node Types

Documented but not implemented in this slice:

- `ring_group`
- `webhook`
- `http_lookup`
- `ai_action`
- `language_select`
- `transfer_external`
- `sub_flow`

## 7. Node Expectations

### start

- exactly one graph entry target
- usually only `next_node_id`

### play_prompt

- requires `prompt_id` or a runtime-resolvable prompt reference
- usually requires `next_node_id`

### play_collect

- requires prompt reference
- requires `max_digits`
- requires `timeout_ms`
- may define `retries`
- may define `timeout_node_id`
- may define `invalid_node_id`

### switch

- resolves input and branches by `cases`
- may define `default_node_id`
- MVP simulation can currently resolve:
  - `{{last_digits}}`
  - `{{caller_number}}`
  - `{{now.hour}}`
  - `{{var.<name>}}`

### business_hours

- requires `schedule_id`
- requires `in_hours_node_id`
- requires `out_of_hours_node_id`

### caller_id_match

- requires at least one case mapping in `cases`
- supports exact caller-number matching with `default_node_id`

### set_variable

- requires `variable_name`
- requires `value`
- requires `next_node_id`

### queue

- requires `queue_id`
- terminal transfer-style node

### voicemail_drop

- requires `voicemail_box_id`
- terminal voicemail-style node

### transfer_extension

- requires `extension_id`

### hangup

- terminal node

## 8. Rules

- one entry node
- node IDs unique
- all referenced nodes must exist
- every edge must have a deterministic source, target, and branch meaning
- prompts must exist for prompt nodes
- extension targets must exist and be active
- unsafe or unreachable graphs are invalid unless explicitly allowed as detached draft nodes
- published versions are immutable
- unsupported BPMN constructs must be rejected or ignored only as non-runtime UI metadata

## 9. Version Status

Recommended status vocabulary:

- `draft`
- `validated`
- `published`
- `archived`

Existing implementation may temporarily carry additional lifecycle values while
the broader publish infrastructure converges.

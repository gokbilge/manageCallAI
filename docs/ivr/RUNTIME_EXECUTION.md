# Runtime Execution

## 1. Runtime options

Possible runtime models:

A. Lua thin helper asks `manageCallAI` API for next action  
B. External Go or Node runtime agent controls through ESL  
C. Hybrid

## 2. Recommended starting point

Start with a thin Lua helper plus backend runtime resolver.

```text
Inbound DID route
  ↓
FreeSWITCH dialplan
  ↓
manageCallAI IVR entry
  ↓
Lua helper starts flow session
  ↓
backend returns next action
  ↓
Lua executes action
  ↓
Lua reports result
  ↓
backend resolves next action
```

## 3. Runtime actions

Example `play_collect`:

```json
{
  "action": "play_collect",
  "prompt_uri": "/sounds/tenants/acme/welcome_tr.wav",
  "max_digits": 1,
  "timeout_ms": 5000,
  "retries": 2
}
```

Example transfer:

```json
{
  "action": "transfer",
  "target_type": "extension",
  "target": "200"
}
```

Example queue transfer:

```json
{
  "action": "transfer",
  "target_type": "queue",
  "members": [
    {
      "extension_number": "200"
    },
    {
      "extension_number": "201"
    }
  ]
}
```

Example voicemail:

```json
{
  "action": "voicemail",
  "mailbox_number": "8003",
  "greeting_prompt_uri": "/sounds/tenants/acme/after_hours.wav"
}
```

Example hangup:

```json
{
  "action": "hangup"
}
```

## 4. Runtime session rules

- every call has a stable `call_id`
- every session carries `tenant_id`
- every call pins the published flow version active at call entry
- active flow changes do not mutate an already-running call
- runtime events are correlated back to the pinned version

## 5. Safety boundary

Raw FreeSWITCH commands remain hidden.

FreeSWITCH executes only a constrained action surface such as:

- play prompt
- collect digits
- transfer
- hangup

Anything more complex stays in the backend resolver.

The backend resolver should evaluate the BPMN-inspired IVR graph semantics before
emitting one constrained action. FreeSWITCH and Lua never receive raw BPMN XML,
raw graph JSON, or UI-only edge metadata.

## 6. Implemented MVP runtime resolver contract

Current backend runtime endpoints:

```text
POST /api/v1/runtime/ivr/sessions
POST /api/v1/runtime/ivr/sessions/:sessionId/advance
```

Both endpoints are runtime-internal and require:

```text
Authorization: Bearer <RUNTIME_API_TOKEN>
```

Session start request:

```json
{
  "call_id": "call-123",
  "flow_id": "11111111-1111-1111-1111-111111111111",
  "caller_number": "+905551112233",
  "destination_number": "+902122223344",
  "variables": {
    "customer_tier": "vip"
  }
}
```

Advance request example for `play_collect`:

```json
{
  "node_id": "menu",
  "outcome": "digits",
  "digits": "2"
}
```

Current runtime rules:

- session start pins the flow's current published version
- `start` and `switch` nodes are resolved inside the backend
- runtime receives only constrained actions
- `play_prompt` and `play_collect` require an active prompt with `storage_uri`
- `transfer_extension` resolves to an active extension in the same tenant
- `set_variable` mutates only session-scoped variables and never FreeSWITCH internals
- `queue` resolves to an active queue with extension members
- `voicemail_drop` resolves to an active voicemail box and optional greeting prompt
- `transfer`, `voicemail`, and `hangup` complete the session after the runtime reports completion

## 7. Future evolution

- stronger session state persistence
- richer runtime actions
- hybrid Go/ESL assist for more advanced scenarios
- deeper queue strategies and agent-state awareness
- richer voicemail lifecycle and media retrieval
- shared execution planner used by validation, simulation, runtime resolution, and
  visual path highlighting

## 8. Implemented FreeSWITCH loop

The current stock-FreeSWITCH loop now works like this:

```text
Inbound DID
  ↓
inbound_route.lua
  ↓
GET /api/v1/freeswitch/route-lookup
  ↓
target_type = flow
  ↓
managecall_entry.lua
  ↓
POST /api/v1/runtime/ivr/sessions
  ↓
execute constrained action
  ↓
POST /api/v1/runtime/ivr/sessions/:sessionId/advance
  ↓
repeat until transfer or hangup
```

Current live runtime guarantees:

- inbound DID routes can target published IVR flows
- FreeSWITCH does not execute raw backend-authored dialplan logic
- Lua remains a thin executor over backend-decided actions
- each call pins a runtime session and published flow version

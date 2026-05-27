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

## 6. Future evolution

- stronger session state persistence
- richer runtime actions
- hybrid Go/ESL assist for more advanced scenarios
- queue and voicemail execution after the foundational IVR runtime proves stable

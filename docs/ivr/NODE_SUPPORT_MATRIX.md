# IVR Node Support Matrix

This document is the canonical reference for which node types are supported at
each layer of the IVR stack. Any new node type must be added to **all four
columns** before it can be considered production-ready.

## Support Layers

| Layer | Component | Role |
|-------|-----------|------|
| **Validator** | `ivr-flow.validation.ts` | Structural correctness check before publish |
| **Simulator** | `ivr-flow.service.ts` `simulateGraph()` | Deterministic dry-run against scenario inputs |
| **Runtime** | `ivr-runtime.service.ts` | Live call execution — resolves nodes to actions |
| **Lua** | `managecall_entry.lua` | FreeSWITCH executor — carries out runtime actions |

## Node Matrix

| Node type | Validator | Simulator | Runtime | Lua executor | Notes |
|-----------|:---------:|:---------:|:-------:|:------------:|-------|
| `start` | ✓ | ✓ | ✓ pass-through | — | Entry point only; no action emitted |
| `play_prompt` | ✓ | ✓ pass-through | ✓ → `play_prompt` action | ✓ `streamFile()` | |
| `play_collect` | ✓ | ✓ branches on scenario | ✓ → `play_collect` action | ✓ `playAndGetDigits()` | |
| `switch` | ✓ | ✓ resolves `{{tokens}}` | ✓ pass-through | — | Resolved server-side |
| `transfer_extension` | ✓ | ✓ terminal | ✓ → `transfer/extension` action | ✓ `bridge()` | |
| `hangup` | ✓ | ✓ terminal | ✓ → `hangup` action | ✓ `hangup()` | |
| `business_hours` | ✓ | ✓ uses `scenario.now` | ✓ pass-through, reads schedule | — | Resolved server-side |
| `caller_id_match` | ✓ | ✓ checks `caller_number` | ✓ pass-through | — | Resolved server-side |
| `set_variable` | ✓ | ✓ pass-through | ✓ pass-through | — | Updates session vars server-side |
| `queue` | ✓ | ✓ terminal | ✓ → `transfer/queue` action | ✓ `bridge()` multi-endpoint | |
| `voicemail_drop` | ✓ | ✓ terminal | ✓ → `voicemail` action | ✓ `voicemail` app | |

**Legend:** ✓ = implemented, — = not applicable (node is a server-side pass-through)

## Switch Token Support

The `switch` node resolves its `input` expression at all layers:

| Token | Simulator | Runtime |
|-------|:---------:|:-------:|
| `{{last_digits}}` | ✓ | ✓ |
| `{{caller_number}}` | ✓ | ✓ |
| `{{now.hour}}` | ✓ via `scenario.now` | ✓ via `new Date()` |
| `{{var.<name>}}` | ✓ | ✓ |
| literal string | ✓ | ✓ |

## Runtime Action Shape

The runtime service emits these action shapes to the Lua helper:

```json
// play_prompt
{ "action": "play_prompt", "node_id": "...", "prompt_id": "...", "prompt_uri": "..." }

// play_collect
{ "action": "play_collect", "node_id": "...", "prompt_id": "...", "prompt_uri": "...",
  "max_digits": 1, "timeout_ms": 5000, "retries": 0 }

// transfer → extension
{ "action": "transfer", "node_id": "...", "target_type": "extension",
  "target": "<extension_number>", "domain": "<directory_domain>" }

// transfer → queue
{ "action": "transfer", "node_id": "...", "target_type": "queue",
  "strategy": "simultaneous|sequential", "ring_timeout_seconds": 30,
  "members": [{ "extension_number": "...", "domain": "..." }] }

// voicemail
{ "action": "voicemail", "node_id": "...", "mailbox_number": "...",
  "domain": "...", "greeting_prompt_uri": "..." }

// hangup
{ "action": "hangup", "node_id": "..." }
```

## Planned / Future Node Types

Not yet implemented at any layer:

| Node type | Notes |
|-----------|-------|
| `ring_group` | Multi-extension ring with per-member timeout |
| `webhook` | HTTP callback during call |
| `http_lookup` | Lookup external data to inject variables |
| `ai_action` | IVR AI turn integration |
| `language_select` | Set language for subsequent prompt resolution |
| `transfer_external` | PSTN transfer to an external number |
| `sub_flow` | Embed another published flow |

## Implementation Checklist for New Node Types

Before a node type is considered production-ready:

- [ ] Added to `SUPPORTED_NODE_TYPES` in `ivr-flow.validation.ts`
- [ ] Field validation added to `validateIvrGraph()` for required node fields
- [ ] Simulation path added to `simulateGraph()` in `ivr-flow.service.ts`
- [ ] Runtime resolution added to `resolveNextAction()` in `ivr-runtime.service.ts`
- [ ] Action type handled in `execute_runtime_action()` in `managecall_entry.lua`
- [ ] This matrix updated
- [ ] `docs/ivr/FLOW_SCHEMA.md` updated

## Known Issues

None currently. The simulator contains legacy alias branches (`play`, `menu`,
`condition`, `transfer`) that cannot be reached because the validator runs
first and rejects those type strings. These were removed in the consistency
hardening pass — see `ivr-flow.service.ts` git history.

# Source-System Capability Matrix

This matrix is the conservative migration baseline for `v0.8.0`.
It should be read with:

- [`managecallai-target-capability-model.md`](managecallai-target-capability-model.md)
- [`import-support-levels.md`](import-support-levels.md)

Status legend:

- `Exact`
- `Equivalent`
- `Approximate`
- `Manual review`
- `Unsupported`
- `Unknown`

The matrix is intentionally conservative. `Unknown` is preferable to claiming
support without validated source semantics.

## Core PBX Capabilities

| Capability | FreePBX | Asterisk raw config | FusionPBX | Cisco CUCM | Avaya Aura | Alcatel OmniPCX | Mitel | Generic CSV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Users | Equivalent | Approximate | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Manual review |
| Extensions | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| SIP trunks | Exact | Equivalent | Exact | Equivalent | Equivalent | Approximate | Equivalent | Equivalent |
| DIDs | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Inbound routes | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Outbound routes | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| IVRs | Exact | Equivalent | Exact | Approximate | Approximate | Approximate | Approximate | Manual review |
| Hunt / ring groups | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Approximate |
| Queues | Exact | Equivalent | Exact | Approximate | Equivalent | Approximate | Equivalent | Approximate |
| Voicemail | Exact | Approximate | Equivalent | Manual review | Equivalent | Equivalent | Equivalent | Manual review |
| Feature codes | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Call parking | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Conferencing | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Music on hold | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Announcements | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| CDR / history | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |

## Enterprise PBX Capabilities

| Capability | FreePBX | Asterisk raw config | FusionPBX | Cisco CUCM | Avaya Aura | Alcatel OmniPCX | Mitel | Generic CSV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Devices | Equivalent | Approximate | Equivalent | Exact | Equivalent | Approximate | Equivalent | Manual review |
| Line appearances | Approximate | Unsupported | Approximate | Exact | Approximate | Approximate | Approximate | Unsupported |
| Trunk groups / route lists | Equivalent | Approximate | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Manual review |
| Numbering plans | Equivalent | Approximate | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Manual review |
| Calling policy / class of service | Approximate | Approximate | Approximate | Approximate | Equivalent | Equivalent | Equivalent | Unsupported |
| Schedules | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Holidays and temporary closures | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Pickup groups | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Paging / intercom | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |

## End-User Capabilities

| Capability | FreePBX | Asterisk raw config | FusionPBX | Cisco CUCM | Avaya Aura | Alcatel OmniPCX | Mitel | Generic CSV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User-extension ownership | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Device assignment workflows | Equivalent | Approximate | Equivalent | Exact | Equivalent | Approximate | Equivalent | Manual review |
| Self-service forwarding / DND posture | Approximate | Manual review | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Registration and credential ownership | Approximate | Manual review | Approximate | Equivalent | Equivalent | Approximate | Equivalent | Unsupported |

## Contact-Center Capabilities

| Capability | FreePBX | Asterisk raw config | FusionPBX | Cisco CUCM | Avaya Aura | Alcatel OmniPCX | Mitel | Generic CSV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Agent profiles and availability | Approximate | Approximate | Approximate | Manual review | Manual review | Unknown | Manual review | Unsupported |
| Skill-based routing | Approximate | Approximate | Approximate | Manual review | Manual review | Unknown | Manual review | Unsupported |
| Queue supervision / QA workflows | Unsupported | Unsupported | Unsupported | Manual review | Manual review | Unknown | Manual review | Unsupported |

## Emergency And Migration-Risk Capabilities

| Capability | FreePBX | Asterisk raw config | FusionPBX | Cisco CUCM | Avaya Aura | Alcatel OmniPCX | Mitel | Generic CSV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Emergency routing defaults | Approximate | Approximate | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Emergency site / location context | Approximate | Approximate | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Custom dialplan / scripts | Manual review | Manual review | Manual review | Unsupported | Manual review | Manual review | Manual review | Unsupported |
| Vendor-specific endpoint behavior | Manual review | Unsupported | Manual review | Manual review | Manual review | Manual review | Manual review | Unsupported |
| Hotel / PMS workflows | Unsupported | Unsupported | Unsupported | Manual review | Manual review | Manual review | Manual review | Unsupported |
| Operator console / attendant features | Unsupported | Unsupported | Unsupported | Manual review | Manual review | Manual review | Manual review | Unsupported |

## Interpretation Notes

- `FreePBX` and `FusionPBX` are the best first adapter candidates because their
  exports are inspectable and their features align more closely with
  manageCallAI's current control-plane vocabulary.
- `Cisco CUCM` and `Avaya Aura` expose richer enterprise abstractions, but they
  also introduce higher line-appearance, policy, and endpoint-model risk.
- `Alcatel OmniPCX` and `Mitel` should stay conservative until source research
  is documented in later mapping work. `Mitel` remains matrix-only for now.
- `Generic CSV` can support inventory bootstrapping, but not behaviorally safe
  migration without substantial manual review and missing-data evidence.
- `Manual review`, `Unsupported`, and `Unknown` outcomes must feed operator
  review items, not importer shortcuts or silent fallback behavior.

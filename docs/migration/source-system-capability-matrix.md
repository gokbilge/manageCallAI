# Source-System Capability Matrix

Status legend:

- `Exact`
- `Equivalent`
- `Approximate`
- `Manual review`
- `Unsupported`
- `Unknown`

The matrix is intentionally conservative. `Unknown` is preferable to claiming
support without validated source semantics.

| Capability | FreePBX | Asterisk raw config | FusionPBX | Cisco CUCM | Avaya Aura | Alcatel OmniPCX | Mitel | Generic CSV |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Users | Equivalent | Approximate | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Manual review |
| Extensions | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Devices | Equivalent | Approximate | Equivalent | Exact | Equivalent | Approximate | Equivalent | Manual review |
| Line appearances | Approximate | Unsupported | Approximate | Exact | Approximate | Approximate | Approximate | Unsupported |
| SIP trunks | Exact | Equivalent | Exact | Equivalent | Equivalent | Approximate | Equivalent | Equivalent |
| Trunk groups | Equivalent | Approximate | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Manual review |
| DIDs | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Inbound routes | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Outbound routes | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Numbering plans | Equivalent | Approximate | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Manual review |
| Calling policy / class of service | Approximate | Approximate | Approximate | Approximate | Equivalent | Equivalent | Equivalent | Unsupported |
| IVRs | Exact | Equivalent | Exact | Approximate | Approximate | Approximate | Approximate | Manual review |
| Hunt / ring groups | Exact | Equivalent | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Approximate |
| Queues | Exact | Equivalent | Exact | Approximate | Equivalent | Approximate | Equivalent | Approximate |
| Schedules | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Holidays | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Voicemail | Exact | Approximate | Equivalent | Manual review | Equivalent | Equivalent | Equivalent | Manual review |
| Feature codes | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Call parking | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Conferencing | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Pickup groups | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Paging / intercom | Equivalent | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Music on hold | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Announcements | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Manual review |
| Emergency routing | Approximate | Approximate | Approximate | Equivalent | Equivalent | Equivalent | Equivalent | Unsupported |
| Call recording | Equivalent | Approximate | Equivalent | Manual review | Equivalent | Equivalent | Equivalent | Manual review |
| CDR / history | Exact | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent | Equivalent |
| Contact-center features | Approximate | Approximate | Approximate | Manual review | Manual review | Unknown | Manual review | Unsupported |
| Custom dialplan / scripts | Manual review | Manual review | Manual review | Unsupported | Manual review | Manual review | Manual review | Unsupported |
| Hotel / PMS | Unsupported | Unsupported | Unsupported | Manual review | Manual review | Manual review | Manual review | Unsupported |
| Operator console | Unsupported | Unsupported | Unsupported | Manual review | Manual review | Manual review | Manual review | Unsupported |

## Interpretation Notes

- `FreePBX` and `FusionPBX` are the best first adapter candidates because their
  exports are inspectable and their features align more closely with
  manageCallAI's current control-plane vocabulary.
- `Cisco CUCM` and `Avaya Aura` expose richer enterprise abstractions, but they
  also introduce higher policy and endpoint-model risk.
- `Alcatel OmniPCX` and `Mitel` should stay conservative until source research
  is documented in the source mapping set.
- `Generic CSV` can support inventory bootstrapping, but not behaviorally safe
  migration without substantial manual review.

# FreePBX / Asterisk Migration Map

## Source access methods

- FreePBX database export
- FreePBX backup archive
- Asterisk configuration files
- read-only discovery script output

## High-confidence imports

- users and extensions with stable numbering
- SIP trunks and gateways
- DIDs
- inbound routes
- outbound routes without custom dialplan overrides
- ring groups / call groups
- basic queues
- IVRs using supported destinations
- voicemail boxes
- feature codes
- parking lots
- conferencing inventory

## Equivalent/approximate imports

- time conditions -> schedule groups and overrides
- route permissions -> calling policy
- custom destinations that resolve to supported targets
- module-specific route chaining that can be represented as draft IVR or route logic

## Manual-review imports

- AGI scripts
- macros
- custom dialplan includes
- DISA
- fax flows
- unusual third-party modules
- source destinations that collapse multiple runtime behaviors

## Unsupported imports

- raw dialplan execution as live target behavior
- custom AGI/macros as executable manageCallAI logic
- source modules without a bounded target model

## Source concepts and manageCallAI mappings

| Source concept | Target mapping |
| --- | --- |
| Extension | Extension, user, device assignment |
| Trunk | SIP trunk |
| Outbound route | Outbound route + numbering/calling policy |
| Inbound route | Inbound route |
| Ring group | Call group |
| Queue | Queue |
| Time condition | Schedule group / override |
| IVR | IVR flow |
| Parking | Parking lot |
| Conference | Conference room |

## Target manageCallAI capabilities required

- numbering and calling policy
- site and location model for branch-aware imports
- schedule groups and overrides
- user/extension/device separation
- validation and simulation depth

## Security considerations

- discovery and parsing must remain read-only
- SIP passwords must be redacted or reissued, not surfaced back to operators in cleartext
- custom scripts must never be executed by the importer

## Data handling and secret handling

- preserve source object IDs and hashes
- redact or omit credential secrets in exported snapshots
- store only metadata needed for operator reconciliation

## Validation and simulation requirements

- route conflict checks
- emergency number overlap checks
- calling-policy review for restricted patterns
- simulation for inbound and outbound route outcomes

## Cutover considerations

- import trunks as disabled drafts first
- validate internal calling before DID cutover
- migrate DIDs in stages
- keep a staged smoke checklist for inbound, outbound, voicemail, and queue flows

## Rollback considerations

- preserve source snapshot and hash
- keep draft publish boundaries explicit
- define DID and trunk rollback order before cutover

## Open questions

- which FreePBX module exports should be treated as unsupported by default
- whether some custom destination patterns can be normalized safely into IVR or route drafts

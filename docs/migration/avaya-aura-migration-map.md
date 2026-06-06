# Avaya Aura Migration Map

## Source access methods

- station and user exports
- trunk and route-pattern reports
- vector and VDN documentation exports
- COR/COS and ARS configuration exports

## High-confidence imports

- users
- extensions
- basic trunks
- DID inventory
- hunt groups
- core route inventory

## Equivalent/approximate imports

- COR/COS -> calling policy
- ARS -> numbering plus outbound route policy
- VDNs -> inbound routes or IVR entry points
- basic vectors -> IVR or routing drafts where behavior is bounded

## Manual-review imports

- vectors with adjunct or external database logic
- coverage paths with unsupported destination semantics
- advanced contact-center dependencies
- custom announcements and treatment combinations

## Unsupported imports

- executable vectors as live code
- external adjunct logic without explicit target services

## Source concepts and manageCallAI mappings

| Source concept | Target mapping |
| --- | --- |
| Station | Device plus extension assignment |
| User | User |
| Hunt group | Call group or queue |
| VDN | Inbound route / IVR entry |
| Vector | IVR or route draft, if behavior is supported |
| COR / COS | Calling policy |
| ARS | Numbering and outbound route policy |
| Coverage path | Review item or call-forwarding approximation |

## Target manageCallAI capabilities required

- calling policy
- user/extension/device separation
- schedule and IVR depth
- validation and simulation with explanation

## Security considerations

- source exports can expose endpoint and user inventory at scale
- external adjunct references must never be executed or assumed equivalent

## Data handling and secret handling

- preserve source object references and hashes
- treat adjunct and vector snippets as review metadata only

## Validation and simulation requirements

- review emergency and ARS mappings carefully
- simulate primary inbound, outbound, and coverage-path outcomes

## Cutover considerations

- migrate users and extensions before complex vectors
- isolate contact-center and adjunct-dependent flows from the first migration wave

## Rollback considerations

- keep cutover grouped by business unit or site
- document how VDN and vector rollback decisions are made

## Open questions

- which vector shapes can be normalized safely into bounded IVR drafts
- how much coverage-path behavior should remain manual review

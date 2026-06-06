# Alcatel OmniPCX Migration Map

## Source access methods

- inventory exports
- numbering and barring reports
- trunk and group reports
- operator and hospitality configuration extracts

## High-confidence imports

- users
- extensions
- basic trunks
- DID inventory
- numbering inventory

## Equivalent/approximate imports

- barring categories -> calling policy
- groups -> call groups
- site defaults -> site/location topology

## Manual-review imports

- operator and attendant workflows
- proprietary phone capabilities
- hospitality and hotel/PMS behavior
- analog and digital endpoint nuances

## Unsupported imports

- hotel/PMS automation as live imported behavior
- proprietary console behavior without an explicit target model

## Source concepts and manageCallAI mappings

| Source concept | Target mapping |
| --- | --- |
| User | User |
| Extension | Extension |
| Group | Call group |
| Trunk | SIP trunk or carrier object |
| Numbering plan | Numbering plan |
| Barring category | Calling policy |
| Site defaults | Site/location defaults |

## Target manageCallAI capabilities required

- numbering and calling policy
- site/location model
- user/extension/device separation
- explicit deferral register for hospitality and console gaps

## Security considerations

- hospitality and operator exports may contain sensitive room and attendant data
- unsupported proprietary behaviors must remain review-only

## Data handling and secret handling

- preserve export references and hashes
- do not attempt to persist or reuse endpoint secrets blindly

## Validation and simulation requirements

- review numbering and barring mappings carefully
- verify emergency and outbound restriction behavior

## Cutover considerations

- isolate hotel/PMS and operator-console flows from core PBX cutover
- validate branch/site defaults before DID migration

## Rollback considerations

- preserve explicit rollback ordering for main operator and hospitality numbers
- do not claim full parity where proprietary endpoint behavior remains manual

## Open questions

- how much hospitality behavior can be represented without a dedicated target model
- whether some operator workflows belong in a later enterprise-vertical lane

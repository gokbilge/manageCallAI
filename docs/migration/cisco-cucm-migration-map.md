# Cisco CUCM Migration Map

## Source access methods

- AXL API
- BAT exports
- CSV exports
- route-plan reports
- device and user inventory exports

## High-confidence imports

- users
- directory numbers as extensions
- devices and device ownership metadata
- SIP trunks
- route lists
- line appearances where the target foundation exists

## Equivalent/approximate imports

- route patterns -> numbering plus outbound/inbound routes
- partitions/CSS -> numbering plus calling policy approximations
- device pools -> site/location defaults where semantics align
- hunt pilots and line groups -> call groups or queue structures

## Manual-review imports

- complex CSS behavior
- transformation patterns
- proprietary phone templates
- Unity voicemail dependencies
- advanced survivability and cluster-specific constructs

## Unsupported imports

- executable CUCM behavior outside explicit target abstractions
- blind reuse of device credentials or proprietary phone templates

## Source concepts and manageCallAI mappings

| Source concept | Target mapping |
| --- | --- |
| End user | User |
| Directory number | Extension |
| Device | Device |
| Line appearance | Line appearance |
| Route pattern | Numbering plan rule + route |
| Partition / CSS | Calling policy plus numbering segmentation |
| Route list / route group | Route list / trunk group |
| Hunt pilot / line group | Call group or queue |
| Device pool | Site/location defaults |

## Target manageCallAI capabilities required

- user/extension/device separation
- line appearance model
- numbering and calling policy depth
- site/location defaults
- trunk groups and route lists

## Security considerations

- source credentials and certificates must not be persisted casually
- imported device metadata can expose sensitive endpoint inventory
- cluster exports may include capabilities not valid for one tenant/site design

## Data handling and secret handling

- retain AXL/BAT source references and hashes
- redact secrets
- force credential reset or reprovision rather than silent reuse

## Validation and simulation requirements

- review CSS/partition approximations explicitly
- simulate route outcomes for critical emergency and outbound flows
- verify line appearance assignments and device ownership

## Cutover considerations

- stage user, extension, and device imports before carrier/DID cutover
- validate representative device classes and shared-line behaviors
- treat voicemail and Unity dependencies as explicit review items

## Rollback considerations

- maintain source reports and export hashes
- keep publish boundaries per site or device cohort
- define emergency and main-number rollback before device reprovisioning

## Open questions

- how much CSS behavior can be expressed safely without over-claiming parity
- which proprietary endpoint behaviors should remain permanently manual-review-only

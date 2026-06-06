# Import Support Levels

This taxonomy classifies each discovered source object and defines importer,
UI, and evidence behavior.

## Level A - Exact support

Definition:

- The source object maps directly to an existing manageCallAI capability with no
  behavior loss expected.

Examples:

- FreePBX extension -> manageCallAI extension
- FreePBX DID -> manageCallAI phone number

Importer behavior:

- Create normalized snapshot entry and eligible draft target object
- Preserve source reference and confidence metadata

UI behavior:

- Show as safe draft candidate
- Minimal warning copy

Evidence requirement:

- Source reference
- Snapshot hash
- Created draft object reference

## Level B - Equivalent support

Definition:

- The target model differs structurally, but operator-visible behavior can be
  preserved with a bounded mapping.

Examples:

- Ring group -> call group
- Basic route list -> trunk group / route list

Importer behavior:

- Create draft mapping with rationale
- Include conversion note

UI behavior:

- Show as draft candidate with "behavior preserved through equivalent model"

Evidence requirement:

- Conversion rationale
- Validation result
- Simulation proof where routing semantics matter

## Level C - Approximate support

Definition:

- The target model can represent the core behavior, but some source semantics
  are flattened or require operator adjustment.

Examples:

- Cisco partition/CSS translated into numbering plus calling policy
- Simple schedule hierarchy flattened into schedule group plus override

Importer behavior:

- Draft object may be created, but it must carry warnings and review-required
  notes

UI behavior:

- Highlight approximation
- Require explicit acknowledgement before publish eligibility

Evidence requirement:

- Approximation warning
- Operator acknowledgement
- Validation and simulation results

## Level D - Manual review required

Definition:

- The source object can be detected and described, but it cannot be converted
  safely without operator interpretation.

Examples:

- Asterisk AGI script
- Avaya vector with external database dip
- Cisco complex transformation pattern

Importer behavior:

- Never generate runnable live logic
- Create review item only, with source references and explanation

UI behavior:

- Show blocking review state
- Prevent publish claims that imply parity

Evidence requirement:

- Source excerpt or source reference
- Review decision
- Resolution notes

## Level E - Unsupported

Definition:

- No current manageCallAI target model exists for this capability.

Examples:

- Hotel/PMS workflows
- Proprietary operator-console behavior
- Vendor-specific digital endpoint templates

Importer behavior:

- Record unsupported item only
- Never create draft executable behavior

UI behavior:

- Show as unsupported
- Recommend deferral or manual redesign

Evidence requirement:

- Unsupported classification
- Operator acknowledgement if migration proceeds without parity

## Level U - Unknown / source-specific research required

Definition:

- The source capability or export shape is not yet documented well enough to
  classify safely.

Examples:

- Vendor-specific endpoint fields not yet analyzed
- Incomplete CSV inventory with ambiguous semantics

Importer behavior:

- Block automatic conversion
- Produce research-needed finding

UI behavior:

- Show as unknown
- Recommend source-system investigation

Evidence requirement:

- Research-needed note
- Missing-data explanation

## Shared Rules

- Levels `C`, `D`, `E`, and `U` must never be hidden from the operator.
- Levels `D`, `E`, and `U` must never auto-publish or generate runnable source
  logic.
- Any source object that affects emergency routing, outbound permissions, or
  carrier selection should require validation and simulation evidence even when
  classified `A` or `B`.

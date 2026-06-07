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
- Mark the object publish-eligible only after normal validation and simulation

UI behavior:

- Show as safe draft candidate
- Minimal warning copy
- Show target object reference and any validation follow-ups inline

Evidence requirement:

- Source reference
- Snapshot hash
- Created draft object reference
- Validation record when the object affects routing or emergency behavior

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
- Preserve the source-to-target relationship explicitly in the compatibility report

UI behavior:

- Show as draft candidate with "behavior preserved through equivalent model"
- Explain which target object shape differs from the source model

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
- Require operator acknowledgement before the draft can be promoted toward publish

UI behavior:

- Highlight approximation
- Require explicit acknowledgement before publish eligibility
- Keep the approximation reason visible in list and detail views

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
- Block any publish claim that depends on the unresolved review item

UI behavior:

- Show blocking review state
- Prevent publish claims that imply parity
- Require an explicit operator resolution note or deferral decision

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
- Allow related inventory objects to proceed only if the unsupported behavior is
  clearly isolated

UI behavior:

- Show as unsupported
- Recommend deferral or manual redesign
- Warn when the unsupported item affects emergency routing, carrier behavior, or
  user-facing call handling

Evidence requirement:

- Unsupported classification
- Operator acknowledgement if migration proceeds without parity
- Recorded mitigation or redesign note for cutover planning

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
- Keep the object outside the draft-import candidate set until classification changes

UI behavior:

- Show as unknown
- Recommend source-system investigation
- Prevent parity claims, effort estimates, or automated cutover assumptions

Evidence requirement:

- Research-needed note
- Missing-data explanation
- Follow-up issue or investigation reference when one exists

## Shared Rules

- Levels `C`, `D`, `E`, and `U` must never be hidden from the operator.
- Levels `D`, `E`, and `U` must never auto-publish or generate runnable source
  logic.
- Any source object that affects emergency routing, outbound permissions, or
  carrier selection should require validation and simulation evidence even when
  classified `A` or `B`.
- The support level belongs to the compatibility report and evidence bundle, not
  just to the importer implementation.
- Classification should be conservative at the highest-risk interpretation when
  one source object mixes multiple behaviors.

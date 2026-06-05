# AI Operator Workflows

## 1. Purpose

This document defines the planned `v0.6.x` AI-assisted operator workflows for
`manageCallAI`.

It is a design target for the next product release lane, not a claim that the
current code line already ships these features.

## 2. Design goals

- use AI where it reduces operator investigation time
- keep AI narrower than the REST API and existing publish lifecycle
- ground explanations and summaries in normalized API-owned records
- keep all AI-assisted outputs tenant-scoped, capability-gated, and auditable
- avoid provider lock-in in core domain models

## 3. Non-goals

The `v0.6.x` AI lane is not intended to:

- publish live telecom changes autonomously
- bypass validation, simulation, approval, publish, or rollback
- expose raw FreeSWITCH ESL, raw XML, shell access, or SQL through AI tools
- make bundled LLM, STT, or TTS providers a hard dependency of core installs

## 4. Planned operator workflows

### 4.1 Call failure explanation

Inputs:

- call detail records
- normalized call events
- route resolution context
- gateway and registration status snapshots
- runtime error observations

Output:

- short operator-readable explanation of the likely failure reason
- supporting facts and confidence qualifiers
- next recommended operator action

Guardrails:

- must cite bounded facts already present in the control plane
- must distinguish observed failure from inferred likely cause

### 4.2 Route and change risk analysis

Inputs:

- publishable object drafts
- validation and simulation results
- route associations
- phone number bindings
- active published versions

Output:

- affected numbers, trunks, routes, queues, or IVRs
- risk summary for operator review
- unresolved pre-publish concerns

Guardrails:

- risk analysis remains advisory
- any mutation still flows through draft, validate, simulate, approve, and publish

### 4.3 Voicemail and call summaries

Inputs:

- recording metadata
- optional transcript text
- voicemail metadata
- retention and permission checks

Output:

- short summary
- optional urgency or action-needed classification
- operator review snippet suitable for inbox or timeline views

Guardrails:

- summaries inherit recording and voicemail access controls
- missing transcript data must be reported explicitly instead of fabricated

Current implementation status:

- recording summary review is exposed through bounded read-only REST endpoints
- call-detail review resolves through the linked call recording when one exists
- voicemail review resolves through the linked call recording for the voicemail
  `call_id`
- transcript text is additionally gated by `tenant.compliance.admin`
- missing recording-analysis or elapsed retention windows produce explicit
  unavailable states instead of fabricated output

### 4.4 Natural-language reporting

Inputs:

- bounded operator question
- tenant scope
- allowed reporting dimensions and filters

Output:

- compiled domain query
- result table or time-series view
- explanation of filters applied

Guardrails:

- natural-language requests compile to bounded report queries, not raw SQL
- unsupported questions must fail closed with a clear explanation

## 5. Suggested service boundaries

Planned API-owned service areas:

- `CallFailureExplanationService`
- `RouteRiskAnalysisService`
- `RecordingSummaryService`
- `NaturalLanguageReportingService`

These services should consume existing repositories and normalized records rather
than introducing parallel persistence or runtime access paths.

## 6. Data-source boundaries

Allowed sources:

- normalized call events
- call detail records
- runtime node status snapshots
- gateway registration state
- validation and simulation records
- publish history
- recording-analysis records when present

Disallowed sources:

- direct AI access to PostgreSQL
- direct AI access to FreeSWITCH ESL
- direct AI access to shell commands
- provider-specific hidden state outside the control plane

## 7. Audit and identity requirements

AI-assisted requests must:

- preserve actor identity distinct from human and generic API-key actors
- record tool/session attribution where applicable
- retain request/response metadata needed for incident review
- support idempotent retries for automation-driven calls

## 8. Dependencies

`v0.6.x` should build on:

- the existing AI/MCP hardening and tracing work documented in
  [../planning/slices/SLICE-20-automation-and-ai-depth.md](../planning/slices/SLICE-20-automation-and-ai-depth.md),
  [../planning/slices/SLICE-31-prompt-and-ivr-ai-integration-contracts.md](../planning/slices/SLICE-31-prompt-and-ivr-ai-integration-contracts.md),
  and
  [../planning/slices/SLICE-42-ai-dry-run-audit-identity-and-tracing.md](../planning/slices/SLICE-42-ai-dry-run-audit-identity-and-tracing.md)
- completion of the remaining `v0.5.x` lifecycle-consistency work so AI risk
  outputs can rely on the same publish model across more PBX objects

## 9. Acceptance bar for a `v0.6.x` feature

Each AI-assisted feature should be considered complete only when:

- tenant and capability boundaries are enforced
- audit identity is preserved
- tests cover happy path, denied path, and missing-data path
- outputs stay bounded to normalized control-plane facts
- documentation explains what is inferred versus directly observed

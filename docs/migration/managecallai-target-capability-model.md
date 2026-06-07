# manageCallAI Target Capability Model For Migration

This document defines which target capabilities manageCallAI already implements,
which are covered by completed enterprise-model work, and which remain future
or explicitly deferred for migration work.

Status legend:

- `Implemented`
- `Covered by closed issue`
- `Open issue exists`
- `Missing issue needed`
- `Future / not planned`

## Core And Enterprise Capability Status

| Capability area | Status | Issue references | Notes |
| --- | --- | --- | --- |
| Multi-tenant auth and capability gates | Implemented | n/a | Migration flows must inherit existing tenant and capability boundaries. |
| Extensions, trunks, phone numbers, routes, IVR, queues, voicemail | Implemented | n/a | Existing control-plane baseline. |
| End-user self-service, runtime status, and audit surfaces | Implemented | n/a | Migration review should reuse existing evidence and operator visibility surfaces. |
| Numbering plan model | Covered by closed issue | [#300](https://github.com/gokbilge/manageCallAI/issues/300), [#302](https://github.com/gokbilge/manageCallAI/issues/302) | Required for route-pattern imports and outbound-policy validation. |
| Calling policy and outbound permissions | Covered by closed issue | [#301](https://github.com/gokbilge/manageCallAI/issues/301), [#302](https://github.com/gokbilge/manageCallAI/issues/302) | Required for class-of-service and restriction mapping. |
| Site and location model | Covered by closed issue | [#303](https://github.com/gokbilge/manageCallAI/issues/303), [#304](https://github.com/gokbilge/manageCallAI/issues/304) | Required for branch/site-aware migration. |
| Trunk groups and route lists | Covered by closed issue | [#305](https://github.com/gokbilge/manageCallAI/issues/305), [#306](https://github.com/gokbilge/manageCallAI/issues/306), [#307](https://github.com/gokbilge/manageCallAI/issues/307) | Required for carrier failover imports. |
| User, extension, and device separation | Covered by closed issue | [#308](https://github.com/gokbilge/manageCallAI/issues/308), [#309](https://github.com/gokbilge/manageCallAI/issues/309), [#310](https://github.com/gokbilge/manageCallAI/issues/310) | Foundation for PBX endpoint mapping. |
| Schedule groups and holiday calendars | Covered by closed issue | [#311](https://github.com/gokbilge/manageCallAI/issues/311) | Needed for source schedule normalization. |
| Overrides and expiry workflows | Covered by closed issue | [#312](https://github.com/gokbilge/manageCallAI/issues/312) | Needed for temporary override imports. |
| Timezone-aware schedule evaluation | Covered by closed issue | [#313](https://github.com/gokbilge/manageCallAI/issues/313) | Needed for site-aware behavior parity. |
| Line appearance model | Covered by closed issue | [#314](https://github.com/gokbilge/manageCallAI/issues/314) | Needed for Cisco-style multi-line phones. |
| Device appearance assignment | Covered by closed issue | [#315](https://github.com/gokbilge/manageCallAI/issues/315) | Needed for endpoint presentation and review. |
| Enterprise upgrade and release guidance | Covered by closed issue | [#316](https://github.com/gokbilge/manageCallAI/issues/316), [#317](https://github.com/gokbilge/manageCallAI/issues/317), [#318](https://github.com/gokbilge/manageCallAI/issues/318) | Stabilization boundary before migration docs. |
| Publish lifecycle parity for enterprise routing objects | Covered by closed issue | [#319](https://github.com/gokbilge/manageCallAI/issues/319) | Imported drafts can rely on the same lifecycle vocabulary as native objects. |
| Audit and approval parity for enterprise policy objects | Covered by closed issue | [#320](https://github.com/gokbilge/manageCallAI/issues/320) | High-risk imported policy changes can inherit existing approval semantics. |
| Rollback and versioning for enterprise model changes | Covered by closed issue | [#321](https://github.com/gokbilge/manageCallAI/issues/321) | Required for safe operator rollback. |
| Cross-object enterprise validation engine | Covered by closed issue | [#322](https://github.com/gokbilge/manageCallAI/issues/322) | Required for compatibility analysis and conflict detection. |
| Enterprise simulation depth | Covered by closed issue | [#323](https://github.com/gokbilge/manageCallAI/issues/323) | Required for migration dry-runs. |
| Operator-facing conflict explanation | Covered by closed issue | [#324](https://github.com/gokbilge/manageCallAI/issues/324) | Required for reviewable migration warnings. |
| Enterprise admin surfaces and topology workflows | Covered by closed issue | [#325](https://github.com/gokbilge/manageCallAI/issues/325), [#326](https://github.com/gokbilge/manageCallAI/issues/326), [#327](https://github.com/gokbilge/manageCallAI/issues/327) | Migration review can land in an operator-facing product surface, not API-only flows. |
| Enterprise capability baseline audit and deferral register | Covered by closed issue | [#328](https://github.com/gokbilge/manageCallAI/issues/328), [#329](https://github.com/gokbilge/manageCallAI/issues/329), [#330](https://github.com/gokbilge/manageCallAI/issues/330) | Defines what migration docs may safely claim. |
| Migration readiness docs and taxonomy | Open issue exists | [#331](https://github.com/gokbilge/manageCallAI/issues/331), [#332](https://github.com/gokbilge/manageCallAI/issues/332), [#333](https://github.com/gokbilge/manageCallAI/issues/333), [#334](https://github.com/gokbilge/manageCallAI/issues/334) | Documentation lane only. |
| Canonical migration snapshot and importer foundations | Open issue exists | [#335](https://github.com/gokbilge/manageCallAI/issues/335), [#336](https://github.com/gokbilge/manageCallAI/issues/336), [#337](https://github.com/gokbilge/manageCallAI/issues/337), [#338](https://github.com/gokbilge/manageCallAI/issues/338), [#339](https://github.com/gokbilge/manageCallAI/issues/339) | Draft-only importer lane after `v0.8.x`. |
| Contact-center agent and skill model | Implemented | n/a | Present in the product line, but migration parity remains conservative until source mappings prove safe coverage. |
| Pickup groups | Future / not planned | n/a | Keep explicitly deferred unless enterprise baseline changes. |
| Paging and intercom | Future / not planned | n/a | Important but not required for the first migration lane. |
| Operator console and attendant groups | Future / not planned | n/a | Enterprise or vertical feature, not first migration baseline. |
| Hotel / PMS | Future / not planned | n/a | Vertical-specific and high-risk. |
| Proprietary endpoint behavior | Future / not planned | n/a | Must remain manual-review-only until modeled explicitly. |

## Migration-Specific Future Entities

The following are not part of the current control-plane baseline and should stay
behind the migration/adoption track:

| Entity | Status | Notes |
| --- | --- | --- |
| MigrationSource | Open issue exists | Covered implicitly by [#359](https://github.com/gokbilge/manageCallAI/issues/359) and the later importer workflow issues; source metadata should not bypass the canonical snapshot boundary. |
| CanonicalMigrationSnapshot | Open issue exists | Planned in [#335](https://github.com/gokbilge/manageCallAI/issues/335). |
| CompatibilityReport | Open issue exists | Planned in [#334](https://github.com/gokbilge/manageCallAI/issues/334) and later [#337](https://github.com/gokbilge/manageCallAI/issues/337). |
| ManualReviewItem | Open issue exists | Covered by the compatibility-report and workflow design lane in [#363](https://github.com/gokbilge/manageCallAI/issues/363), [#364](https://github.com/gokbilge/manageCallAI/issues/364), and [#367](https://github.com/gokbilge/manageCallAI/issues/367). |
| MigrationDraftImport | Open issue exists | Planned in [#338](https://github.com/gokbilge/manageCallAI/issues/338). |
| MigrationEvidenceBundle | Open issue exists | Planned in [#339](https://github.com/gokbilge/manageCallAI/issues/339). |

## Remaining Explicit Gaps

- `Generic CSV` and manual inventory guidance is intentionally documentation-only
  in the `v0.8.1` umbrella until a stronger parser or discovery contract exists.
- `Mitel` remains matrix-only in `v0.8.x`; the roadmap should not imply a full
  source mapping document until dedicated source research is justified.
- Deferred vertical features such as hotel/PMS, attendant console, and
  proprietary endpoint behavior should remain `Level D`, `Level E`, or `Level U`
  migration outcomes unless the product model expands first.

## Model Boundary Rules

- Migration tooling must consume the target model; it must not redefine it.
- Imported objects must remain drafts until validated, simulated, reviewed, and
  published through normal lifecycle controls.
- Unknown source behavior must remain visible as a review item, not silently
  coerced into a live configuration.

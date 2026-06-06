# manageCallAI Target Capability Model For Migration

This document defines which target capabilities manageCallAI already implements,
which are covered by existing enterprise-model issues, and which remain future
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
| Numbering plan model | Covered by closed issue | [#300](https://github.com/gokbilge/manageCallAI/issues/300), [#302](https://github.com/gokbilge/manageCallAI/issues/302) | Required for route-pattern imports and outbound-policy validation. |
| Calling policy and outbound permissions | Covered by closed issue | [#301](https://github.com/gokbilge/manageCallAI/issues/301), [#302](https://github.com/gokbilge/manageCallAI/issues/302) | Required for class-of-service and restriction mapping. |
| Site and location model | Covered by closed issue | [#303](https://github.com/gokbilge/manageCallAI/issues/303), [#304](https://github.com/gokbilge/manageCallAI/issues/304) | Required for branch/site-aware migration. |
| Trunk groups and route lists | Covered by closed issue | [#305](https://github.com/gokbilge/manageCallAI/issues/305), [#306](https://github.com/gokbilge/manageCallAI/issues/306), [#307](https://github.com/gokbilge/manageCallAI/issues/307) | Required for carrier failover imports. |
| User, extension, and device separation | Covered by closed issue | [#308](https://github.com/gokbilge/manageCallAI/issues/308), [#309](https://github.com/gokbilge/manageCallAI/issues/309), [#310](https://github.com/gokbilge/manageCallAI/issues/310) | Foundation for PBX endpoint mapping. |
| Schedule groups and holiday calendars | Open issue exists | [#311](https://github.com/gokbilge/manageCallAI/issues/311) | Needed for source schedule normalization. |
| Overrides and expiry workflows | Open issue exists | [#312](https://github.com/gokbilge/manageCallAI/issues/312) | Needed for temporary override imports. |
| Timezone-aware schedule evaluation | Open issue exists | [#313](https://github.com/gokbilge/manageCallAI/issues/313) | Needed for site-aware behavior parity. |
| Line appearance model | Open issue exists | [#314](https://github.com/gokbilge/manageCallAI/issues/314) | Needed for Cisco-style multi-line phones. |
| Device appearance assignment | Open issue exists | [#315](https://github.com/gokbilge/manageCallAI/issues/315) | Needed for endpoint presentation and review. |
| Enterprise upgrade and release guidance | Open issue exists | [#316](https://github.com/gokbilge/manageCallAI/issues/316), [#317](https://github.com/gokbilge/manageCallAI/issues/317), [#318](https://github.com/gokbilge/manageCallAI/issues/318) | Stabilization boundary before migration docs. |
| Publish lifecycle parity for enterprise routing objects | Open issue exists | [#319](https://github.com/gokbilge/manageCallAI/issues/319) | Required before imported drafts can behave like native objects. |
| Audit and approval parity for enterprise policy objects | Open issue exists | [#320](https://github.com/gokbilge/manageCallAI/issues/320) | Required for high-risk imported policy changes. |
| Rollback and versioning for enterprise model changes | Open issue exists | [#321](https://github.com/gokbilge/manageCallAI/issues/321) | Required for safe operator rollback. |
| Cross-object enterprise validation engine | Open issue exists | [#322](https://github.com/gokbilge/manageCallAI/issues/322) | Required for compatibility analysis and conflict detection. |
| Enterprise simulation depth | Open issue exists | [#323](https://github.com/gokbilge/manageCallAI/issues/323) | Required for migration dry-runs. |
| Operator-facing conflict explanation | Open issue exists | [#324](https://github.com/gokbilge/manageCallAI/issues/324) | Required for reviewable migration warnings. |
| Enterprise admin surfaces and topology workflows | Open issue exists | [#325](https://github.com/gokbilge/manageCallAI/issues/325), [#326](https://github.com/gokbilge/manageCallAI/issues/326), [#327](https://github.com/gokbilge/manageCallAI/issues/327) | Needed before migration becomes usable by operators. |
| Enterprise capability baseline audit and deferral register | Open issue exists | [#328](https://github.com/gokbilge/manageCallAI/issues/328), [#329](https://github.com/gokbilge/manageCallAI/issues/329), [#330](https://github.com/gokbilge/manageCallAI/issues/330) | Defines what migration docs may safely claim. |
| Migration readiness docs and taxonomy | Open issue exists | [#331](https://github.com/gokbilge/manageCallAI/issues/331), [#332](https://github.com/gokbilge/manageCallAI/issues/332), [#333](https://github.com/gokbilge/manageCallAI/issues/333), [#334](https://github.com/gokbilge/manageCallAI/issues/334) | Documentation lane only. |
| Canonical migration snapshot and importer foundations | Open issue exists | [#335](https://github.com/gokbilge/manageCallAI/issues/335), [#336](https://github.com/gokbilge/manageCallAI/issues/336), [#337](https://github.com/gokbilge/manageCallAI/issues/337), [#338](https://github.com/gokbilge/manageCallAI/issues/338), [#339](https://github.com/gokbilge/manageCallAI/issues/339) | Draft-only importer lane after `v0.8.x`. |
| Pickup groups | Future / not planned | n/a | Keep explicitly deferred unless enterprise baseline changes. |
| Paging and intercom | Future / not planned | n/a | Important but not required for the first migration lane. |
| Operator console and attendant groups | Future / not planned | n/a | Enterprise/vertical feature, not first migration baseline. |
| Hotel / PMS | Future / not planned | n/a | Vertical-specific and high-risk. |
| Proprietary endpoint behavior | Future / not planned | n/a | Must remain manual-review-only until modeled explicitly. |

## Migration-Specific Future Entities

The following are not part of the current control-plane baseline and should stay
behind the migration/adoption track:

| Entity | Status | Notes |
| --- | --- | --- |
| MigrationSource | Missing issue needed | Source metadata, credential posture, acquisition method. |
| CanonicalMigrationSnapshot | Open issue exists | Planned in [#335](https://github.com/gokbilge/manageCallAI/issues/335). |
| CompatibilityReport | Open issue exists | Planned in [#334](https://github.com/gokbilge/manageCallAI/issues/334) and later [#337](https://github.com/gokbilge/manageCallAI/issues/337). |
| ManualReviewItem | Missing issue needed | Should be part of the compatibility and draft-import model. |
| MigrationDraftImport | Open issue exists | Planned in [#338](https://github.com/gokbilge/manageCallAI/issues/338). |
| MigrationEvidenceBundle | Open issue exists | Planned in [#339](https://github.com/gokbilge/manageCallAI/issues/339). |

## Model Boundary Rules

- Migration tooling must consume the target model; it must not redefine it.
- Imported objects must remain drafts until validated, simulated, reviewed, and
  published through normal lifecycle controls.
- Unknown source behavior must remain visible as a review item, not silently
  coerced into a live configuration.

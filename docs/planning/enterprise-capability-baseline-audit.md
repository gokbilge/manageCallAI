# Enterprise Capability Baseline Audit

Release: v0.7.4
Last updated: 2026-06-07

Planning doc: `docs/planning/enterprise-migration-release-train.md`
Section: `v0.7.4` – Enterprise Baseline Close-Out

Closes: #328

---

## Purpose

This document audits the enterprise product-model boundary as of v0.7.x close-out.
It answers:

- which enterprise objects exist with full lifecycle support
- where lifecycle, validation, simulation, or approval coverage is partial
- what the model can safely claim to represent before migration-analysis work begins

This is a planning gate document, not a release evidence claim.

---

## Enterprise Object Inventory

The following enterprise objects were introduced in the v0.6.3–v0.6.8 and v0.7.x
release train.

### Trunk Groups and Route Lists

| Attribute | Status |
|-----------|--------|
| Domain model | complete |
| CRUD API | complete |
| Lifecycle (draft/validate/simulate/publish/rollback) | complete (v0.7.1) |
| Approval gate | complete (v0.7.1) |
| Audit trail | complete (v0.7.1) |
| Version snapshots | complete (v0.7.1) |
| Cross-object validation | v0.7.2 target |
| Operator web UX | v0.7.3 target |

### Calling Policies

| Attribute | Status |
|-----------|--------|
| Domain model | complete |
| CRUD API | complete |
| Lifecycle (draft/validate/simulate/publish/rollback) | complete (v0.7.1) |
| Approval gate | complete (v0.7.1) |
| Audit trail | complete (v0.7.1) |
| Version snapshots | complete (v0.7.1) |
| Cross-object validation | v0.7.2 target |
| Operator web UX | v0.7.3 target |

### Numbering Plans and Rules

| Attribute | Status |
|-----------|--------|
| Domain model | complete |
| CRUD API | complete |
| Lifecycle (draft/validate/simulate/publish/rollback) | complete (v0.7.1) |
| Approval gate | complete (v0.7.1) |
| Audit trail | complete (v0.7.1) |
| Version snapshots | complete (v0.7.1) |
| Cross-object validation | v0.7.2 target |
| Operator web UX | v0.7.3 target |

### Sites and Locations

| Attribute | Status |
|-----------|--------|
| Domain model | complete |
| CRUD API | complete |
| Lifecycle (draft/validate/simulate/publish/rollback) | complete (v0.7.1) |
| Approval gate | complete (v0.7.1) |
| Audit trail | complete (v0.7.1) |
| Version snapshots | complete (v0.7.1) |
| Emergency and timezone defaults | complete |
| Cross-object validation | v0.7.2 target |
| Operator web UX | v0.7.3 target |

### Schedules and Holiday Calendars

| Attribute | Status |
|-----------|--------|
| Domain model | complete |
| CRUD API | complete |
| Lifecycle (draft/validate/simulate/publish/rollback) | complete (v0.7.1) |
| Approval gate | complete (v0.7.1) |
| Audit trail | complete (v0.7.1) |
| Version snapshots | complete (v0.7.1) |
| Timezone-aware evaluation | complete |
| Cross-object validation | v0.7.2 target |
| Operator web UX | v0.7.3 target |

### Line Appearances

| Attribute | Status |
|-----------|--------|
| Domain model | complete |
| CRUD API | complete |
| Device appearance assignment | complete |
| Lifecycle (draft/validate/simulate/publish/rollback) | complete (v0.7.1) |
| Approval gate | complete (v0.7.1) |
| Audit trail | complete (v0.7.1) |
| Version snapshots | complete (v0.7.1) |
| Full shared-line behavior | deferred (see #329) |
| Cross-object validation | v0.7.2 target |
| Operator web UX | v0.7.3 target |

---

## Lifecycle Coverage Summary

All six enterprise object types introduced in v0.6.3–v0.6.8 now have:

- tenant-scoped CRUD
- draft/validate/simulate/publish/rollback lifecycle via `EnterpriseLifecycleService`
- approval gate with `EnterpriseLifecycleRepository.publish` and `.rollback`
- audit event emission at every state transition
- version snapshots with `createVersion` and `listVersions`
- `dryRunPublish` to preview approval requirements before committing

This brings them to the same safety model as IVR flows.

---

## Coverage Gaps Remaining Before v0.8.x

The following items are explicitly out-of-scope for the v0.7.x enterprise lane:

| Gap | Planned resolution |
|-----|--------------------|
| Cross-object validation (e.g. calling-policy + site conflicts) | v0.7.2 |
| Enterprise route and failover simulation depth | v0.7.2 |
| Operator-facing conflict explanation | v0.7.2 |
| Web UX for all new enterprise objects | v0.7.3 |
| Assignment and topology workflow UX | v0.7.3 |
| Evidence and status presentation for routing objects | v0.7.3 |

None of these gaps block migration-analysis documentation from beginning.
They do not affect the correctness of source-system mapping work.

---

## Conclusion

The enterprise product model as of v0.7.4 is suitable to begin v0.8.x
migration-analysis and documentation work.

- All six enterprise object types have coherent lifecycle coverage.
- Deferred features are recorded explicitly (see `docs/planning/enterprise-deferral-register.md`).
- The model boundary is stable enough for source-system compatibility mapping.

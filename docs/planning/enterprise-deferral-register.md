# Enterprise Deferral Register — Vertical PBX Features

Release: v0.7.4
Last updated: 2026-06-07

Planning doc: `docs/planning/enterprise-migration-release-train.md`
Section: `v0.7.4` – Enterprise Baseline Close-Out

Closes: #329

---

## Purpose

This document records intentional deferrals for vertical-specific and
still-missing enterprise PBX features so they are not rediscovered ad hoc
during migration planning.

Each deferred feature is annotated with:

- why it was deferred (complexity, vertical-specificity, dependency order)
- whether migration analysis can proceed without it
- a suggested release target if planned

---

## Deferred Features

### Full Shared-Line Behavior

**Status:** Foundation only (device button/appearance assignment exists)

**What is deferred:**
Shared-line groups, SLA presentation, join/leave, privacy mode, and
multi-device BLF synchronization.

**Why deferred:**
The line-appearance domain model foundation was introduced in v0.6.8 to unblock
enterprise identity mapping. Full shared-line semantics depend on a runtime
signaling layer not yet planned.

**Impact on migration analysis:**
Analyzable at the mapping level. Source-system shared-line configurations can
be catalogued and mapped to the foundation model. Full behavioral parity is not
required for analysis documentation.

**Planned target:** post-v0.8.x, dependent on signaling layer scope decision.

---

### Boss/Secretary and Executive Workflows

**Status:** Not implemented

**What is deferred:**
Assistant routing, call interception and filtering, delegate calendar
integration, and executive presence rules.

**Why deferred:**
Requires shared-line foundation and an extended presence model not yet
designed. High vertical complexity relative to the initial enterprise baseline.

**Impact on migration analysis:**
Documentable as a source-system feature that maps to "not yet supported" in
the target model. The compatibility taxonomy should include a support level
for "foundation exists, behavior deferred."

**Planned target:** post-v0.8.x.

---

### Paging and Intercom

**Status:** Not implemented

**What is deferred:**
Paging groups, one-way intercom, multicast paging, and zone paging.

**Why deferred:**
Requires audio routing primitives at the runtime layer. Enterprise paging
topology is also source-system specific (Cisco PGMT, Avaya SBCE, etc.).

**Impact on migration analysis:**
Can be mapped to "deferred" in migration compatibility documents. Does not
block core extension/trunk/routing analysis.

**Planned target:** not scheduled.

---

### Pickup Groups

**Status:** Not implemented

**What is deferred:**
Group pickup, directed pickup, and BLF-assisted pickup.

**Why deferred:**
Depends on shared-line presence signaling and is typically a runtime-tier
feature rather than a control-plane model feature.

**Impact on migration analysis:**
Documentable as a source capability gap. Does not block core routing and
numbering analysis.

**Planned target:** not scheduled.

---

### Operator Console and Attendant Groups

**Status:** Not implemented

**What is deferred:**
Attendant console, overflow routing, park and retrieve, and attendant transfer
workflows.

**Why deferred:**
Large UX surface with runtime dependencies. The queue-and-callback model
covers basic attendant routing; advanced console workflows are separate.

**Impact on migration analysis:**
Source-system attendant configurations can be catalogued. Full target-model
equivalency is not a v0.8.x prerequisite.

**Planned target:** not scheduled.

---

### Hotel and PMS Workflows

**Status:** Not implemented

**What is deferred:**
Room phone provisioning, PMS integration, guest messaging, and wakeup calls.

**Why deferred:**
Vertical-specific. Requires external PMS integration contracts not planned in
the current roadmap.

**Impact on migration analysis:**
Out of scope for the initial enterprise migration lane. A separate vertical
extension lane would own this.

**Planned target:** not scheduled; vertical initiative required.

---

### Analog Gateway Inventory Depth

**Status:** Partial (SIP trunk model exists; analog-specific fields are not modeled)

**What is deferred:**
Analog line inventory, port mapping, Cisco ATA/VG configuration, and
FXS/FXO topology.

**Why deferred:**
Requires hardware-specific inventory primitives. The trunk and routing models
cover the logical carrier layer; physical port topology is not modeled.

**Impact on migration analysis:**
Can be approximated as "SIP conversion required" in migration compatibility
documents.

**Planned target:** not scheduled.

---

### Full Call-Accounting Continuity

**Status:** Partial (call events are recorded; enriched CDR export is not built)

**What is deferred:**
Full CDR schema, billing rate tables, SMDR integration, and call-accounting
export formats.

**Why deferred:**
Reporting and accounting depth is a post-launch operational feature, not a
control-plane model requirement.

**Impact on migration analysis:**
Source-system CDR data can be noted as out-of-scope for the v0.8.x migration
analysis lane.

**Planned target:** not scheduled.

---

### Cross-Object Enterprise Validation

**Status:** In-progress (v0.7.2 target)

**What is deferred from v0.7.1:**
Multi-object conflict detection (calling-policy + site, schedule + timezone,
trunk-group failover ambiguity).

**Impact on migration analysis:**
Does not block v0.8.x documentation work. Per-object validation is complete.

**Planned target:** v0.7.2.

---

### Enterprise Object Operator UX

**Status:** In-progress (v0.7.3 target)

**What is deferred from v0.7.1:**
Web admin surfaces for new enterprise objects (listing, detail, assignment
workflows, lifecycle status views).

**Impact on migration analysis:**
API surfaces are complete. Documentation analysis does not require web UX.

**Planned target:** v0.7.3.

---

## Deferral Register Status

| Feature | Deferred since | Target | Blocks v0.8.x? |
|---------|---------------|--------|-----------------|
| Full shared-line behavior | v0.6.8 | post-v0.8.x | No |
| Boss/secretary workflows | v0.7.4 | post-v0.8.x | No |
| Paging and intercom | v0.7.4 | not scheduled | No |
| Pickup groups | v0.7.4 | not scheduled | No |
| Operator console and attendant | v0.7.4 | not scheduled | No |
| Hotel/PMS workflows | v0.7.4 | not scheduled | No |
| Analog gateway inventory depth | v0.7.4 | not scheduled | No |
| Full call-accounting continuity | v0.7.4 | not scheduled | No |
| Cross-object enterprise validation | v0.7.1 | v0.7.2 | No |
| Enterprise operator web UX | v0.7.1 | v0.7.3 | No |

No deferred feature blocks v0.8.x migration-analysis documentation from beginning.

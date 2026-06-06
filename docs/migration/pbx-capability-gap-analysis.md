# PBX Capability Gap Analysis

## Purpose

This document defines why migration readiness must be established before
manageCallAI ships import tooling.

The migration problem is not "how do we ingest another PBX export?" It is
"which source-system behaviors can manageCallAI represent safely, which require
operator review, and which must remain out of scope until the product model
grows stronger?"

Safe migration order:

```text
source discovery
  -> capability analysis
  -> compatibility classification
  -> draft object generation
  -> validation and simulation
  -> operator review
  -> cutover planning
  -> runtime smoke
  -> rollback evidence
```

## Supported Source-System Families

Open-source and software PBX:

- FreePBX
- Asterisk raw configuration
- FusionPBX
- Generic CSV/manual inventories

Enterprise PBX:

- Cisco CUCM
- Avaya Aura
- Alcatel OmniPCX
- Mitel

These families differ in export methods, topology depth, endpoint models,
calling-policy semantics, and custom logic surfaces. The migration toolkit must
therefore start from a source-neutral analysis model.

## Why Gap Analysis Comes Before Import Tooling

If the target product model cannot represent a source capability, the importer
has only unsafe options:

- ignore the behavior
- flatten it into a weak approximation
- import data without preserving live semantics
- silently create routing or policy drift

That is not acceptable for emergency routing, calling restrictions, site-aware
trunking, schedule-driven routing, voicemail handling, or queue behavior.

The importer must not pressure the core product into unsafe approximations.
manageCallAI should first define what it can represent, then build import flows
that respect those boundaries.

## Capability Matrix Summary

The detailed matrix lives in
[`source-system-capability-matrix.md`](source-system-capability-matrix.md).

High-risk source areas across vendors:

| Source family | Primary migration risk |
| --- | --- |
| FreePBX / Asterisk | custom dialplan, macros, AGI, module-specific destinations |
| FusionPBX | tenant/domain separation, XML dialplan depth, custom Lua/XML logic |
| Cisco CUCM | partitions/CSS, route patterns, line appearances, device pools |
| Avaya Aura | vectors, VDNs, COR/COS, coverage paths, adjunct logic |
| Alcatel OmniPCX | hospitality workflows, operator features, proprietary endpoints |
| Mitel | class-of-service variants, digital endpoint behavior, vendor-specific groups |
| Generic CSV | incomplete source truth, missing behavior semantics, missing references |

## Import Support Levels

The detailed taxonomy lives in
[`import-support-levels.md`](import-support-levels.md).

Summary:

- `Level A` Exact support
- `Level B` Equivalent support
- `Level C` Approximate support
- `Level D` Manual review required
- `Level E` Unsupported
- `Level U` Unknown or source-specific research required

## P0 Target Capabilities

These capabilities are required before import tooling can be trusted.

| Capability | Current posture |
| --- | --- |
| Numbering plan model | Covered by closed issues [#300](https://github.com/gokbilge/manageCallAI/issues/300) and [#302](https://github.com/gokbilge/manageCallAI/issues/302) |
| Calling policy and outbound permissions | Covered by closed issues [#301](https://github.com/gokbilge/manageCallAI/issues/301) and [#302](https://github.com/gokbilge/manageCallAI/issues/302) |
| Site and location model | Covered by closed issues [#303](https://github.com/gokbilge/manageCallAI/issues/303) and [#304](https://github.com/gokbilge/manageCallAI/issues/304) |
| Trunk groups and route lists | Covered by closed issues [#305](https://github.com/gokbilge/manageCallAI/issues/305), [#306](https://github.com/gokbilge/manageCallAI/issues/306), and [#307](https://github.com/gokbilge/manageCallAI/issues/307) |
| User, extension, device, credential separation | Partly covered by closed [#308](https://github.com/gokbilge/manageCallAI/issues/308), [#309](https://github.com/gokbilge/manageCallAI/issues/309), and [#310](https://github.com/gokbilge/manageCallAI/issues/310) |
| Advanced schedules and overrides | Open in [#311](https://github.com/gokbilge/manageCallAI/issues/311), [#312](https://github.com/gokbilge/manageCallAI/issues/312), and [#313](https://github.com/gokbilge/manageCallAI/issues/313) |
| Line appearances | Open in [#314](https://github.com/gokbilge/manageCallAI/issues/314) and [#315](https://github.com/gokbilge/manageCallAI/issues/315) |
| Lifecycle parity for enterprise objects | Planned in [#319](https://github.com/gokbilge/manageCallAI/issues/319), [#320](https://github.com/gokbilge/manageCallAI/issues/320), and [#321](https://github.com/gokbilge/manageCallAI/issues/321) |
| Cross-object validation and simulation depth | Planned in [#322](https://github.com/gokbilge/manageCallAI/issues/322), [#323](https://github.com/gokbilge/manageCallAI/issues/323), and [#324](https://github.com/gokbilge/manageCallAI/issues/324) |

## P1 Target Capabilities

These improve migration coverage materially, but they should not distort the
first migration-readiness lane.

- pickup groups
- paging and intercom
- music-on-hold profiles
- announcement objects
- operator and attendant groups
- richer call-accounting continuity

## P2 Target Capabilities

These are future or vertical-specific and should stay explicitly deferred unless
buyer pull changes the roadmap.

- hotel and PMS workflows
- boss/secretary features
- analog gateway depth
- proprietary digital endpoint behavior
- hospitality and campus operator-console flows

## Migration Safety Rules

The PBX migration assistant must:

- never write directly to active live state
- never auto-publish imported routes, trunks, or policies
- never auto-enable emergency routing changes
- never silently discard unsupported source behavior
- never ingest custom source dialplan as runnable production logic
- preserve source object references, hashes, warnings, and confidence
- emit audit records for analysis, draft generation, and operator decisions
- provide validation, simulation, cutover, and rollback evidence

## AI-Assisted Migration Rules

AI can help with explanation and classification, but it remains advisory.

Allowed:

- summarize custom dialplan intent
- propose mapping candidates
- explain unclear source policy constructs
- draft compatibility-report text
- draft operator checklists

Forbidden:

- auto-publish imported objects
- auto-enable trunks
- auto-convert unknown source behavior into executable call logic
- execute source scripts or runtime commands

Required controls:

- confidence score
- operator attribution
- source-reference preservation
- manual-review flags
- tenant scoping
- audit trail

## Roadmap Recommendation

The migration/adoption track should be delivered in two epics:

1. Migration Readiness Gap Analysis
2. PBX Migration Assistant MVP

Release placement:

- `v0.7.x`: finish enterprise model stabilization and productization
- `v0.8.x`: migration readiness analysis and source mapping docs
- post-`v0.8.x`: draft-only importer and cutover evidence workflows

`v0.7.0` contact-center scope is already broad. Migration readiness should run
as a parallel planning lane or after the `v0.7` enterprise-model foundation,
not inside the same overloaded feature release.

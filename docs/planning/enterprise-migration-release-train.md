# Enterprise And Migration Release Train

Last updated: 2026-06-07.

This document turns the enterprise PBX gap analysis into a phased release and
slice plan.

It separates three different workstreams that should not be mixed into one
implementation lane:

- enterprise product-model expansion
- migration-analysis and mapping documentation
- importer and migration-assistant execution workflows

These are planning guides, not release evidence claims.

## Purpose

The strategic goal is to make `manageCallAI` capable of representing enterprise
PBX topologies safely before building migration tooling that depends on that
model.

The execution rule is:

1. strengthen the core product model
2. document migration compatibility against that stronger model
3. build draft-only import workflows on top of both

## Phase Boundaries

### Pre-`v0.7.0`: enterprise product-model expansion only

Releases between `v0.6.3` and `v0.6.x` before `v0.7.0` should contain only
product-model expansion. They should not include:

- source-PBX capability mapping documents
- migration compatibility reports
- import snapshot schemas
- source adapters
- draft-import workflows

Why:

- the product model must exist before migration mapping can be trusted
- importer work would create false pressure to approximate missing concepts
- `v0.7.0` already carries a release-evidence boundary and should close the
  pre-import modeling lane cleanly

### `v0.7.x`: enterprise-model stabilization and productization

After the pre-`v0.7.0` model lane lands, the `v0.7.x` line should not jump to
migration analysis yet.

It should be used to harden, unify, and operationalize the new enterprise
objects introduced in `v0.6.3` through `v0.6.8`.

This phase should focus on:

- required `v0.7.0` release-evidence re-runs
- lifecycle consistency across the new enterprise objects
- operator/admin UX completion for the new model
- validation, simulation, and audit parity across the new model
- runtime-safety proof that the stronger model does not regress existing call
  behavior

### `v0.8.x`: migration-analysis and documentation slices

After the `v0.7.0` release boundary, the next lane should be analysis and
documentation, not importer execution.

This phase defines:

- source-system capability matrices
- support-level taxonomy
- source-specific mapping documents
- target-model coverage analysis
- compatibility-report structure

### Post-`v0.8.x`: importer and migration-assistant MVP slices

Only after the target model and mapping documents exist should the repo start
the importer lane:

- canonical migration snapshot
- source adapters
- compatibility engine
- draft-only import workflows
- cutover and evidence planning

## Pre-`v0.7.0` Product-Model Release Train

This lane should stay light. Each release should center on one related domain
instead of mixing carrier, identity, scheduling, and migration work together.

### `v0.6.3` - Numbering And Outbound Policy

Focus:

- unified numbering plans
- numbering rules and assignments
- emergency numbers
- blocked and special-service prefixes
- calling policies
- extension and device outbound-permission assignments
- validation updates for emergency and outbound behavior

Why this first:

- enterprise numbering and calling policy are foundational to safe route
  modeling
- these concepts strengthen existing outbound and emergency controls even
  before any migration work starts

Suggested issue buckets:

- [#300](https://github.com/gokbilge/manageCallAI/issues/300) `v0.6.3: unified numbering plan model`
- [#301](https://github.com/gokbilge/manageCallAI/issues/301) `v0.6.3: calling policy and outbound permission model`
- [#302](https://github.com/gokbilge/manageCallAI/issues/302) `v0.6.3: validation and simulation support for numbering and calling policy`

Acceptance shape:

- tenant-scoped CRUD/draft lifecycle for the new objects
- capability-gated API and web surfaces
- validation rejects emergency-number conflicts and invalid policy overlaps
- simulation/explanation paths can reference numbering and policy outcomes

### `v0.6.4` - Site And Location Core

Focus:

- sites
- locations
- network zones
- per-site timezone and language defaults
- site emergency defaults
- site-level dialing-rule attachment points

Why this stands alone:

- site topology is a separate concern from outbound policy
- schedule, emergency, and carrier behavior depend on clear site ownership

Suggested issue buckets:

- [#303](https://github.com/gokbilge/manageCallAI/issues/303) `v0.6.4: site and location domain model`
- [#304](https://github.com/gokbilge/manageCallAI/issues/304) `v0.6.4: site-aware emergency and dialing defaults`

Acceptance shape:

- explicit tenant-owned site/location model exists
- extensions, devices, routes, and future schedules have site attachment points
- default emergency and language/timezone behavior is modeled, not implied

### `v0.6.5` - Trunk-Group Routing

Focus:

- trunk groups
- trunk-group members
- route lists
- failover ordering
- site/default outbound trunk-group selection
- simulation updates for failover outcomes

Why this is its own release:

- carrier topology and failover are already visible competitive gaps
- trunk-group logic should not be buried inside site or numbering refactors

Suggested issue buckets:

- [#305](https://github.com/gokbilge/manageCallAI/issues/305) `v0.6.5: trunk-group and route-list model`
- [#306](https://github.com/gokbilge/manageCallAI/issues/306) `v0.6.5: failover-aware route simulation`
- [#307](https://github.com/gokbilge/manageCallAI/issues/307) `v0.6.5: site-aware outbound carrier selection`

Acceptance shape:

- routes can resolve through grouped carrier topology instead of one direct trunk
- failover order is explicit and testable
- operator surfaces can inspect intended primary/secondary carrier behavior

### `v0.6.6` - People, Extensions, And Devices

Focus:

- clearer person/user model
- explicit device objects
- device credential ownership cleanup
- extension-to-device assignments
- registration ownership alignment

Why this follows routing topology:

- the repo already has extension and registration foundations, but enterprise
  identity separation is still partial
- this is structurally important but more invasive than the earlier policy and
  routing slices

Suggested issue buckets:

- [#308](https://github.com/gokbilge/manageCallAI/issues/308) `v0.6.6: user-extension-device separation`
- [#309](https://github.com/gokbilge/manageCallAI/issues/309) `v0.6.6: credential and registration ownership alignment`
- [#310](https://github.com/gokbilge/manageCallAI/issues/310) `v0.6.6: extension-device assignment workflows`

Acceptance shape:

- the product no longer relies on a flat extension-centric mental model
- device credentials and registrations have unambiguous ownership
- user/device associations are explicit enough for later enterprise mapping

### `v0.6.7` - Enterprise Schedules

Focus:

- schedule groups
- holiday calendars
- recurring and exception rules
- temporary overrides with expiry
- per-site timezone-aware evaluation

Why this comes after site modeling:

- advanced schedule evaluation depends on explicit site/timezone ownership
- schedule depth should integrate with the stronger site model, not work around
  its absence

Suggested issue buckets:

- [#311](https://github.com/gokbilge/manageCallAI/issues/311) `v0.6.7: schedule-group and holiday-calendar model`
- [#312](https://github.com/gokbilge/manageCallAI/issues/312) `v0.6.7: override and expiry workflow`
- [#313](https://github.com/gokbilge/manageCallAI/issues/313) `v0.6.7: timezone-aware route and IVR schedule evaluation`

Acceptance shape:

- the product can represent enterprise business-hours and closure behavior
- overrides are explicit, auditable, and reversible
- routing and simulation consume the same schedule semantics

### `v0.6.8` - Line Appearance Foundation

Focus:

- line appearances
- shared-line groundwork
- device button/appearance assignment foundation

Why this should stay narrow:

- line appearance is important for Cisco-style modeling
- the full executive/admin, boss/secretary, and attendant workflows are larger
  product features that should not be forced into the same release

Suggested issue buckets:

- [#314](https://github.com/gokbilge/manageCallAI/issues/314) `v0.6.8: line appearance domain model`
- [#315](https://github.com/gokbilge/manageCallAI/issues/315) `v0.6.8: device appearance assignment foundation`

Acceptance shape:

- the core data model can represent multiple appearances per device
- future shared-line and executive workflows are unblocked without claiming they
  are fully shipped

## `v0.7.x` Stabilization Release Train

This lane should stay focused on making the new enterprise model coherent and
operator-safe before the repo starts migration-analysis work.

### `v0.7.0` - Evidence Boundary And Model Freeze

Focus:

- required `v0.7.0` release-evidence re-runs
- regression proof across outbound, carrier, and runtime behavior
- schema/model freeze for the initial enterprise abstractions
- release-note and upgrade guidance for the new enterprise objects

Why this first:

- the repo already requires `v0.7.0` evidence re-runs for carrier interop,
  soak/SLO, and rotation rehearsal
- the enterprise model lane should prove it did not weaken telecom safety

Suggested issue buckets:

- [#316](https://github.com/gokbilge/manageCallAI/issues/316) `v0.7.0: carrier interop and runtime evidence re-run`
- [#317](https://github.com/gokbilge/manageCallAI/issues/317) `v0.7.0: soak, SLO, and rotation rehearsal re-run`
- [#318](https://github.com/gokbilge/manageCallAI/issues/318) `v0.7.0: enterprise model upgrade and release guidance`

Acceptance shape:

- required release evidence is refreshed against the stronger enterprise model
- upgrade and rollback notes cover the new schema/model surfaces
- no unresolved regressions remain in existing route, trunk, or runtime flows

### `v0.7.1` - Lifecycle Parity Across Enterprise Objects

Focus:

- draft/validate/simulate/publish consistency across the new objects
- approval and audit parity where changes affect live behavior
- rollback/versioning decisions for enterprise model objects

Why this stands alone:

- the biggest risk after adding new model objects is lifecycle inconsistency
- the repo's control-plane thesis depends on one coherent safety model

Suggested issue buckets:

- [#319](https://github.com/gokbilge/manageCallAI/issues/319) `v0.7.1: publish lifecycle parity for enterprise routing objects`
- [#320](https://github.com/gokbilge/manageCallAI/issues/320) `v0.7.1: audit and approval parity for enterprise policy objects`
- [#321](https://github.com/gokbilge/manageCallAI/issues/321) `v0.7.1: rollback and versioning for enterprise model changes`

Acceptance shape:

- the new enterprise objects follow the same safety vocabulary as the rest of
  the product
- risky mutations are not left as one-off CRUD-only workflows
- operator-visible audit history is coherent across the new model

### `v0.7.2` - Validation And Simulation Depth

Focus:

- cross-object validation across numbering, site, schedule, and trunk-group data
- simulation outputs that explain enterprise routing outcomes
- conflict detection for policy overlap, site mismatch, and failover ambiguity

Why this needs its own release:

- this is where the product proves the new model is not just representable, but
  understandable and safe
- cross-object reasoning is deeper than basic CRUD completion

Suggested issue buckets:

- [#322](https://github.com/gokbilge/manageCallAI/issues/322) `v0.7.2: cross-object enterprise validation engine`
- [#323](https://github.com/gokbilge/manageCallAI/issues/323) `v0.7.2: enterprise route and failover simulation depth`
- [#324](https://github.com/gokbilge/manageCallAI/issues/324) `v0.7.2: operator-facing conflict explanation for enterprise objects`

Acceptance shape:

- validation detects multi-object contradictions before publish
- simulation can explain carrier/site/schedule/policy outcomes in one flow
- operators can see why a configuration is rejected or risky

### `v0.7.3` - Operator And Admin Productization

Focus:

- web UX completion for the new enterprise objects
- list/detail/assignment workflows
- evidence and status presentation for the new routing/policy objects
- product docs and admin workflows that make the new model usable

Why this is separate from validation depth:

- operator productization is usually where model work either becomes real or
  remains architecture-only
- it is better to finish the model semantics first, then polish the daily UX

Suggested issue buckets:

- [#325](https://github.com/gokbilge/manageCallAI/issues/325) `v0.7.3: enterprise object admin surfaces`
- [#326](https://github.com/gokbilge/manageCallAI/issues/326) `v0.7.3: assignment and topology workflows`
- [#327](https://github.com/gokbilge/manageCallAI/issues/327) `v0.7.3: operator evidence and status views for enterprise routing`

Acceptance shape:

- tenant admins can manage the new objects without dropping to API-only flows
- topology and assignment relationships are inspectable in product
- the enterprise model reads as a first-class product surface, not only backend

### `v0.7.4` - Enterprise Baseline Close-Out

Focus:

- close remaining gaps required before starting migration-analysis docs
- explicit deferral decisions for still-missing vertical features
- readiness review for the `v0.8.x` documentation lane

Why this matters:

- the repo should start `v0.8.x` with a stable definition of what the product
  can and cannot represent
- this avoids reopening model debates during source-system mapping

Suggested issue buckets:

- [#328](https://github.com/gokbilge/manageCallAI/issues/328) `v0.7.4: enterprise capability baseline audit`
- [#329](https://github.com/gokbilge/manageCallAI/issues/329) `v0.7.4: explicit deferral register for vertical PBX features`
- [#330](https://github.com/gokbilge/manageCallAI/issues/330) `v0.7.4: migration-analysis readiness review`

Acceptance shape:

- the product-model boundary is explicit before mapping work begins
- deferred features are documented intentionally, not discovered ad hoc later
- `v0.8.x` can start from a stable baseline

## `v0.8.x` Migration-Analysis Slices

These should be documentation-first slices built after the enterprise model
lane closes.

### `v0.8.0` - Capability Matrix And Support Taxonomy

Focus:

- [#331](https://github.com/gokbilge/manageCallAI/issues/331) `v0.8.0: capability matrix and support taxonomy`
- [#350](https://github.com/gokbilge/manageCallAI/issues/350) source PBX capability matrix
- [#351](https://github.com/gokbilge/manageCallAI/issues/351) manageCallAI target capability model
- [#352](https://github.com/gokbilge/manageCallAI/issues/352) import support-level taxonomy
- `docs/migration/pbx-capability-gap-analysis.md`
- `docs/migration/source-system-capability-matrix.md`
- `docs/migration/import-support-levels.md`
- `docs/migration/managecallai-target-capability-model.md`
- support levels `A` through `U`

### `v0.8.1` - Open-Source PBX Mapping Set

Focus:

- [#332](https://github.com/gokbilge/manageCallAI/issues/332) `v0.8.1: open-source PBX mapping set`
- `docs/migration/freepbx-asterisk-migration-map.md`
- `docs/migration/fusionpbx-migration-map.md`
- generic CSV/manual inventory mapping inside the `#332` umbrella unless a
  separate child issue becomes necessary

### `v0.8.2` - Enterprise PBX Mapping Set

Focus:

- [#333](https://github.com/gokbilge/manageCallAI/issues/333) `v0.8.2: enterprise PBX mapping set`
- `docs/migration/cisco-cucm-migration-map.md`
- `docs/migration/avaya-aura-migration-map.md`
- `docs/migration/alcatel-omnipcx-migration-map.md`
- Mitel remains matrix-only until a separate source mapping document is justified

### `v0.8.3` - Migration Readiness Roadmap And Compatibility Report Design

Focus:

- [#334](https://github.com/gokbilge/manageCallAI/issues/334) `v0.8.3: migration readiness roadmap and compatibility report design`
- `docs/planning/migration-readiness-roadmap.md`
- compatibility-report structure
- manual-review taxonomy
- cutover/checklist/evidence expectations

## Post-`v0.8.x` Importer MVP Slices

These are implementation slices and should stay draft-only.

### Slice group 1: canonical snapshot and parser contracts

- [#335](https://github.com/gokbilge/manageCallAI/issues/335) `post-v0.8.x: canonical snapshot and parser contracts`
- canonical migration snapshot schema
- source upload/discovery object model
- parser output contracts

### Slice group 2: source adapters

- [#336](https://github.com/gokbilge/manageCallAI/issues/336) `post-v0.8.x: source adapters`
- `FreePBX` backup parsing
- `Asterisk` config parsing
- `FusionPBX` export parsing
- generic CSV ingestion

### Slice group 3: compatibility engine

- [#337](https://github.com/gokbilge/manageCallAI/issues/337) `post-v0.8.x: compatibility engine`
- support-level classification
- warnings and manual-review flags
- confidence scoring

### Slice group 4: draft importer

- [#338](https://github.com/gokbilge/manageCallAI/issues/338) `post-v0.8.x: draft importer`
- draft users/extensions/devices
- draft trunks/DIDs/routes
- unsupported custom dialplan and script detection

### Slice group 5: cutover and evidence workflow

- [#339](https://github.com/gokbilge/manageCallAI/issues/339) `post-v0.8.x: cutover and evidence workflow`
- migration plan summary
- cutover checklist
- rollback guidance
- migration evidence bundle

## Linking Releases, Slices, And Issues

Use one direction of ownership so planning stays readable:

1. release -> slice group
2. slice group -> issue buckets
3. issue bucket -> implementation PRs

Recommended rule:

- the release-train document owns release names and slice boundaries
- a slice or bucket section lists the suggested GitHub issues underneath it
- each GitHub issue links back to exactly one release bucket or slice section
- PRs close issues, not slice documents

Recommended issue-title format:

- `v0.6.3: unified numbering plan model`
- `v0.7.2: cross-object enterprise validation engine`
- `v0.8.1: FreePBX migration mapping document`

Recommended issue body fields:

- `Release:` `v0.6.3`
- `Slice:` `Numbering And Outbound Policy`
- `Planning doc:` `docs/planning/enterprise-migration-release-train.md`
- `Section:` exact heading text
- `Depends on:` prior issue numbers when relevant
- `Blocks:` later issue numbers only when a real dependency exists

Recommended slice-link style inside docs:

- use the release heading as the top-level anchor
- under each release, keep a flat list of suggested issue buckets
- when the issue exists, replace the plain bucket text with `#123`

Example:

- `v0.6.5` -> `Trunk-Group Routing`
- issues: `#305 trunk-group and route-list model`, `#306 failover-aware route simulation`, `#307 site-aware outbound carrier selection`

This keeps the mapping simple:

- one release contains several related issue buckets
- one issue belongs to one primary release bucket
- one PR may close one or more issues, but it should not redefine the slice map

## Explicit Deferrals

The following should not be treated as required pre-`v0.7.0` work unless a
separate product priority pulls them forward:

- paging and intercom
- pickup groups
- full shared-line behavior beyond foundation
- boss/secretary workflows
- operator console and attendant groups
- hotel and PMS workflows
- analog gateway inventory depth
- full call-accounting continuity
- enterprise importer adapters

These are either vertical-specific or depend on the earlier enterprise model
lane first.

## Ordering Rule

Use this execution order:

1. `v0.6.3` through `v0.6.8`: strengthen the enterprise product model
2. `v0.7.0` through `v0.7.4`: stabilize and productize that stronger model
3. `v0.8.x`: produce migration-analysis and mapping documents against that model
4. post-`v0.8.x`: build importer and migration-assistant workflows

This keeps the product model in control of migration behavior instead of letting
import requirements distort the core architecture.

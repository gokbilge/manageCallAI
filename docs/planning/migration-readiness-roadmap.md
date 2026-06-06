# Migration Readiness Roadmap

Last updated: 2026-06-06.

## Purpose

This roadmap defines the missing PBX migration/adoption toolkit as a staged,
evidence-based planning lane.

The migration lane must stay subordinate to the core control-plane model:

- source discovery
- compatibility analysis
- draft import
- validation and simulation
- operator approval
- cutover checklist
- runtime smoke
- rollback evidence

The importer must not auto-publish live objects or execute source custom logic.

## Epic A - Migration Readiness Gap Analysis

Goal:

Define what manageCallAI can safely represent and what source PBX systems can
export, before importer implementation begins.

Scope:

- capability matrix
- support-level taxonomy
- source-specific mapping docs
- target-model capability inventory
- readiness roadmap and release placement

Primary releases:

- `v0.7.x` planning and backlog preparation only
- `v0.8.0` through `v0.8.3` for the documentation lane

Depends on:

- enterprise model stabilization in `#316` through `#330`

Issue linkage:

- Epic [#348](https://github.com/gokbilge/manageCallAI/issues/348)
- [#350](https://github.com/gokbilge/manageCallAI/issues/350) source PBX capability matrix
- [#351](https://github.com/gokbilge/manageCallAI/issues/351) manageCallAI target capability model
- [#352](https://github.com/gokbilge/manageCallAI/issues/352) import support-level taxonomy
- [#353](https://github.com/gokbilge/manageCallAI/issues/353) FreePBX/Asterisk migration map
- [#354](https://github.com/gokbilge/manageCallAI/issues/354) FusionPBX migration map
- [#355](https://github.com/gokbilge/manageCallAI/issues/355) Cisco CUCM migration map
- [#356](https://github.com/gokbilge/manageCallAI/issues/356) Avaya Aura migration map
- [#357](https://github.com/gokbilge/manageCallAI/issues/357) Alcatel OmniPCX migration map
- [#358](https://github.com/gokbilge/manageCallAI/issues/358) migration readiness roadmap

## Epic B - PBX Migration Assistant MVP

Goal:

Build a safe, draft-only importer that produces normalized snapshots,
compatibility reports, draft manageCallAI objects, validation/simulation
results, cutover checklists, and migration evidence.

Scope:

- canonical migration snapshot
- discovery and parser designs
- compatibility report design
- draft import workflow
- unsupported custom logic detection
- cutover and rollback checklist
- evidence bundle
- migration wizard UI
- migration security model

Primary releases:

- post-`v0.8.x` for implementation
- `v0.9.x` or later for enterprise source adapters that need deeper product work

Issue linkage:

- Epic [#349](https://github.com/gokbilge/manageCallAI/issues/349)
- [#359](https://github.com/gokbilge/manageCallAI/issues/359) canonical migration snapshot schema
- [#360](https://github.com/gokbilge/manageCallAI/issues/360) FreePBX/Asterisk discovery script design
- [#361](https://github.com/gokbilge/manageCallAI/issues/361) FreePBX backup parser design
- [#362](https://github.com/gokbilge/manageCallAI/issues/362) FusionPBX export parser design
- [#363](https://github.com/gokbilge/manageCallAI/issues/363) migration compatibility report design
- [#364](https://github.com/gokbilge/manageCallAI/issues/364) draft import workflow
- [#365](https://github.com/gokbilge/manageCallAI/issues/365) unsupported custom logic detection
- [#366](https://github.com/gokbilge/manageCallAI/issues/366) cutover and rollback checklist
- [#367](https://github.com/gokbilge/manageCallAI/issues/367) migration evidence bundle
- [#368](https://github.com/gokbilge/manageCallAI/issues/368) migration wizard UI
- [#369](https://github.com/gokbilge/manageCallAI/issues/369) migration assistant security model

## Release Suggestions

| Release lane | Recommended contents |
| --- | --- |
| `v0.7.x` | enterprise model stabilization and migration planning only |
| `v0.8.0` | capability matrix, target model, support taxonomy |
| `v0.8.1` | open-source PBX mapping docs |
| `v0.8.2` | enterprise PBX mapping docs |
| `v0.8.3` | migration readiness roadmap, compatibility-report design, cutover/evidence planning docs |
| post-`v0.8.x` | canonical snapshot, adapters, compatibility engine, draft importer, wizard, evidence workflow |
| `v0.9.x` | deeper enterprise adapters and product-model follow-ons if justified |

## Roadmap Overload Note

`v0.7.0` contact-center is already broad. Migration readiness should run as a
parallel planning track or be scheduled after the `v0.7` enterprise-model
foundation.

The PBX Migration Assistant MVP should not be squeezed into `v0.7.0` unless
the contact-center scope is reduced materially.

Recommended contact-center split:

```text
v0.7.0 - contact-center foundation
v0.7.1 - supervisor quality/live controls
v0.7.2 or v0.8 - CRM/campaigns/integration expansion
```

## Planning Documents

- [`../migration/pbx-capability-gap-analysis.md`](../migration/pbx-capability-gap-analysis.md)
- [`../migration/source-system-capability-matrix.md`](../migration/source-system-capability-matrix.md)
- [`../migration/managecallai-target-capability-model.md`](../migration/managecallai-target-capability-model.md)
- [`../migration/import-support-levels.md`](../migration/import-support-levels.md)
- source mapping docs under `docs/migration/`

## Architecture Rule

The PBX Migration Assistant must remain a safe adoption tool. It may analyze,
map, classify, draft, validate, simulate, and guide cutover with evidence. It
must not automatically convert unknown source behavior into live production
routing.

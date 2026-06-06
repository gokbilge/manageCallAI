# PBX Capability Gap Analysis for Migration Readiness

## Purpose

This document defines the capability gap analysis required before building the manageCallAI PBX Migration Assistant.

The goal is to understand which capabilities from existing PBX systems can be safely represented in manageCallAI, which capabilities need additional modeling, and which source-system features must be flagged for manual review during migration.

Migration must not be treated as a simple import operation.

A safe migration flow should be:

```text
Source PBX discovery
  → Capability analysis
  → Compatibility report
  → Draft manageCallAI objects
  → Validation and simulation
  → Operator review
  → Staged publish
  → Runtime smoke test
  → Cutover and rollback evidence
```

The strategic objective is:

```text
Make manageCallAI capable enough to represent 80–90% of common PBX configurations,
then build importers that safely convert what is supported and clearly flag the rest.
```

---

# 1. Why Gap Analysis Comes First

Before creating import tools for FreePBX, Asterisk, FusionPBX, Cisco CUCM, Avaya, Alcatel, Mitel, or other PBX systems, manageCallAI must define its own target capability model.

If manageCallAI cannot model a source feature, the importer has only unsafe choices:

```text
ignore it
import it incorrectly
flatten it into a weak approximation
create unsafe routing behavior
```

For telecom systems, this is dangerous.

A small migration mistake can break:

```text
emergency routing
business-hours routing
queue behavior
hunt groups
outbound permissions
carrier failover
call recording policies
voicemail routing
site-specific dialing
```

Therefore, the importer should not drive the product model.

The product model must be strong enough that migration becomes safe.

---

# 2. Source Systems to Analyze

The migration readiness analysis should compare manageCallAI against both open-source PBX systems and enterprise PBX platforms.

## Open-source / software PBX systems

```text
FreePBX
Asterisk raw configuration
FusionPBX
Issabel
```

## Enterprise PBX systems

```text
Cisco CUCM / CallManager
Avaya Aura
Alcatel OmniPCX
Mitel
NEC
Panasonic
Unify / OpenScape
Ericsson-LG
```

## Generic migration sources

```text
CSV export
Excel inventory
SIP trunk inventory
CDR export
Phone/device inventory
Manual migration template
```

---

# 3. Capability Matrix

The first deliverable should be a capability matrix comparing source PBX features with manageCallAI’s current target model.

## Example Matrix

| Capability             | FreePBX |              Cisco CUCM |       Avaya |        Alcatel |    manageCallAI Today | Gap                             |
| ---------------------- | ------: | ----------------------: | ----------: | -------------: | --------------------: | ------------------------------- |
| Extensions             |     Yes |                     Yes |         Yes |            Yes |                   Yes | None                            |
| Users                  |     Yes |                     Yes |         Yes |            Yes |                   Yes | User/device mapping needed      |
| SIP trunks             |     Yes |                     Yes |         Yes |            Yes |                   Yes | Source-specific mapping         |
| Inbound routes         |     Yes |                     Yes |         Yes |            Yes |                   Yes | Terminology mapping             |
| Outbound routes        |     Yes |                     Yes |         Yes |            Yes |                   Yes | Policy mapping                  |
| DIDs                   |     Yes |                     Yes |         Yes |            Yes |                   Yes | Range import needed             |
| IVR / Auto-attendant   |     Yes |                 Partial |     Vectors | Auto-attendant |                   Yes | Source-specific converter       |
| Hunt / ring groups     |     Yes | Hunt pilot / line group |  Hunt group |          Group |           Call groups | Mapping needed                  |
| Queues                 |     Yes |  UCCX / queue depending |         Yes |            Yes |                   Yes | Advanced queue strategy gaps    |
| Voicemail              |     Yes |    Unity often separate |         Yes |            Yes |                   Yes | External voicemail source issue |
| Feature codes          |     Yes |                     Yes |         Yes |            Yes |                   Yes | Mapping needed                  |
| Call parking           |     Yes |                     Yes |         Yes |            Yes |                   Yes | Lot/slot mapping                |
| Conferencing           |     Yes |                     Yes |         Yes |            Yes |                   Yes | Policy mapping                  |
| Time conditions        |     Yes |          Time schedules |   Schedules |      Schedules |                   Yes | Advanced schedule model needed  |
| Emergency routing      |     Yes |    Route patterns / CSS |         ARS |            ARS |    Partial safeguards | Needs stronger model            |
| Device provisioning    | Partial |                  Strong |      Strong |         Strong |              Emerging | Gap                             |
| User/device separation | Partial |                  Strong |      Strong |         Strong |               Partial | Important gap                   |
| Partitions / CSS       |      No |                     Yes |          No |             No |  No direct equivalent | Major Cisco gap                 |
| Class of service       | Partial |                     Yes |         Yes |            Yes | Fraud/outbound policy | Needs model expansion           |
| Route lists / groups   |     Yes |                     Yes |         Yes |            Yes |               Partial | Gap                             |
| Carrier failover       |     Yes |                     Yes |         Yes |            Yes |               Partial | Gap                             |
| Analog gateways        | Partial |                     Yes |         Yes |            Yes |               Limited | Gap                             |
| Paging / intercom      |     Yes |                     Yes |         Yes |            Yes |     Missing / partial | Gap                             |
| Boss / secretary       |  Add-on |                     Yes |         Yes |            Yes |               Missing | Enterprise gap                  |
| Hotel / PMS            |  Add-on |               Sometimes |      Common |         Common |               Missing | Vertical gap                    |
| Call accounting        | Partial |                     Yes |         Yes |            Yes |         CDR/reporting | Needs reports                   |
| Contact center         | Partial |              UCCX / CCE | Elite / ACC |            Yes |          v0.7 planned | Gap                             |

---

# 4. Required manageCallAI Target Capabilities

The following capabilities should be added or strengthened before serious migration tooling is built.

---

## 4.1 P0 Capabilities Required Before Trusted Import

These are core capabilities needed to safely import from enterprise and mature PBX systems.

---

## A. Unified Numbering Plan Model

Enterprise PBXs often use complex numbering plans.

manageCallAI should support a first-class numbering plan model.

### Required concepts

```text
extension ranges
DID ranges
internal prefixes
external prefixes
emergency numbers
site codes
branch codes
country rules
area-code rules
blocked prefixes
special service codes
feature code ranges
international dialing rules
premium-rate blocking
```

### Suggested objects

```text
numbering_plans
numbering_plan_rules
numbering_plan_assignments
```

### Why this matters

This is required for importing:

```text
Cisco route patterns
Avaya ARS rules
Alcatel numbering plans
FreePBX outbound prefixes
FusionPBX dialplan rules
```

Without this model, route imports become fragile and difficult to validate.

---

## B. Class of Service / Calling Policy

Most enterprise PBXs model who can call what.

This appears under different names:

```text
Cisco CSS / Partition
Avaya COR / COS
Alcatel barring categories
Mitel class of restriction
FreePBX route permissions
```

manageCallAI currently has fraud/outbound policy concepts, but migration needs a richer calling-policy abstraction.

### Required concepts

```text
local calling
national calling
mobile calling
international calling
premium-rate blocking
site-based permissions
department-level permissions
after-hours restrictions
emergency exceptions
tenant default policy
extension-specific policy
device-specific policy
```

### Suggested objects

```text
calling_policies
calling_policy_rules
extension_calling_policy_assignments
device_calling_policy_assignments
```

### Why this matters

Without a calling-policy model, enterprise imports from Cisco, Avaya, Alcatel, and Mitel cannot safely preserve outbound restrictions.

---

## C. Site / Location Model

Enterprise PBXs are usually site-aware.

manageCallAI should model sites and locations explicitly.

### Required concepts

```text
site
building
floor
room
network zone
timezone
language
default emergency location
default outbound trunk group
local breakout policy
music-on-hold profile
local dial rules
NAT/media assumptions
```

### Suggested objects

```text
sites
locations
network_zones
site_dialing_rules
site_emergency_policies
```

### Why this matters

Site modeling affects:

```text
emergency routing
local breakout
branch-office dialing
multi-country tenants
NAT/media planning
default language
business hours
```

---

## D. User / Extension / Device Separation

Enterprise systems separate people, extensions, phones, and line appearances.

manageCallAI should clearly separate:

```text
person/user
extension
device/phone
line appearance
SIP credential
registration
```

### Suggested objects

```text
users
extensions
devices
device_credentials
line_appearances
registrations
```

### Why this matters

This is essential for Cisco migration.

Cisco often separates:

```text
End User
Directory Number
Device
Line Appearance
Device Profile
```

A flat extension-only model cannot safely represent this.

---

## E. Route Groups and Trunk Groups

Enterprise PBXs rarely route directly to one trunk.

They commonly use:

```text
route group
route list
trunk group
failover order
load balancing
carrier priority
site-based carrier selection
```

### Suggested objects

```text
trunk_groups
trunk_group_members
route_lists
route_failover_policies
```

### Why this matters

This improves:

```text
carrier failover
migration coverage
production reliability
least-cost routing
site-specific trunk routing
```

---

## F. Advanced Schedule / Holiday / Override Model

Basic business hours are not enough for enterprise migration.

### Required concepts

```text
holidays
special closures
recurring schedules
schedule exceptions
temporary override
per-site timezone
emergency closure mode
weather closure mode
manual override with expiry
```

### Suggested objects

```text
schedule_groups
schedule_rules
holiday_calendars
schedule_overrides
```

### Why this matters

FreePBX, Cisco, Avaya, Alcatel, and Mitel systems often contain complex time-based routing rules.

---

# 5. P1 Capabilities for Better Migration Coverage

These are important for high migration coverage but may not block the first import MVP.

---

## A. Paging / Intercom

Common in:

```text
offices
schools
warehouses
hospitals
factories
hotels
government buildings
```

### Suggested objects

```text
paging_groups
paging_group_members
intercom_permissions
multicast_paging_profiles
```

---

## B. Pickup Groups

Common PBX feature.

### Suggested objects

```text
pickup_groups
pickup_group_memberships
```

---

## C. Shared Line / Multiple Line Appearance

Important for Cisco-style systems and executive/admin workflows.

### Suggested objects

```text
shared_lines
line_appearances
device_button_layouts
```

This is a larger enterprise feature but valuable for Cisco migration.

---

## D. Music on Hold Profiles

Needed for:

```text
queues
parking
hold
departments
sites
tenants
```

### Suggested objects

```text
music_on_hold_profiles
music_on_hold_assets
```

---

## E. Announcement Objects

Many PBXs use announcement objects in IVRs, queues, and time conditions.

### Suggested objects

```text
announcements
announcement_prompts
announcement_actions
```

---

## F. Call Accounting / Cost Reporting

Enterprise migrations often require reporting continuity.

### Suggested objects

```text
cdr_imports
billing_codes
cost_centers
department_call_reports
call_cost_rules
```

---

## G. Operator Console / Attendant Groups

Useful in enterprise, hotel, government, and campus environments.

### Suggested objects

```text
operator_groups
attendant_console_views
operator_queue_assignments
```

---

# 6. P2 Vertical-Specific Capabilities

These are not required for every migration, but they are valuable for enterprise and vertical sales.

```text
hotel / PMS integration
wake-up calls
room status
boss / secretary features
fax / T.38
analog gateway inventory
E911 location management
compliance recording policies
multi-language IVR prompts
multi-tenant branding
billing / reseller hierarchy
department-based reporting
campus paging
emergency notification groups
```

For Alcatel and Mitel migrations, hotel/PMS support may be especially important.

---

# 7. Import Support Levels

Every source object discovered by a migration adapter should be classified into one of these support levels.

## Level A — Exact Support

The source feature maps directly into manageCallAI.

Example:

```text
FreePBX extension
  → manageCallAI extension
```

## Level B — Equivalent Support

The target model differs, but behavior can be preserved.

Example:

```text
FreePBX ring group
  → manageCallAI call group
```

## Level C — Approximate Support

The importer can migrate with a warning.

Example:

```text
Cisco route pattern + CSS
  → outbound route + calling policy
```

## Level D — Manual Review Required

The importer can detect the object but cannot safely convert it.

Examples:

```text
custom Asterisk AGI script
Cisco complex transformation pattern
Avaya vector with external database dip
Alcatel hotel/PMS workflow
```

## Level E — Unsupported

There is no manageCallAI equivalent yet.

Examples:

```text
proprietary digital phone button templates
legacy operator console
hotel room-state workflow
complex analog gateway behavior
```

---

# 8. Source-System Mapping Priorities

## Phase 1 — Open-source and software PBX

```text
FreePBX
Asterisk raw config
FusionPBX
Generic CSV
```

### Reason

These systems are easier to inspect, export, and map.

They also align with manageCallAI’s self-hosted and FreeSWITCH-oriented audience.

---

## Phase 2 — Enterprise PBX

```text
Cisco CUCM
Avaya Aura
Mitel
```

### Reason

These represent larger migration opportunities but require richer models.

---

## Phase 3 — Specialized and vertical PBX

```text
Alcatel OmniPCX
NEC
Panasonic
Ericsson-LG
Unify / OpenScape
```

### Reason

These may require vertical-specific models, especially for hospitality, campus, analog, and operator-console workflows.

---

# 9. Recommended Documentation Deliverables

Before coding the importer, create the following documents.

```text
docs/migration/pbx-capability-gap-analysis.md
docs/migration/source-system-capability-matrix.md
docs/migration/managecallai-target-capability-model.md
docs/migration/freepbx-migration-map.md
docs/migration/asterisk-migration-map.md
docs/migration/fusionpbx-migration-map.md
docs/migration/cisco-cucm-migration-map.md
docs/migration/avaya-migration-map.md
docs/migration/alcatel-migration-map.md
docs/migration/import-support-levels.md
docs/planning/migration-readiness-roadmap.md
```

---

# 10. Recommended Migration Architecture

After the capability gap analysis, the importer should be built using a staged architecture.

```text
Source Adapter
  FreePBXAdapter
  AsteriskAdapter
  FusionPBXAdapter
  CiscoCucmAdapter
  AvayaAdapter
  AlcatelAdapter
  GenericCsvAdapter

Canonical Migration Snapshot
  users
  extensions
  devices
  routes
  trunks
  schedules
  ivrs
  queues
  policies
  unsupported_items

Mapping Engine
  source object → manageCallAI target object
  confidence score
  warnings
  manual review flag

Draft Importer
  creates draft objects only

Validation Engine
  route conflict
  emergency conflict
  unsupported behavior
  missing trunk
  missing prompt
  missing device
  site mismatch
  calling-policy mismatch

Cutover Planner
  staged migration
  smoke tests
  rollback plan
  operator signoff
  evidence bundle
```

---

# 11. Migration Flow

The import process should be safe and reviewable.

```text
1. Create migration source
2. Upload backup, export, CSV, or discovery JSON
3. Parse source inventory
4. Generate normalized migration snapshot
5. Run capability mapping
6. Produce compatibility report
7. Generate draft manageCallAI objects
8. Validate drafts
9. Simulate routes and IVR paths
10. Flag manual review items
11. Operator approves migration plan
12. Publish selected objects
13. Run runtime smoke tests
14. Execute cutover checklist
15. Store migration evidence bundle
```

---

# 12. Migration Compatibility Report

The report should summarize what can and cannot be migrated.

## Example output

```text
Migration Readiness: 82%

Safe to auto-migrate:
- 93 extensions
- 5 trunks
- 14 inbound routes
- 9 outbound routes
- 4 ring groups

Migratable with warnings:
- 3 IVRs using custom destinations
- 2 queues using advanced penalty logic
- 1 outbound route overlaps emergency pattern

Manual review required:
- 4 custom dialplan blocks
- 1 Avaya vector with external database dip
- 2 Cisco CSS mappings with ambiguous policy behavior

Unsupported:
- Fax module
- DISA
- custom AGI scripts
- proprietary digital phone button templates

Recommended cutover:
- migrate users, devices, and extensions first
- import trunks as disabled
- test internal calls
- test outbound via secondary trunk
- migrate one DID
- run smoke tests
- migrate remaining DIDs
```

---

# 13. Migration Safety Rules

The importer must follow these rules.

```text
Never write directly to active production state.
Never auto-publish imported routes.
Never auto-enable trunks without operator approval.
Never auto-convert emergency routing without explicit validation.
Never silently drop unsupported source features.
Never expose imported SIP passwords after creation.
Never execute raw source dialplan or scripts.
Never import custom AGI/macros as executable code.
Always create audit events.
Always keep source metadata and mapping confidence.
Always provide rollback guidance.
```

---

# 14. AI-Assisted Migration

AI can be valuable, but it must remain advisory.

## Good AI uses

```text
suggest mapping for unclear source objects
summarize unsupported source behavior
explain Cisco CSS / partition mappings
propose outbound route policies
detect likely fraud-policy gaps
summarize custom dialplan intent
generate migration report text
generate cutover checklist
```

## Unsafe AI uses

```text
auto-publish imported routes
auto-enable trunks
auto-edit emergency routing
auto-run raw FreeSWITCH or Asterisk commands
auto-convert unknown custom dialplan into executable logic
```

## Required controls

```text
confidence score
operator approval
audit trail
source-object reference
human-readable explanation
manual review flag
no autonomous runtime mutation
```

---

# 15. Roadmap Recommendation

## Epic: Migration Readiness Gap Analysis

Child issues:

```text
1. Define source PBX capability matrix
2. Define manageCallAI target capability model
3. Add numbering plan model
4. Add site/location model
5. Add class-of-service/calling-policy model
6. Add user/extension/device separation model
7. Add trunk group and route-list model
8. Add advanced schedule/holiday/override model
9. Add pickup group and paging/intercom model
10. Add import support level taxonomy
11. Create FreePBX mapping document
12. Create Asterisk mapping document
13. Create FusionPBX mapping document
14. Create Cisco CUCM mapping document
15. Create Avaya mapping document
16. Create Alcatel mapping document
17. Create migration readiness roadmap
```

---

## Epic: PBX Migration Assistant MVP

Child issues:

```text
1. Define canonical migration snapshot schema
2. Build FreePBX/Asterisk discovery script
3. Parse FreePBX backup archive
4. Parse Asterisk config files
5. Parse FusionPBX PostgreSQL export
6. Generate compatibility report
7. Draft-import extensions and users
8. Draft-import SIP trunks and DIDs
9. Draft-import inbound/outbound routes
10. Draft-import ring groups and queues
11. Draft-import voicemail boxes and feature codes
12. Detect unsupported custom dialplan, AGI, macros, and proprietary features
13. Generate cutover and rollback checklist
14. Add migration evidence bundle
15. Add UI migration wizard
```

---

# 16. Strategic Value

This gap analysis supports two major goals.

## 1. Higher migration coverage

Instead of saying:

```text
We can import extensions and trunks.
```

manageCallAI can say:

```text
We understand your old PBX model, show what maps, show what does not, and help you safely modernize.
```

## 2. Stronger core product

The gap analysis forces manageCallAI to become more enterprise-ready:

```text
multi-site
class of service
route groups
device model
advanced schedules
emergency routing
call accounting
operator workflows
migration evidence
```

These are not only migration features.

They strengthen the core product and make manageCallAI more competitive against:

```text
FreePBX
FusionPBX
3CX
Cisco CUCM
Avaya
Alcatel
Mitel
traditional PBX modernization projects
```

---

# 17. Final Recommendation

Do not build the importer first.

First build the capability gap analysis and target model.

The recommended order is:

```text
1. PBX capability gap analysis
2. manageCallAI target capability model
3. source-system mapping documents
4. missing target capabilities
5. canonical migration snapshot schema
6. migration assistant MVP
7. runtime migration evidence gates
```

The Migration Assistant should become a safe adoption tool, not a risky automatic converter.

The final product promise should be:

```text
Bring your existing PBX system.
manageCallAI will analyze it, map what is safe, flag what needs review,
create draft objects, validate routes, simulate call flows, and guide cutover with evidence and rollback.
```

---

# 18. Release Phasing Note

This document describes the strategic gap and migration architecture, but it
should not be implemented as one continuous release lane.

The execution split should be:

## Pre-`v0.7.0`

Only enterprise product-model expansion:

```text
v0.6.3 numbering and calling policy (#300, #301, #302)
v0.6.4 site and location core (#303, #304)
v0.6.5 trunk-group routing (#305, #306, #307)
v0.6.6 people, extensions, and devices (#308, #309, #310)
v0.6.7 enterprise schedules (#311, #312, #313)
v0.6.8 line appearance foundation (#314, #315)
v0.7.0-v0.7.4 stabilization and productization (#316-#330)
```

## `v0.8.x`

Migration-analysis and mapping documentation slices:

```text
capability matrix and support taxonomy (#331)
open-source PBX mapping docs (#332)
enterprise PBX mapping docs (#333)
migration-readiness roadmap and compatibility-report structure (#334)
```

## Post-`v0.8.x`

Importer and migration-assistant implementation slices:

```text
canonical migration snapshot (#335)
source adapters (#336)
compatibility engine (#337)
draft importer (#338)
cutover and evidence workflow (#339)
```

Detailed release, slice, and issue-bucket planning lives in:

```text
docs/planning/enterprise-migration-release-train.md
```

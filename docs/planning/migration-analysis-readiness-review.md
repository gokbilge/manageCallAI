# Migration-Analysis Readiness Review

Release: v0.7.4
Last updated: 2026-06-07

Planning doc: `docs/planning/enterprise-migration-release-train.md`
Section: `v0.7.4` - Enterprise Baseline Close-Out

Closes: #330

---

## Purpose

This review evaluates whether the enterprise product model is stable enough to
begin the v0.8.x migration-analysis and documentation lane.

It is a go/no-go gate, not a technical implementation document.

---

## Review Criteria

The v0.8.x lane requires the following to be true before documentation work begins:

1. All planned enterprise objects have coherent lifecycle coverage.
2. The product-model boundary is explicit - what can and cannot be represented is
   documented.
3. Deferred features are recorded intentionally so they do not surface as surprises
   during source-system mapping.
4. The API surface is stable enough that migration documentation will not be
   invalidated by near-term model changes.
5. v0.7.x stabilization targets are complete.

---

## Findings Against Each Criterion

### 1. Lifecycle coverage completeness

**Finding: PASS**

All six enterprise object types introduced in v0.6.3-v0.6.8 have full lifecycle
coverage:

- trunk groups and route lists
- calling policies
- numbering plans
- sites and locations
- schedules and holiday calendars
- line appearances

Each has: draft/validate/simulate/publish/rollback, approval gate, audit trail,
and version snapshots.

Details: `docs/planning/enterprise-capability-baseline-audit.md`

---

### 2. Product-model boundary documentation

**Finding: PASS**

The capability baseline audit (`enterprise-capability-baseline-audit.md`) and
deferral register (`enterprise-deferral-register.md`) document:

- which objects exist with full lifecycle
- which enterprise and vertical behaviors remain deferred
- what migration docs may safely claim without over-promising parity

Source-system capability mapping can proceed against the existing API surface.

---

### 3. Explicit deferral register

**Finding: PASS**

The deferral register records:

- 10 explicitly deferred features with rationale and go-forward targets
- confirmation that none of the deferrals block v0.8.x documentation work

No deferred feature would cause a v0.8.x analysis document to be invalidated.

---

### 4. API surface stability

**Finding: PASS with qualification**

The enterprise object APIs (CRUD, lifecycle, versioning) are stable and covered
by:

- OpenAPI specification in `docs/api/openapi.yaml`
- Contract tests in `pnpm db:contracts`
- SDK types in `packages/sdk`
- MCP schema checks in `pnpm check:mcp-schemas`

Migration documentation written against the current API surface should remain
valid. Later importer work may add new contracts, but it should not revise the
core enterprise object semantics already established in `#300` through `#330`.

---

### 5. v0.7.x stabilization prerequisites

**Finding: PASS**

- v0.7.0 carrier interop, soak/SLO, and rotation rehearsal evidence: complete (#316, #317, #318)
- v0.7.1 lifecycle parity across all enterprise objects: complete (#319, #320, #321)
- v0.7.2 validation and simulation depth: complete (#322, #323, #324)
- v0.7.3 operator and admin productization: complete (#325, #326, #327)
- v0.7.4 baseline audit, deferrals, and readiness review: complete (#328, #329, #330)

The migration-analysis lane no longer depends on unfinished v0.7.x work.

---

## Go/No-Go Decision

**Decision: GO**

The enterprise product model is stable enough to begin v0.8.x migration-analysis
and documentation work.

Rationale:

- All six enterprise object types are representable and lifecycle-safe.
- The model boundary is explicit; deferred features are documented.
- The API surface is stable enough for documentation-first migration analysis.
- The full `#316` through `#330` stabilization set is complete.

---

## Recommended v0.8.x Sequence

To start migration analysis from a strong baseline:

1. **v0.8.0** - Capability matrix, target model, and support taxonomy
   - Map source-PBX capabilities against the enterprise object inventory
   - Define support levels `A`, `B`, `C`, `D`, `E`, and `U`
   - Issues: #331, #350, #351, #352

2. **v0.8.1** - Open-source PBX mapping set
   - FreePBX/Asterisk migration map
   - FusionPBX migration map
   - Generic CSV/manual inventory guidance
   - Issue: #332

3. **v0.8.2** - Enterprise PBX mapping set
   - Cisco CUCM, Avaya Aura, Alcatel OmniPCX migration maps
   - Mitel remains matrix-only unless dedicated source research is justified
   - Issue: #333

4. **v0.8.3** - Migration readiness roadmap and compatibility report design
   - Compatibility report structure
   - Manual-review taxonomy
   - Cutover/checklist/evidence expectations
   - Issues: #334 and #358

---

## Caveats

- If a source-system mapping identifies a model gap, track it as a new issue in
  the appropriate documentation or importer lane instead of weakening the
  current control-plane boundary.
- The importer lane must still remain draft-only and evidence-driven even after
  the documentation slices are complete.

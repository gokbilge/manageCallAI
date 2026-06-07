# Migration-Analysis Readiness Review

Release: v0.7.4
Last updated: 2026-06-07

Planning doc: `docs/planning/enterprise-migration-release-train.md`
Section: `v0.7.4` – Enterprise Baseline Close-Out

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
2. The product-model boundary is explicit — what can and cannot be represented is
   documented.
3. Deferred features are recorded intentionally so they do not surface as surprises
   during source-system mapping.
4. The API surface is stable enough that migration documentation will not be
   invalidated by near-term model changes.
5. v0.7.x stabilization targets (v0.7.0 evidence, v0.7.1 lifecycle parity) are
   complete.

---

## Findings Against Each Criterion

### 1. Lifecycle coverage completeness

**Finding: PASS**

All six enterprise object types introduced in v0.6.3–v0.6.8 have full lifecycle
coverage as of v0.7.1:

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

The capability baseline audit (`enterprise-capability-baseline-audit.md`) documents:

- which objects exist with full lifecycle
- what cross-object work is still in flight (v0.7.2 target)
- what operator UX work is still in flight (v0.7.3 target)

Neither of the in-flight items affects the representational completeness of the
model. Source-system capability mapping can proceed against the existing API surface.

---

### 3. Explicit deferral register

**Finding: PASS**

The deferral register (`enterprise-deferral-register.md`) records:

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

The planned v0.7.2 cross-object validation and v0.7.3 UX work may add fields
and endpoints but will not change existing object schemas or lifecycle semantics.
Migration documentation written against the current API surface will remain valid.

---

### 5. v0.7.x stabilization prerequisites

**Finding: PASS**

- v0.7.0 carrier interop, soak/SLO, and rotation rehearsal evidence: complete (#316, #317, #318)
- v0.7.1 lifecycle parity across all enterprise objects: complete (#319, #320, #321)

v0.7.2 (validation depth) and v0.7.3 (operator UX) are in flight but not
required before the v0.8.x documentation lane begins.

---

## Go/No-Go Decision

**Decision: GO**

The enterprise product model is stable enough to begin v0.8.x migration-analysis
and documentation work.

Rationale:

- All six enterprise object types are representable and lifecycle-safe.
- The model boundary is explicit; deferred features are documented.
- The API surface is stable; near-term v0.7.x work will not invalidate analysis.
- v0.7.0 and v0.7.1 stabilization work is complete.

---

## Recommended v0.8.x Sequence

To start migration analysis from a strong baseline:

1. **v0.8.0** – Capability matrix and support taxonomy
   - Map source-PBX capabilities against the enterprise object inventory
   - Define support levels (A = full, B = partial, C = manual, U = unsupported)
   - Issue: #331

2. **v0.8.1** – Open-source PBX mapping set
   - FreePBX/Asterisk migration map
   - FusionPBX migration map
   - Issues: #332

3. **v0.8.2** – Enterprise PBX mapping set
   - Cisco CUCM, Avaya Aura, Alcatel OmniPCX migration maps
   - Issues: #333

4. **v0.8.3** – Migration readiness roadmap and compatibility report design
   - Compatibility report structure
   - Manual-review taxonomy
   - Cutover/checklist/evidence expectations
   - Issues: #334

---

## Caveats

- v0.7.2 and v0.7.3 work SHOULD be completed in parallel with v0.8.x documentation.
  The analysis lane does not wait for them, but the product should not enter a
  freeze that prevents v0.7.x completion.
- If a source-system mapping identifies a model gap that requires a v0.7.x fix,
  that should be tracked as a new issue against the appropriate v0.7.x release,
  not backported into the v0.8.x documentation.

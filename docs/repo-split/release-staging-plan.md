# Release Staging Plan

Last updated: 2026-06-07.

This document defines the staged public release plan for the open-core
repository split. Each release is scoped to what can be published publicly at
that stage without leaking private implementation.

---

## Release 1 — v0.7.5-public-core-prep ✓ (in progress)

**Target:** Public repo `main`
**Status:** Partially shipped (entitlement foundation merged)

**Scope:**
- Public open-core documentation (`docs/commercial/`, `docs/repo-split/`)
- Free/Pro/Enterprise distribution profiles (`docker-compose.free.yml` etc.)
- Entitlement foundation — migration 0077, `EntitlementService`, limit enforcement in 16 controllers
- Module boundary interfaces (`packages/contracts/src/commercial/module-boundary.ts`)
- Schema boundary guard script (`scripts/check-public-schema-boundary.mjs`)
- Private schema boundary docs
- Public export scripts (`scripts/export-public-core.mjs`, `scripts/check-public-export.mjs`)
- Repository split docs (this directory)

**What is NOT included:**
- Any private module implementation
- License service
- Signing keys

**Acceptance gates:**
- [ ] All repo-split docs committed
- [ ] Export script runs without errors on current public tree
- [ ] Check script finds zero violations on current public tree
- [ ] Build and tests pass

---

## Release 2 — v0.7.6-public-usage-metering

**Target:** Public repo
**Status:** Planned

**Scope:**
- Public usage metering API (`GET /api/v1/commercial/usage`)
- Storage and AI monthly counter recording in existing call paths
- Usage display in web UI (plan badge, usage meters, limit warnings)
- Public usage counter documentation
- Usage metering tests

**What is NOT included:**
- Paid usage webhook delivery (commercial repo)
- Billing export (commercial repo)
- Advanced analytics (commercial repo)

**Acceptance gates:**
- Monthly counters increment correctly for AI and call events
- Usage UI shows current plan and meter states
- All public checks pass

---

## Release 3 — v0.8.0-private-module-ready

**Target:** Public repo + internal monorepo
**Status:** Planned

**Scope (public repo):**
- Stable public module loading interface (`ManageCallAIModule` is settled)
- `ModuleApiContext` with documented extension points
- Public module registry (`registered_modules` table if needed)
- Published public interfaces for private module discovery
- `PrivateSchemaModuleDescriptor` interface is stable and exported

**Scope (internal monorepo):**
- Internal monorepo diverges from public repo: add internal-only dirs
- Publish scripts production-ready
- Commercial repo skeleton initialized (empty, with README)
- Enterprise repo skeleton initialized (empty, with README)

**What is NOT included:**
- Any private module code
- License service

**Acceptance gates:**
- Public module interface is backwards-compatible
- Export + validation scripts pass cleanly
- Internal and public repos remain in sync on core code

---

## Release 4 — v0.8.x-commercial-preview

**Target:** Internal monorepo + commercial private repo
**Status:** Planned (private only — no public release content beyond interfaces)

**Scope (commercial private repo):**
- First private commercial module skeleton
- Commercial schema migration `0001_commercial_schema_init.sql`
- Module descriptor registered via `PrivateSchemaModuleDescriptor`
- Pro entitlement check wired to first commercial feature

**Scope (public repo, if any):**
- Updated public release notes mentioning Pro commercial preview
- No implementation leaks to public

**Status gate:**
- License-service repo initialized with key management docs
- Test signing key (clearly labeled) created for staging
- Pro module can load in internal monorepo and register its capabilities

---

## Release 5 — v0.9.x-enterprise-preview

**Target:** Internal monorepo + enterprise private repo
**Status:** Planned (private only)

**Scope (enterprise private repo):**
- SSO module skeleton (SAML, OIDC)
- Migration assistant skeleton (CUCM importer scaffold)
- Enterprise schema migration `0001_enterprise_schema_init.sql`
- Legal hold module integrated with public `legal_hold_requests` table

**Scope (public repo):**
- Updated public interfaces for enterprise extension points
- Enterprise deployment guide updated

**Status gate:**
- Enterprise module can load alongside commercial module
- No private implementation in public repo
- Certified build workflow defined

---

## Release timeline dependencies

```
v0.7.5  ──►  v0.7.6  ──►  v0.8.0  ──►  v0.8.x  ──►  v0.9.x
public          public       public       private      private
core prep       metering     interfaces   commercial   enterprise
```

The public repo releases (v0.7.5, v0.7.6, v0.8.0) can proceed independently
of the private repo setup. Private repos (v0.8.x, v0.9.x) require the internal
monorepo split to be complete first.

---

## Related documents

- [`repository-model.md`](./repository-model.md)
- [`publish-core-process.md`](./publish-core-process.md)
- [`public-release-checklist.md`](./public-release-checklist.md)

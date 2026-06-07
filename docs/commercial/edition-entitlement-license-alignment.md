# Edition, Entitlement, and License Alignment

Last updated: 2026-06-07.

This document maps the Free / Pro / Enterprise editions to their license posture,
entitlement posture, deployment posture, support posture, and usage metering
posture. It is a planning document for v0.7.6 and beyond.

**No entitlement gate is active today. All current functionality is available to
all tenants. This document describes the intended future state.**

---

## Core principle: license ≠ entitlement ≠ billing

These are three distinct layers that must not be conflated:

| Layer | Controls | Enforced by |
|-------|----------|-------------|
| **License** | Legal usage rights | LICENSE file, commercial agreement |
| **Entitlement** | Product behavior and feature access | API capability gating (CAPABILITIES system) |
| **Usage metering** | Reporting and future billing inputs | Metering service (not yet built) |
| **Commercial agreement** | Paid support, SLA, private modules, hosted service, reseller rights | Separate legal agreement |

License docs are **not** used as runtime enforcement. Entitlement checks must be
tenant-scoped and must not read license files.

---

## Edition mapping

### Free Edition

| Dimension | Posture |
|-----------|---------|
| License posture | Apache-2.0 (current) or future community edition license |
| Entitlement posture | Full access to Free-tier capabilities; Pro/Enterprise capabilities return `403 Forbidden` with a clear capability error |
| Deployment posture | Self-hosted only |
| Support posture | Community support (GitHub issues, documentation) |
| Usage metering posture | Metering may run but data is for operator visibility only; no billing |

### Pro Edition

| Dimension | Posture |
|-----------|---------|
| License posture | Commercial license required for Pro module access (if Apache core + proprietary module model is chosen) OR AGPL community license covers all code (if dual-license model is chosen) |
| Entitlement posture | Tenant entitlement record grants Pro capabilities; checked by `requireCapability()` middleware |
| Deployment posture | Self-hosted with commercial license, OR managed cloud (future) |
| Support posture | Priority email support; response SLA TBD |
| Usage metering posture | Usage events recorded; aggregation available for operator reporting and future billing |

### Enterprise Edition

| Dimension | Posture |
|-----------|---------|
| License posture | Commercial license required; additional MSP/reseller agreement if redistributing |
| Entitlement posture | Tenant entitlement record grants Enterprise capabilities; admin-scoped capabilities require Enterprise entitlement |
| Deployment posture | Self-hosted with commercial license, private module distribution, or managed service (future) |
| Support posture | Dedicated support channel, named contact, SLA schedule in commercial agreement |
| Usage metering posture | Full usage metering with reporting; commercial agreement governs overages and billing |

---

## Entitlement model (planned)

The existing `CAPABILITIES` system in `apps/api/src/modules/auth/capabilities.ts`
already provides per-capability gating at the API middleware level. This is the
foundation for edition-based entitlement enforcement.

**Planned extension:**

1. Add a tenant entitlement record (e.g., `tenant_edition` column or `tenant_entitlements` table).
2. Map capabilities to minimum required edition (Free / Pro / Enterprise).
3. At capability check time, verify the tenant's edition allows the capability.
4. Return a clear `403` with `edition_required` detail when the capability is
   above the tenant's edition.

**This is not yet implemented.** The capability check today only verifies role;
it does not check edition.

---

## Usage metering posture (planned)

Usage metering is deferred. When implemented:

- Metering events are tenant-scoped.
- Metering data is stored separately from call state.
- Metering does not gate functionality (entitlements do).
- Metering data feeds reporting surfaces and future billing integration.
- No payment provider is integrated in v0.7.5 or v0.7.6.

---

## Rules

1. **License controls legal usage rights.** A tenant running Free software under
   Apache-2.0 has the legal right to use that version. Entitlements restrict
   product behavior, not legal rights.

2. **Entitlements control product behavior.** The API capability system is the
   enforcement point. License docs are not read at runtime.

3. **Usage metering supports reporting and future billing.** Metering is
   observability, not enforcement.

4. **Commercial agreements control paid support, SLA, private modules, hosted
   service, and reseller rights.** These are separate from both the license and
   the entitlement system.

5. **Entitlement checks must be tenant-scoped.** A platform admin granting an
   entitlement to one tenant must not affect another tenant.

---

## Acceptance criteria for v0.7.6

- [ ] This document exists and aligns with `open-source-and-commercial-boundary.md`.
- [ ] Entitlement model design is documented (this document).
- [ ] No entitlement code gate is deployed without a corresponding commercial
      offering being ready.
- [ ] Runtime entitlements are not confused with legal licensing in code or docs.
- [ ] Commercial terms remain placeholders pending legal review.
- [ ] README states current license and future direction.
- [ ] No payment provider is implemented.

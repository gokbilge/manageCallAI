# Release Notes — v0.7.6 (Draft)

**Status: Draft. Not yet released.**

---

## Summary

v0.7.6 connects the licensing and commercial packaging documentation from v0.7.5
to the planned Free / Pro / Enterprise entitlement model. No entitlement gates
are deployed. No payment provider is added.

---

## What changed

### Edition and entitlement alignment

- Added `docs/commercial/edition-entitlement-license-alignment.md` — maps Free,
  Pro, and Enterprise editions to license posture, entitlement posture, deployment
  posture, support posture, and usage metering posture.
- Clarified the three-layer model: license (legal rights) vs entitlement (product
  behavior) vs commercial agreement (support, SLA, reseller).

### README update

- Added "Licensing and editions" section to `README.md` — states current
  Apache-2.0 status and future direction clearly.

---

## What did not change

- The `LICENSE` file remains Apache-2.0.
- No entitlement or edition gates are active in the codebase.
- No payment processing was added.
- All existing functionality remains available.
- No commercial terms are binding.

---

## Maintainer actions required before release

- [ ] Edition entitlement model design has been reviewed against the capability
      system in `apps/api/src/modules/auth/capabilities.ts`.
- [ ] Decision made on whether to implement entitlement gating in v0.7.6 or defer.
- [ ] README licensing section reviewed and approved.
- [ ] Commercial docs from v0.7.5 remain consistent with this document.

# Release Notes — v0.7.5 (Draft)

**Status: Draft. Not yet released.**

---

## Summary

v0.7.5 introduces the licensing strategy and open-source/commercial boundary
documentation for the planned Free / Pro / Enterprise packaging model, and
adds the full entitlement foundation to enforce those limits at the API layer.

---

## What changed

### Licensing documentation

- Added `LICENSING.md` — explains current Apache-2.0 status, existing release
  commitments, and future licensing options under consideration.
- Added `docs/commercial/license-options.md` — compares Apache-2.0, AGPL-3.0,
  dual-license, and Apache core + proprietary modules models with a recommendation.
- Added `docs/commercial/open-source-and-commercial-boundary.md` — defines Free,
  Pro, and Enterprise edition scope, what stays in open-source core, and what is
  deferred.
- Added `docs/commercial/commercial-license-placeholder.md` — placeholder for
  future commercial license terms. Not a final legal agreement.
- Added `docs/commercial/contributor-license-policy.md` — explains DCO vs CLA
  options and the maintainer checklist for relicensing.

### Trademark policy

- Added `TRADEMARKS.md` — basic trademark and brand policy placeholder pending
  legal review.

### Contributor guide update

- Updated `CONTRIBUTING.md` — added contributor licensing posture: contributions
  are made under the active license; future CLA or DCO requirement will be
  announced before taking effect.

### Entitlement foundation (new in this update)

- Added migration `0077_commercial_entitlement_foundation.sql`:
  - `commercial_plans`, `commercial_plan_entitlements`, `tenant_subscriptions`,
    `tenant_entitlement_overrides`, `tenant_usage_counters`, `usage_events`
  - Seeded Free, Pro, and Enterprise plans with all capability entitlements
- Added `EntitlementService` / `EntitlementRepository` module at
  `apps/api/src/modules/entitlement/`
- Added `GET /api/v1/commercial/plan`, `/entitlements`, `/usage` endpoints
- Added `ENTITLEMENT_LIMIT_EXCEEDED` error code and `sendEntitlementLimitExceeded()`
  structured error helper (HTTP 429)
- Wired object-count entitlement checks into 16 resource create handlers:
  extensions, devices, SIP trunks, DIDs, inbound/outbound routes, IVR flows,
  queues, call groups, voicemail boxes, conference rooms, parking lots, schedules,
  feature codes, API keys, webhooks
- Added commercial docs:
  - `docs/commercial/free-pro-enterprise.md`
  - `docs/commercial/edition-capability-matrix.md`
  - `docs/commercial/entitlement-enforcement.md`
  - `docs/commercial/add-on-packs.md`

---

## What did not change

- The `LICENSE` file remains Apache-2.0.
- No package metadata was changed.
- All existing functionality remains available under Apache-2.0.
- Existing Apache-2.0 releases are not retroactively changed.
- No payment processing was added.
- No entitlement enforcement in FreeSWITCH — live call routing is never blocked.

---

## Maintainer actions required before release

- [ ] Legal counsel has reviewed the licensing options document.
- [ ] A licensing model decision has been made or explicitly deferred.
- [ ] The community has been informed of the commercial packaging direction.
- [ ] GitHub issues for the v0.7.5 licensing decisions have been created and linked.
- [ ] Migration 0077 has been reviewed and approved for production.
- [ ] Entitlement enforcement regression tests pass.

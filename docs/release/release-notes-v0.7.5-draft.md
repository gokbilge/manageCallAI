# Release Notes — v0.7.5 (Draft)

**Status: Draft. Not yet released.**

---

## Summary

v0.7.5 introduces the licensing strategy and open-source/commercial boundary
documentation for the planned Free / Pro / Enterprise packaging model. No code
behavior changes. No entitlement gates are active.

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

---

## What did not change

- The `LICENSE` file remains Apache-2.0.
- No package metadata was changed.
- No entitlement or edition gates were added to the codebase.
- All existing functionality remains available under Apache-2.0.
- Existing Apache-2.0 releases are not retroactively changed.

---

## Maintainer actions required before release

- [ ] Legal counsel has reviewed the licensing options document.
- [ ] A licensing model decision has been made or explicitly deferred.
- [ ] The community has been informed of the commercial packaging direction.
- [ ] GitHub issues for the v0.7.5 licensing decisions have been created and linked.

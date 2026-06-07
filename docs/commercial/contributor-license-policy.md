# Contributor License Policy

Last updated: 2026-06-07.

This document explains why relicensing requires contributor clarity, the options
available (DCO vs CLA), and the recommended path before switching from Apache-2.0
to AGPL or a commercial dual-license model.

---

## Why contributor clarity is required before relicensing

When contributors submit code to an Apache-2.0 repository, they grant a license
under Apache-2.0. If maintainers later want to relicense the project — for example,
to AGPL-3.0 or a commercial dual-license model — they need the legal right to do so.

Two approaches exist:

1. **Contact all contributors** and obtain explicit permission to relicense their
   contributions.
2. **Replace all contributed code** so the codebase only contains maintainer-authored
   or clearly permissively-licensed code.
3. **Use a CLA** that grants the project maintainers broader rights from the start,
   enabling future relicensing without individual contact.

Neither the Apache-2.0 nor the AGPL automatically grants the right to relicense.
This must be addressed before any licensing change.

---

## Current posture

Today, the repository uses a simple `CONTRIBUTING.md` with no formal CLA or DCO.
Contributions are made under the repository's active Apache-2.0 license.

**Before relicensing, maintainers must:**

1. Identify all contributors with substantial contributions to the codebase.
2. Determine whether their contributions remain in the current codebase.
3. Either obtain their explicit permission, replace their code, or implement a CLA
   prospectively and address past contributions separately.

---

## Option 1 — Developer Certificate of Origin (DCO)

The **DCO** is a lightweight statement that contributors sign by adding
`Signed-off-by:` to their commits. It certifies that the contributor has the right
to submit the code under the repository's active license.

**What it does:** Confirms the contributor has the right to submit the code.

**What it does NOT do:** Grant the project maintainers the right to relicense
contributions under different terms.

**When to use:** When the project wants contribution clarity without requiring a
full legal agreement. DCO is appropriate if the project plans to stay on
Apache-2.0 permanently or only move to AGPL (same copyleft family).

**How to implement:**
- Add a DCO check to CI (e.g., `dco-org/dco-check` GitHub Action).
- Update `CONTRIBUTING.md` to require `Signed-off-by:` in all commits.
- Document the requirement clearly in the contributing guide.

---

## Option 2 — Contributor License Agreement (CLA)

A **CLA** is a formal agreement where contributors grant the project maintainers
explicit rights, including the right to relicense contributions under different
terms (including commercial licenses).

**What it does:** Grants maintainers the right to use contributions under current
and future license terms, including commercial dual-licensing.

**What it does NOT do:** Remove the contributor's own license rights to their code.

**When to use:** When the project plans to adopt a commercial dual-license model
(e.g., AGPL + commercial) and needs to offer the software under commercial terms
to paying customers. This is the industry standard for commercial open-source
projects (MongoDB, GitLab, Elastic, etc.).

**How to implement:**
- Draft a CLA (Individual CLA for individual contributors, Corporate CLA for
  employer-owned contributions).
- Use a CLA assistant bot (e.g., CLA Assistant, contributor-assistant) to
  automate signing via GitHub PR comments.
- Backfill: contact existing contributors to sign the CLA, or replace their code.
- Update `CONTRIBUTING.md` and PR templates to reference the CLA requirement.

**Important:** CLA must be reviewed by legal counsel before implementation.

---

## Recommended path before switching to AGPL or commercial dual-license

1. **Audit contributors** — identify all contributors with non-trivial code in the
   current codebase using `git log --all --format='%an <%ae>' | sort | uniq`.
2. **Assess exposure** — determine which contributions remain in the active codebase
   (some early code may have been replaced or rewritten).
3. **Engage legal counsel** — get advice on whether DCO or CLA is appropriate for
   the target license model.
4. **Implement CLA if going dual-license** — add the CLA requirement to the
   repository and obtain signatures from all active and past contributors.
5. **Update contributing guide and PR templates** — make the requirement explicit.
6. **Announce the change** — communicate to the community before changing the
   contribution requirement.

---

## Maintainer checklist for relicensing

- [ ] All contributors with code in the current codebase are identified.
- [ ] Contributors have been contacted or their code has been replaced.
- [ ] Legal counsel has reviewed the CLA or DCO implementation.
- [ ] CLA (if required) has been signed by all contributors.
- [ ] CONTRIBUTING.md and PR templates have been updated.
- [ ] Community announcement has been made.
- [ ] New LICENSE file reflects the new terms for future versions only.
- [ ] Historical Apache-2.0 releases are documented as remaining under Apache-2.0.
- [ ] LICENSING.md is updated to reflect the completed decision.

# Public Release Checklist

Last updated: 2026-06-07.

Complete this checklist before every publication to the public
`gokbilge/manageCallAI` repository.

All items must be checked before the release commit is pushed publicly.
Unresolved items must be documented with a rationale before proceeding.

---

## Pre-export

- [ ] Internal release branch created from internal `main`
- [ ] All planned changes for this public release are on the branch
- [ ] CHANGELOG / release notes written and reviewed
- [ ] Version numbers updated (`package.json`, release evidence)

## Export validation

- [ ] `pnpm export:public-core` completed without errors
- [ ] Exported file count is reasonable (no obvious mass-omission or mass-leak)
- [ ] `pnpm check:public-export` passed — **zero violations**

## Content gates (all must pass)

- [ ] No private module implementation included — no `commercial-private/`, `enterprise-private/` dirs
- [ ] No private migrations included — `db/migrations/commercial/` and `db/migrations/enterprise/` absent
- [ ] No signing keys — no `-----BEGIN * PRIVATE KEY-----` patterns anywhere
- [ ] No real license files — only `examples/licenses/*.invalid.json` present
- [ ] No customer data — no customer name, contract, or activation records
- [ ] No private contracts — no `contracts/private/` or commercial agreement files
- [ ] No SSO implementation — no SAML/OIDC connector code committed
- [ ] No PBX importer implementation — no CUCM/Avaya/Alcatel importer code
- [ ] No reseller/billing implementation — no reseller-billing module code
- [ ] No activation server code — no license activation service committed

## Schema checks

- [ ] `pnpm check:schema-boundary` passed — no private-only table names in public migrations
- [ ] Migration 0077 (entitlement foundation) remains intact and unmodified
- [ ] No new migration adds blocked table categories

## Security and compliance

- [ ] `pnpm check:secrets` passed — no hardcoded default secrets outside allowed paths
- [ ] `pnpm audit --audit-level moderate` passed — no high/critical package vulnerabilities
- [ ] Dependency licenses reviewed — no GPL-only dependencies added without legal sign-off
- [ ] No new `.env.production` or `.env.staging` files committed

## Build and tests

- [ ] `pnpm build` passes on the exported tree
- [ ] `pnpm test` passes on the exported tree — zero failures on non-infra tests
- [ ] Docker compose configs validated (`docker-compose.free.yml` etc.)

## Docs review

- [ ] Public docs reviewed — no internal-only planning details leaked
- [ ] Release notes reviewed — accurate and complete
- [ ] `docs/commercial/` reviewed — only public open-core docs included
- [ ] `docs/repo-split/` reviewed — no internal repo URLs or private hostnames

## Final sign-off

- [ ] Maintainer has reviewed the full diff against previous public release
- [ ] CI passed on public repo after push
- [ ] Public tag created
- [ ] GitHub release created with release notes

---

## Notes field

Use this space to document any checklist items that were waived and the
rationale:

```
[DATE] [ITEM] — Waived because: ...
```

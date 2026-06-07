# Public Core Denylist

Last updated: 2026-06-07.

This document defines file paths, directory names, and content patterns that
must never appear in the public `gokbilge/manageCallAI` repository.

The validation script `scripts/check-public-export.mjs` enforces this list.

---

## Blocked directory/file name patterns

Any file or directory whose path matches these patterns is blocked:

| Pattern | Reason |
|---------|--------|
| `**/commercial-private/**` | Private commercial implementation |
| `**/enterprise-private/**` | Private enterprise implementation |
| `**/license-service/**` | License generation and activation |
| `**/license-generator/**` | License generation tooling |
| `**/activation-server/**` | License activation server |
| `**/activation-service/**` | License activation service |
| `**/signing-key*` | Signing key material |
| `**/*.pem` | Private key/certificate files |
| `**/*.key` | Private key files |
| `**/*.p12` | PKCS12 files |
| `**/*.pfx` | PFX private key files |
| `**/*.jks` | Java KeyStore |
| `**/contracts/private/**` | Private commercial contracts |
| `**/customer/**` | Customer-specific data |
| `**/customers/**` | Customer-specific data |
| `**/.env.production` | Production environment secrets |
| `**/.env.staging` | Staging environment secrets |
| `**/.env.local` | Local secret overrides |
| `**/secrets/**` | Secret files |
| `**/credentials/**` | Credential files |

---

## Blocked content patterns (in any file)

The following content patterns must not appear in any file in the public export:

### Private key material

```
-----BEGIN PRIVATE KEY-----
-----BEGIN RSA PRIVATE KEY-----
-----BEGIN EC PRIVATE KEY-----
-----BEGIN OPENSSH PRIVATE KEY-----
-----BEGIN PGP PRIVATE KEY BLOCK-----
```

### Real-looking license files

Any JSON file outside `examples/licenses/*.invalid.json` that contains:
- `"license_id":` with a value not containing `"invalid"` or `"example"`
- `"signature":` with a value not containing `"INVALID"` or `"EXAMPLE"`

Invalid example license files in `examples/licenses/` are allowed because they
carry `"invalid_example": true` and `"INVALID-EXAMPLE-SIGNATURE-DO-NOT-USE"`.

### Private schema table names in SQL migrations

The following must not appear in `CREATE TABLE` statements in `db/migrations/`:

| Pattern | Category |
|---------|----------|
| `license_activation` | License lifecycle |
| `license_revocation` | License lifecycle |
| `license_generator` | License tooling |
| `customer_contract` | Commercial agreements |
| `invoice` | Billing |
| `reseller_billing` | Reseller billing |
| `sso_connection` | Identity federation |
| `saml` | Identity federation |
| `oidc` | Identity federation |
| `migration_project` | Enterprise migration |
| `cucm` | PBX importer |
| `avaya` | PBX importer |
| `alcatel` | PBX importer |
| `legal_hold_export` | Enterprise audit |
| `compliance_export` | Enterprise audit |
| `carrier_certification` | Carrier cert private evidence |
| `support_contract` | Support |
| `private_module_registry` | Private module metadata |

Note: `legal_hold_requests` is grandfathered as a pre-boundary public table
(committed before this policy was established). New `legal_hold_*` tables
targeting export or compliance use cases are blocked.

---

## Private module implementation patterns

The following patterns indicate private implementation that belongs in a
private commercial or enterprise repo, not the public core:

| Pattern | Maps to |
|---------|---------|
| `reseller-billing/` | Enterprise repo |
| `sso/` or `saml/` or `oidc/` module dirs | Enterprise repo |
| `migration-assistant/` with real importer code | Enterprise repo |
| `cucm-importer/`, `avaya-importer/`, `alcatel-importer/` | Enterprise repo |
| `legal-hold/` implementation | Enterprise repo |
| `compliance-export/` implementation | Enterprise repo |
| `carrier-cert-pack/` private evidence | Enterprise repo |
| `ai-gateway/` private implementation | Commercial repo |
| `billing-export/` implementation | Commercial repo |
| `license-generator/` | License-service repo |
| `activation-server/` | License-service repo |

High-level interfaces, public descriptors, and placeholder types for all of
the above may remain in the public core. Only implementation code is blocked.

---

## What is explicitly allowed

These patterns are explicitly permitted in the public repo, even though they
reference commercial concepts:

| Pattern | Reason allowed |
|---------|---------------|
| `examples/licenses/*.invalid.json` | Clearly marked invalid examples |
| `docs/commercial/*.md` | Public commercial docs (open-core boundary, entitlement) |
| `packages/contracts/src/commercial/` | Public TypeScript descriptors and interfaces |
| `docs/deployment/free-self-hosted.md` etc. | Public deployment guides |
| `db/migrations/0077_*.sql` | Public entitlement foundation |
| `docs/repo-split/` | This directory |

---

## Enforcement

Run:

```sh
pnpm check:public-export
```

This script scans either the exported `dist-public/manageCallAI` tree (after
`pnpm export:public-core`) or a configured target directory and exits non-zero
on any violation.

The combined dry-run is:

```sh
pnpm release:public-core:dry-run
```
